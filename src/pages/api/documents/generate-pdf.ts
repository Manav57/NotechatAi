export const prerender = false;

import type { APIRoute } from 'astro';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { devGetSession } from '../../../lib/dev-auth';

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

// ─── PDF Generation ───

interface TextBlock {
  text: string;
  fontSize: number;
  font: 'helvetica' | 'helvetica-bold';
  color: { r: number; g: number; b: number };
  spacing: number; // line height multiplier
}

/**
 * Parse simple markdown into PDF text blocks.
 * Supports: # headings, - bullet lists, **bold**, plain text
 */
function markdownToBlocks(markdown: string): TextBlock[] {
  const lines = markdown.split('\n');
  const blocks: TextBlock[] = [];
  const black = { r: 0.09, g: 0.09, b: 0.09 };
  const darkGray = { r: 0.3, g: 0.3, b: 0.3 };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Empty line → small spacing
    if (trimmed === '') {
      blocks.push({ text: '', fontSize: 8, font: 'helvetica', color: black, spacing: 1 });
      continue;
    }

    // Heading 1: # Title
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      blocks.push({
        text: trimmed.replace(/^#\s+/, ''),
        fontSize: 22,
        font: 'helvetica-bold',
        color: black,
        spacing: 1.4,
      });
      continue;
    }

    // Heading 2: ## Title
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      blocks.push({
        text: trimmed.replace(/^##\s+/, ''),
        fontSize: 18,
        font: 'helvetica-bold',
        color: black,
        spacing: 1.3,
      });
      continue;
    }

    // Heading 3: ### Title
    if (trimmed.startsWith('### ')) {
      blocks.push({
        text: trimmed.replace(/^###\s+/, ''),
        fontSize: 15,
        font: 'helvetica-bold',
        color: black,
        spacing: 1.3,
      });
      continue;
    }

    // Bullet list: - item or * item
    if (/^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '');
      blocks.push({
        text: `  •  ${stripMarkdown(text)}`,
        fontSize: 11,
        font: 'helvetica',
        color: darkGray,
        spacing: 1.5,
      });
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s+/, '');
      const num = trimmed.match(/^(\d+)\./)?.[1] || '1';
      blocks.push({
        text: `  ${num}.  ${stripMarkdown(text)}`,
        fontSize: 11,
        font: 'helvetica',
        color: darkGray,
        spacing: 1.5,
      });
      continue;
    }

    // Horizontal rule: --- or ***
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({ text: '─'.repeat(60), fontSize: 8, font: 'helvetica', color: { r: 0.7, g: 0.7, b: 0.7 }, spacing: 1 });
      continue;
    }

    // Regular paragraph
    blocks.push({
      text: stripMarkdown(trimmed),
      fontSize: 11,
      font: 'helvetica',
      color: darkGray,
      spacing: 1.6,
    });
  }

  return blocks;
}

/** Strip markdown bold/italic markers for PDF output */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/`(.+?)`/g, '$1')          // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [text](url)
    .trim();
}

/**
 * Word-wrap text to fit within a given width (in points).
 * Returns an array of lines.
 */
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return [''];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/**
 * Generate a PDF from markdown content.
 * Returns the PDF as a Uint8Array.
 */
async function generatePDF(title: string, content: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page setup
  const pageWidth = 612;  // US Letter width in points
  const pageHeight = 792; // US Letter height in points
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Draw title
  const titleLines = wrapText(title, helveticaBold, 24, contentWidth);
  for (const line of titleLines) {
    if (y < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: 24,
      font: helveticaBold,
      color: rgb(0.09, 0.09, 0.09),
    });
    y -= 30;
  }

  // Separator
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 20;

  // Date line
  const dateStr = `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  page.drawText(dateStr, {
    x: margin,
    y,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 24;

  // Parse markdown into blocks
  const blocks = markdownToBlocks(content);

  for (const block of blocks) {
    const font = block.font === 'helvetica-bold' ? helveticaBold : helvetica;
    const wrappedLines = wrapText(block.text, font, block.fontSize, contentWidth);
    const lineHeight = block.fontSize * block.spacing;

    for (const line of wrappedLines) {
      // Page break if needed
      if (y < margin + 10) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: block.fontSize,
        font,
        color: rgb(block.color.r, block.color.g, block.color.b),
      });
      y -= lineHeight;
    }
  }

  // Footer on each page
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(`NotesChatAI  •  Page ${i + 1} of ${pages.length}`, {
      x: margin,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  return pdfDoc.save();
}

// ─── POST /api/documents/generate-pdf — Generate a PDF ───

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

    const body = await request.json();
    const { title, content, filename } = body;

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'content (markdown string) required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (content.length > 500000) {
      return new Response(JSON.stringify({ error: 'Content too large (max 500KB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate the PDF
    const pdfBytes = await generatePDF(title || 'Document', content);

    // Store in R2
    const docId = crypto.randomUUID();
    const safeName = (filename || title || 'document')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    const r2Key = `generated/${user.id}/${docId}/${safeName}.pdf`;

    const r2 = bindings.R2;
    if (r2) {
      await r2.put(r2Key, pdfBytes, {
        httpMetadata: {
          contentType: 'application/pdf',
          contentDisposition: `attachment; filename="${safeName}.pdf"`,
        },
      });
    }

    // Generate a presigned download URL (valid for 1 hour)
    let downloadUrl = '';
    if (r2) {
      const presigned = await r2.createPresignedGetUrl(r2Key, {
        expiresIn: 3600,
      });
      downloadUrl = presigned.url;
    }

    return new Response(JSON.stringify({
      success: true,
      documentId: docId,
      filename: `${safeName}.pdf`,
      downloadUrl,
      size: pdfBytes.length,
      message: `PDF generated successfully (${(pdfBytes.length / 1024).toFixed(1)} KB)`,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('PDF generation error:', e);
    return new Response(JSON.stringify({
      error: 'Failed to generate PDF: ' + (e instanceof Error ? e.message : String(e)),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
