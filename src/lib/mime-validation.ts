/**
 * Server-side MIME type validation using magic bytes.
 * Falls back to extension check when magic bytes are unavailable (metadata-only uploads).
 */

// Magic byte signatures for allowed file types
const MAGIC_BYTES: Record<string, number[][]> = {
  '.pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  '.epub': [[0x50, 0x4B, 0x03, 0x04]], // PK (ZIP-based)
  '.docx': [[0x50, 0x4B, 0x03, 0x04]], // PK (ZIP-based)
  '.zip': [[0x50, 0x4B, 0x03, 0x04]], // PK (ZIP-based)
  '.png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG signature
  '.jpg': [[0xFF, 0xD8, 0xFF]], // JPEG
  '.jpeg': [[0xFF, 0xD8, 0xFF]], // JPEG
  '.gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP starts with RIFF)
  '.mp3': [[0x49, 0x44, 0x33], [0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2]], // ID3 or MPEG frame
  '.wav': [[0x52, 0x49, 0x46, 0x46]], // RIFF
  '.mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp box
};

// File types that can't be validated by magic bytes (text-based)
const TEXT_TYPES = new Set(['.txt', '.md', '.mdx', '.doc']);

/**
 * Validate file content against expected extension using magic bytes.
 * Returns { valid: true } if magic bytes match, or { valid: false, error: string } if mismatch.
 * Returns { valid: true, warning?: string } for text types that can't be validated.
 */
export function validateMagicBytes(
  buffer: ArrayBuffer,
  expectedExt: string
): { valid: boolean; error?: string; warning?: string } {
  const ext = expectedExt.toLowerCase();

  // Text types can't be validated by magic bytes
  if (TEXT_TYPES.has(ext)) {
    return { valid: true, warning: `Cannot validate ${ext} files by magic bytes` };
  }

  const signatures = MAGIC_BYTES[ext];
  if (!signatures) {
    // No magic byte definition — allow (extension validation already passed)
    return { valid: true };
  }

  const bytes = new Uint8Array(buffer.slice(0, 16)); // Read first 16 bytes

  for (const sig of signatures) {
    if (sig.length > bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.length; i++) {
      if (bytes[i] !== sig[i]) {
        match = false;
        break;
      }
    }
    if (match) return { valid: true };
  }

  return {
    valid: false,
    error: `File content does not match expected type "${ext}". The file may be corrupted or mislabeled.`,
  };
}

/**
 * Check if a buffer is all zeros (zero-byte file).
 */
export function isZeroByte(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

/**
 * Get file extension from filename.
 */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot).toLowerCase();
}
