export const prerender = false;

import type { APIRoute } from 'astro';
import JSZip from 'jszip';
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

// ─── XML Escaping ───

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── DOCX XML Templates ───

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:sz w:val="44"/>
      <w:szCs w:val="44"/>
      <w:color w:val="1F3864"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:sz w:val="36"/>
      <w:szCs w:val="36"/>
      <w:color w:val="2E75B6"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
      <w:color w:val="404040"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="720"/>
      <w:spacing w:before="60" w:after="60"/>
    </w:pPr>
  </w:style>
  <w:style w:type="numbering" w:styleId="NoList">
    <w:name w:val="No List"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>`;
}

function numberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;
}

// ─── Markdown → DOCX XML ───

/**
 * Convert markdown content to WordprocessingML XML paragraphs.
 * Supports: headings, bullet lists, numbered lists, bold, italic, code, plain text.
 */
function markdownToDocxXml(markdown: string): string {
  const lines = markdown.split('\n');
  const paragraphs: string[] = [];
  let inBulletList = false;
  let inNumberedList = false;

  function closeList() {
    if (inBulletList) { inBulletList = false; }
    if (inNumberedList) { inNumberedList = false; }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Empty line
    if (line === '') {
      closeList();
      continue;
    }

    // Heading 1
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      closeList();
      const text = line.replace(/^#\s+/, '');
      paragraphs.push(makeHeadingParagraph(text, 'Heading1'));
      continue;
    }

    // Heading 2
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      closeList();
      const text = line.replace(/^##\s+/, '');
      paragraphs.push(makeHeadingParagraph(text, 'Heading2'));
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      closeList();
      const text = line.replace(/^###\s+/, '');
      paragraphs.push(makeHeadingParagraph(text, 'Heading3'));
      continue;
    }

    // Bullet list: - item or * item
    if (/^[-*]\s+/.test(line)) {
      inBulletList = true;
      const text = line.replace(/^[-*]\s+/, '');
      paragraphs.push(makeBulletParagraph(text));
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+\.\s+/.test(line)) {
      inNumberedList = true;
      const text = line.replace(/^\d+\.\s+/, '');
      const num = line.match(/^(\d+)\./)?.[1] || '1';
      paragraphs.push(makeNumberedParagraph(text, num));
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line)) {
      closeList();
      paragraphs.push(`<w:p>
  <w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr></w:pPr>
</w:p>`);
      continue;
    }

    // Regular paragraph
    closeList();
    paragraphs.push(makeTextParagraph(line));
  }

  return paragraphs.join('\n');
}

function makeHeadingParagraph(text: string, style: string): string {
  const runs = parseInlineFormatting(text);
  return `<w:p>
  <w:pPr><w:pStyle w:val="${style}"/></w:pPr>
  ${runs}
</w:p>`;
}

function makeBulletParagraph(text: string): string {
  const runs = parseInlineFormatting(text);
  return `<w:p>
  <w:pPr>
    <w:pStyle w:val="ListParagraph"/>
    <w:numPr>
      <w:ilvl w:val="0"/>
      <w:numId w:val="0"/>
    </w:numPr>
    <w:ind w:left="720" w:hanging="360"/>
  </w:pPr>
  <w:r>
    <w:t xml:space="preserve">•  </w:t>
  </w:r>
  ${runs}
</w:p>`;
}

function makeNumberedParagraph(text: string, num: string): string {
  const runs = parseInlineFormatting(text);
  return `<w:p>
  <w:pPr>
    <w:pStyle w:val="ListParagraph"/>
    <w:numPr>
      <w:ilvl w:val="0"/>
      <w:numId w:val="1"/>
    </w:numPr>
    <w:ind w:left="720" w:hanging="360"/>
  </w:pPr>
  ${runs}
</w:p>`;
}

function makeTextParagraph(text: string): string {
  const runs = parseInlineFormatting(text);
  return `<w:p>
  <w:pPr><w:pStyle w:val="Normal"/></w:pPr>
  ${runs}
