export const prerender = false;

import type { APIRoute } from 'astro';
import { devGetSession } from '../../../lib/dev-auth';
import { createDocument } from '../../../lib/dev-store';
import { verifyQuota, incrementDocumentCount } from '../../../lib/billing';

// ─── Vision model for OCR ───
// GPT-4o has excellent vision capabilities for handwriting recognition
// Cost: ~$2.50/1M input tokens — very affordable for OCR
const OCR_MODEL = 'openai/gpt-4o';

const OCR_SYSTEM_PROMPT = `You are a handwriting recognition and OCR specialist. Your task is to extract ALL text from the provided image of handwritten notes.

Rules:
- Extract EVERY word, number, symbol, and abbreviation exactly as written
- Preserve the original structure: headings, bullet points, numbered lists, paragraphs
- Use markdown formatting to represent the structure (e.g., # for headings, - for bullets, 1. for numbered lists)
- If a word is illegible, put [illegible] in its place — do NOT guess or invent text
- Preserve abbreviations and shorthand exactly as written
- Maintain any mathematical notation as closely as possible using standard text representation
- If there are multiple columns or sections, separate them clearly
- Return ONLY the extracted text — no commentary, no explanations, no preamble

Your output will be processed into a searchable knowledge base, so accuracy is critical.`;

// ─── Helpers ───

function getUser(cookies: { get: (name: string) => { value: string } | undefined }) {
  const token = cookies.get('session')?.value;
  if (!token) return null;
  const result = devGetSession(token);
  return result?.session?.user || null;
}

async function getEnv() {
  try {
    const mod = await import('cloudflare:workers');
    return (mod as any).env ?? null;
  } catch {
    return null;
  }
}

/**
 * Send an image to OpenRouter vision model for text extraction.
 */
async function extractTextFromImage(
  apiKey: string,
  imageDataUrl: string,
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://noteschatai.com',
      'X-Title': 'NotesChatAI-OCR',
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      messages: [
        { role: 'system', content: OCR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageDataUrl },
            },
            {
              type: 'text',
              text: 'Extract all text from this image of handwritten notes. Return only the extracted text in markdown format.',
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1, // Low temperature for accuracy
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter OCR API error:', response.status, errorText);
    throw new Error(`Vision API error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text returned from vision model');
  return text;
}

// ─── POST /api/documents/ocr — Extract text from handwritten image ───

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = getUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bindings = await getEnv();
    if (!bindings) {
      return new Response(JSON.stringify({ error: 'Environment not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const OPENROUTER_API_KEY = bindings.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: 'Vision API not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ─── Quota enforcement ───
    const db = bindings.DB;
    if (db) {
      const quota = await verifyQuota(db, user.id, 'document');
      if (!quota.allowed) {
        return new Response(JSON.stringify({
          error: 'QUOTA_EXCEEDED',
          message: quota.message,
          plan: quota.plan,
          feature: quota.feature,
          used: quota.used,
          limit: quota.limit,
          upgradeUrl: '/pricing',
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await request.json();
    const { imageDataUrl, filename, tags } = body;

    if (!imageDataUrl) {
      return new Response(JSON.stringify({ error: 'imageDataUrl required (base64 data URL)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate it's a data URL with an image
    if (!imageDataUrl.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: 'Invalid image data URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file size (base64 data URL — rough check: 10MB limit)
    // base64 encoding adds ~33% overhead, so check raw size
    const base64Data = imageDataUrl.split(',')[1] || '';
    const estimatedBytes = Math.ceil(base64Data.length * 0.75);
    if (estimatedBytes > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Image too large (max 10MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract text from image using vision model
    let extractedText: string;
    try {
      extractedText = await extractTextFromImage(OPENROUTER_API_KEY, imageDataUrl);
    } catch (e) {
      console.error('OCR extraction failed:', e);
      return new Response(JSON.stringify({
        error: 'OCR_FAILED',
        message: 'Failed to extract text from image. The image may be too blurry or the handwriting too illegible.',
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate we got meaningful text
    const trimmedText = extractedText.trim();
    if (trimmedText.length < 10) {
      return new Response(JSON.stringify({
        error: 'INSUFFICIENT_TEXT',
        message: 'Very little text was extracted from the image. It may be too blurry or contain no readable handwriting.',
        extractedText: trimmedText,
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create document record with extracted text
    const title = filename || `Handwritten Notes - ${new Date().toLocaleDateString()}`;
    const doc = createDocument(user.id, title, 'handwritten', {
      filename,
      tags: tags || [],
      type: 'handwritten',
      sourceType: 'ocr',
      originalMediaType: 'image',
    });

    // Increment document count
    if (db) {
      try { await incrementDocumentCount(db, user.id); } catch {}
    }

    return new Response(JSON.stringify({
      document: doc,
      extractedText: trimmedText,
      message: `Successfully extracted ${trimmedText.length} characters from handwritten notes.`,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('OCR endpoint error:', e);
    return new Response(JSON.stringify({
      error: 'Internal server error: ' + (e instanceof Error ? e.message : String(e)),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
