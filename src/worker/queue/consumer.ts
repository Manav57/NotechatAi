import { D1Database, R2Bucket, VectorizeIndex, Ai, Queue } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  OPENROUTER_API_KEY: string;
}

interface DocumentProcessMessage {
  documentId: string;
  key: string;
  type: string;
}

interface AudioGenerateMessage {
  audioId: string;
  documentIds: string[];
  voiceConfig: { voice: string; speed: number };
}

export default {
  async queue(batch: { messages: Array<{ body: DocumentProcessMessage | AudioGenerateMessage }> }, env: Env) {
    for (const message of batch.messages) {
      const body = message.body;
      
      if ('documentId' in body) {
        await processDocument(env, body);
      } else if ('audioId' in body) {
        await generateAudioOverview(env, body);
      }
      
      message.ack();
    }
  },
};

async function processDocument(env: Env, msg: DocumentProcessMessage) {
  const { documentId, key, type } = msg;
  
  console.log(`Processing document ${documentId} (${type})`);
  
  try {
    // 1. Download from R2
    const object = await env.R2.get(key);
    if (!object) throw new Error('File not found in R2');
    
    const arrayBuffer = await object.arrayBuffer();
    
    // 2. Extract text based on type
    let text = '';
    let metadata: Record<string, any> = {};
    
    switch (type) {
      case 'pdf':
        text = await extractPDFText(arrayBuffer);
        metadata = { pages: estimatePages(text) };
        break;
      case 'epub':
        text = await extractEPUBText(arrayBuffer);
        metadata = { chapters: extractChapters(text) };
        break;
      case 'image':
        text = await extractImageText(env, arrayBuffer, key);
        metadata = { sourceType: 'ocr' };
        break;
      case 'text':
      case 'markdown':
        text = new TextDecoder().decode(arrayBuffer);
        break;
      default:
        text = new TextDecoder().decode(arrayBuffer);
    }
    
    // 3. Chunk text semantically
    const chunks = semanticChunk(text, { documentId, type, ...metadata });
    
    // 4. Generate embeddings for each chunk
    const embeddings = await Promise.all(
      chunks.map(chunk => generateEmbedding(env, chunk.content))
    );
    
    // 5. Prepare vectors for Vectorize
    const vectors = chunks.map((chunk, i) => ({
      id: `${documentId}_chunk_${i}`,
      values: embeddings[i],
      metadata: {
        documentId,
        userId: chunk.metadata.userId,
        chunkIndex: i,
        content: chunk.content,
        page: chunk.metadata.page,
        section: chunk.metadata.section,
        ...chunk.metadata,
      },
    }));
    
    // 6. Upsert to Vectorize
    await env.VECTORIZE.upsert(vectors);
    
    // 7. Store extracted text in R2
    const textKey = key.replace(/\.[^.]+$/, '_extracted.txt');
    await env.R2.put(textKey, text);
    
    // 8. Update document status in D1
    await updateDocumentStatus(env.DB, documentId, {
      status: 'ready',
      extractedTextKey: textKey,
      chunkCount: chunks.length,
      tokenCount: chunks.reduce((sum, c) => sum + c.tokens, 0),
      metadata: { ...metadata, chunks: chunks.length },
    });
    
    console.log(`Document ${documentId} processed: ${chunks.length} chunks`);
  } catch (error) {
    console.error(`Failed to process document ${documentId}:`, error);
    await updateDocumentStatus(env.DB, documentId, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function generateAudioOverview(env: Env, msg: AudioGenerateMessage) {
  const { audioId, documentIds, voiceConfig } = msg;
  
  console.log(`Generating audio overview ${audioId}`);
  
  try {
    // 1. Fetch document content
    // Placeholder for fetching document content
    
    // 2. Generate script using LLM
    const script = await generateScript(env, documentIds);
    
    // 3. Generate audio with TTS (placeholder - would use ElevenLabs or similar)
    const audioBuffer = await generateTTS(env, script, voiceConfig);
    
    // 4. Generate transcript with timestamps
    const transcript = await generateTranscript(env, audioBuffer, script);
    
    // 5. Upload to R2
    const audioKey = `audio/${audioId}.mp3`;
    const transcriptKey = `audio/${audioId}_transcript.json`;
    
    await env.R2.put(audioKey, audioBuffer);
    await env.R2.put(transcriptKey, JSON.stringify(transcript));
    
    // 6. Update audio overview status
    console.log(`Audio overview ${audioId} generated`);
  } catch (error) {
    console.error(`Failed to generate audio ${audioId}:`, error);
  }
}

async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  // Placeholder - would use pdf-parse or similar
  return 'PDF text extraction not implemented yet';
}

async function extractEPUBText(buffer: ArrayBuffer): Promise<string> {
  // Placeholder - would use epub parser
  return 'EPUB text extraction not implemented yet';
}

async function extractImageText(env: Env, buffer: ArrayBuffer, key: string): Promise<string> {
  // Convert ArrayBuffer to base64 data URL for OpenRouter vision API
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  // Detect MIME type from key extension
  const ext = key.split('.').pop()?.toLowerCase() || 'jpeg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  };
  const mimeType = mimeMap[ext] || 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured for OCR');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://noteschatai.com',
      'X-Title': 'NotesChatAI-OCR',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a handwriting recognition and OCR specialist. Extract ALL text from the provided image of handwritten notes.\n\nRules:\n- Extract EVERY word, number, symbol, and abbreviation exactly as written\n- Preserve the original structure: headings, bullet points, numbered lists, paragraphs\n- Use markdown formatting to represent the structure\n- If a word is illegible, put [illegible] in its place — do NOT guess\n- Return ONLY the extracted text — no commentary, no explanations`,
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: 'Extract all text from this image of handwritten notes.' },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter OCR error:', response.status, errorText);
    throw new Error(`Vision API error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text returned from vision model');
  return text;
}

function estimatePages(text: string): number {
  return Math.ceil(text.length / 3000);
}

function extractChapters(text: string): string[] {
  const chapters = text.match(/^#{1,3}\s+(.+)$/gm);
  return chapters ? chapters.map(c => c.replace(/^#+\s+/, '')) : [];
}

interface Chunk {
  content: string;
  tokens: number;
  metadata: Record<string, any>;
}

function semanticChunk(text: string, metadata: Record<string, any>): Chunk[] {
  // Simple chunking by headings, then by size
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections: Array<{ level: number; title: string; content: string; start: number }> = [];
  
  let match;
  let lastEnd = 0;
  
  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1].length;
    const title = match[2];
    const start = match.index;
    
    if (sections.length > 0) {
      sections[sections.length - 1].content = text.slice(sections[sections.length - 1].start, start);
    }
    
    sections.push({ level, title, content: '', start });
    lastEnd = start;
  }
  
  // Add final section
  if (sections.length > 0) {
    sections[sections.length - 1].content = text.slice(lastEnd);
  } else {
    // No headings, treat as single section
    sections.push({ level: 1, title: 'Document', content: text, start: 0 });
  }
  
  // Chunk each section
  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  
  for (const section of sections) {
    const sectionChunks = chunkText(section.content, 500, 100);
    
    for (const chunk of sectionChunks) {
      chunks.push({
        content: chunk,
        tokens: estimateTokens(chunk),
        metadata: {
          ...metadata,
          chunkIndex: chunkIndex++,
          section: section.title,
        },
      });
    }
  }
  
  return chunks;
}

function chunkText(text: string, maxTokens: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  
  while (i < words.length) {
    const chunkWords = words.slice(i, i + maxTokens);
    chunks.push(chunkWords.join(' '));
    i += maxTokens - overlap;
  }
  
  return chunks;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function generateEmbedding(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  });
  return result.data[0];
}

async function updateDocumentStatus(db: D1Database, documentId: string, updates: Record<string, any>) {
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), documentId];
  await db.prepare(`UPDATE documents SET ${setClause}, updated_at = unixepoch() WHERE id = ?`).bind(...values).run();
}

async function generateScript(env: Env, documentIds: string[]): Promise<string> {
  // Placeholder - would use LLM to generate two-host script
  return 'Audio overview script generation not implemented yet';
}

async function generateTTS(env: Env, script: string, voiceConfig: { voice: string; speed: number }): Promise<ArrayBuffer> {
  // Placeholder - would use ElevenLabs or similar
  return new ArrayBuffer(0);
}

async function generateTranscript(env: Env, audioBuffer: ArrayBuffer, script: string) {
  // Placeholder - would use Whisper alignment
  return { segments: [], fullText: script };
}