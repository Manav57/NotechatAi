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

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─── XML Templates ───

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FF1F3864"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD6E4F0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left/><right/><top/>
      <bottom style="thin"><color rgb="FFD0D0D0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;
}

// ─── Parse markdown content into rows ───

interface ParsedSheet {
  title: string;
  headers: string[];
  rows: string[][];
}

function parseMarkdownToSheet(markdown: string): ParsedSheet {
  const lines = markdown.split('\n');
  let title = '';
  const headers: string[] = [];
  const rows: string[][] = [];
  let inTable = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Title: first # heading
    if (!title && line.startsWith('# ') && !line.startsWith('## ')) {
      title = line.replace(/^#\s+/, '');
      continue;
    }

    // Table detection: | col | col |
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());

      // Skip separator row (|---|---|)
      if (cells.every(c => /^[-:]+$/.test(c))) {
        inTable = true;
        continue;
      }

      if (!inTable && headers.length === 0) {
        // This is the header row
        headers.push(...cells);
      } else {
        rows.push(cells);
      }
      continue;
    }

    // Non-table line after table ends
    if (inTable && !line.startsWith('|')) {
      inTable = false;
    }

    // If no table found, treat as key-value or plain rows
    if (!inTable && headers.length === 0 && line.includes(':') && !line.startsWith('#')) {
      const colonIdx = line.indexOf(':');
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key && !headers.includes(key)) {
        headers.push(key);
        rows.push([val]);
      }
    }
  }

  // If no table was found, create a simple two-column layout from lines
  if (headers.length === 0) {
    headers.push('Content');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) continue;
      if (line.startsWith('```')) continue;
      rows.push([line]);
    }
  }

  return { title, headers, rows };
}

// ─── Column letter helper ───

function colLetter(idx: number): string {
  let result = '';
  let i = idx;
  while (i >= 0) {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  }
  return result;
}

// ─── Generate XLSX ───

async function generateXLSX(title: string, content: string): Promise<Uint8Array> {
  const zip = new JSZip();
  const sheet = parseMarkdownToSheet(content);

  // Shared strings table
  const sharedStrings: string[] = [];
  const ssMap = new Map<string, number>();
  function addString(s: string): number {
    const existing = ssMap.get(s);
    if (existing !== undefined) return existing;
    const idx = sharedStrings.length;
    sharedStrings.push(s);
    ssMap.set(s, idx);
    return idx;
  }

  // Pre-populate shared strings with title
  if (sheet.title || title) addString(sheet.title || title);
  for (const h of sheet.headers) addString(h);
  for (const row of sheet.rows) {
    for (const cell of row) addString(cell);
  }

  // Build sheet XML
  const maxCols = Math.max(sheet.headers.length, ...sheet.rows.map(r => r.length));
  const lastCol = colLetter(maxCols - 1);
  const lastRow = sheet.rows.length + 2; // +1 for header, +1 for 1-indexing

  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>`;

  // Column widths
  for (let c = 0; c < maxCols; c++) {
    const maxLen = Math.max(
      sheet.headers[c]?.length || 5,
      ...sheet.rows.map(r => (r[c] || '').length)
    );
    const width = Math.min(Math.max(maxLen + 4, 10), 50);
    sheetXml += `\n    <col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`;
  }

  sheetXml += `\n  </cols>\n  <sheetData>`;

  // Title row (if present)
  const displayTitle = sheet.title || title;
  if (displayTitle) {
    sheetXml += `\n    <row r="1" ht="24" customHeight="1">
      <c r="A1" t="s" s="4"><v>${addString(displayTitle)}</v></c>
    </row>`;
  }

  // Header row
  const headerRowNum = displayTitle ? 2 : 1;
  sheetXml += `\n    <row r="${headerRowNum}" ht="20" customHeight="1">`;
  for (let c = 0; c < sheet.headers.length; c++) {
    const ref = `${colLetter(c)}${headerRowNum}`;
    sheetXml += `\n      <c r="${ref}" t="s" s="1"><v>${addString(sheet.headers[c])}</v></c>`;
  }
  sheetXml += `\n    </row>`;

  // Data rows
  for (let r = 0; r < sheet.rows.length; r++) {
    const rowNum = headerRowNum + 1 + r;
    const isEven = r % 2 === 0;
    sheetXml += `\n    <row r="${rowNum}">`;
    for (let c = 0; c < maxCols; c++) {
      const ref = `${colLetter(c)}${rowNum}`;
      const val = sheet.rows[r][c] || '';
      const style = isEven ? '3' : '2'; // alternating row colors
      sheetXml += `\n      <c r="${ref}" t="s" s="${style}"><v>${addString(val)}</v></c>`;
    }
    sheetXml += `\n    </row>`;
  }

  sheetXml += `\n  </sheetData>
  <autoFilter ref="A${headerRowNum}:${lastCol}${lastRow}"/>
</worksheet>`;

  // Shared strings XML
  let ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">`;
  for (const s of sharedStrings) {
    ssXml += `\n  <si><t xml:space="preserve">${escapeXml(s)}</t></si>`;
  }
  ssXml += `\n</sst>`;

  // Package everything
  zip.file('[Content_Types].xml', contentTypesXml());
  zip.file('_rels/.rels', rootRels());
  zip.file('xl/workbook.xml', workbookXml());
  zip.file('xl/_rels/workbook.xml.rels', workbookRels());
  zip.file('xl/styles.xml', stylesXml());
  zip.file('xl/sharedStrings.xml', ssXml);
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// ─── POST /api/documents/generate-xlsx ───

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

    const xlsxBytes = await generateXLSX(title || 'Spreadsheet', content);

    const docId = crypto.randomUUID();
    const safeName = (filename || title || 'spreadsheet')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    const r2Key = `generated/${user.id}/${docId}/${safeName}.xlsx`;

    const r2 = bindings.R2;
    if (r2) {
      await r2.put(r2Key, xlsxBytes, {
        httpMetadata: {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentDisposition: `attachment; filename="${safeName}.xlsx"`,
        },
      });
    }

    let downloadUrl = '';
    if (r2) {
      const presigned = await r2.createPresignedGetUrl(r2Key, { expiresIn: 3600 });
      downloadUrl = presigned.url;
    }

    return new Response(JSON.stringify({
      success: true,
      documentId: docId,
      filename: `${safeName}.xlsx`,
      downloadUrl,
      size: xlsxBytes.length,
      message: `XLSX generated successfully (${(xlsxBytes.length / 1024).toFixed(1)} KB)`,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('XLSX generation error:', e);
    return new Response(JSON.stringify({
      error: 'Failed to generate XLSX: ' + (e instanceof Error ? e.message : String(e)),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