</w:p>`;
}

/**
 * Parse inline markdown formatting into Word XML runs.
 * Handles: **bold**, *italic*, `code`, [text](url)
 */
function parseInlineFormatting(text: string): string {
  const runs: string[] = [];
  // Simple regex-based parser
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      runs.push(makeRun(before, false, false, false));
    }

    if (match[2]) {
      // **bold**
      runs.push(makeRun(match[2], true, false, false));
    } else if (match[4]) {
      // *italic*
      runs.push(makeRun(match[4], false, true, false));
    } else if (match[6]) {
      // `code`
      runs.push(makeRun(match[6], false, false, true));
    } else if (match[8]) {
      // [text](url) — render as text with link
      runs.push(makeRun(match[8], false, false, false, match[9]));
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(makeRun(text.slice(lastIndex), false, false, false));
  }

  if (runs.length === 0) {
    runs.push(makeRun(text, false, false, false));
  }

  return runs.join('\n  ');
}

function makeRun(text: string, bold: boolean, italic: boolean, code: boolean, hyperlink?: string): string {
  const escaped = escapeXml(text);
  const rPrParts: string[] = [];

  if (bold) rPrParts.push('<w:b/>');
  if (italic) rPrParts.push('<w:i/>');
  if (code) {
    rPrParts.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
    rPrParts.push('<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>');
  }

  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';

  if (hyperlink) {
    return `<w:hyperlink w:history="1">
    <w:r>
      ${rPr}
      <w:rStyle w:val="Hyperlink"/>
      <w:t xml:space="preserve">${escaped}</w:t>
    </w:r>
  </w:hyperlink>`;
  }

  return `<w:r>
    ${rPr}
    <w:t xml:space="preserve">${escaped}</w:t>
  </w:r>`;
}

// ─── Document XML Assembly ───

function documentXml(title: string, bodyXml: string): string {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
          <w:b/>
          <w:sz w:val="48"/>
          <w:szCs w:val="48"/>
          <w:color w:val="1F3864"/>
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(title)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr>
        <w:spacing w:after="200"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:color w:val="808080"/>
          <w:sz w:val="18"/>
          <w:szCs w:val="18"/>
        </w:rPr>
        <w:t xml:space="preserve">Generated on ${escapeXml(dateStr)} by NotesChatAI</w:t>
      </w:r>
    </w:p>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// ─── DOCX Generation ───

async function generateDOCX(title: string, content: string): Promise<Uint8Array> {
  const zip = new JSZip();

  // Add required DOCX structure files
  zip.file('[Content_Types].xml', contentTypesXml());
  zip.file('_rels/.rels', rootRels());
  zip.file('word/_rels/document.xml.rels', documentRels());
  zip.file('word/styles.xml', stylesXml());
  zip.file('word/numbering.xml', numberingXml());

  // Convert markdown to DOCX body XML
  const bodyXml = markdownToDocxXml(content);
  zip.file('word/document.xml', documentXml(title, bodyXml));

  // Generate the ZIP as a Uint8Array
  const arrayBuffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return arrayBuffer;
}

// ─── POST /api/documents/generate-docx — Generate a DOCX ───

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

    // Generate the DOCX
    const docxBytes = await generateDOCX(title || 'Document', content);

    // Store in R2
    const docId = crypto.randomUUID();
    const safeName = (filename || title || 'document')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    const r2Key = `generated/${user.id}/${docId}/${safeName}.docx`;

    const r2 = bindings.R2;
    if (r2) {
      await r2.put(r2Key, docxBytes, {
        httpMetadata: {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentDisposition: `attachment; filename="${safeName}.docx"`,
        },
      });
    }

    // Generate a presigned download URL (valid for 1 hour)
    let downloadUrl = '';
    if (r2) {
      const presigned = await r2.createPresignedGetUrl(r2Key, { expiresIn: 3600 });
      downloadUrl = presigned.url;
    }

    return new Response(JSON.stringify({
      success: true,
      documentId: docId,
      filename: `${safeName}.docx`,
      downloadUrl,
      size: docxBytes.length,
      message: `DOCX generated successfully (${(docxBytes.length / 1024).toFixed(1)} KB)`,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('DOCX generation error:', e);
    return new Response(JSON.stringify({
      error: 'Failed to generate DOCX: ' + (e instanceof Error ? e.message : String(e)),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
