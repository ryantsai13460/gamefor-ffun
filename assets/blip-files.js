const fileTypes = new Map([
  ['.txt', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
  ['.csv', 'text/csv'],
  ['.tsv', 'text/tab-separated-values'],
  ['.json', 'application/json'],
]);

export const BLIP_FILE_ACCEPT = [...fileTypes.keys()].join(',');
export const BLIP_FILE_LIMITS = Object.freeze({ count: 3, bytes: 256 * 1024, text: 12000, name: 160 });
const supportedTypes = new Set(fileTypes.values());
const binaryControls = /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/;

function fileName(value) {
  if (typeof value !== 'string') return '';
  return (value.split(/[\\/]/).at(-1) || '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim()
    .slice(0, BLIP_FILE_LIMITS.name);
}

function documentText(value) {
  if (typeof value !== 'string' || value.length > BLIP_FILE_LIMITS.bytes || binaryControls.test(value)) return '';
  return value.replace(/\r\n?|\f/g, '\n').trim();
}

function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

// Use the same validation for new attachments and records restored from storage.
export function normalizeBlipAttachments(value) {
  const records = [];
  if (!Array.isArray(value)) return Object.freeze(records);

  for (const raw of value.slice(0, BLIP_FILE_LIMITS.count)) {
    const name = fileName(raw?.name);
    const { type, size } = raw || {};
    if (!name || !supportedTypes.has(type) ||
        !Number.isSafeInteger(size) || size < 1 || size > BLIP_FILE_LIMITS.bytes) continue;
    const text = documentText(raw.text);
    if (!text) continue;
    records.push({ name, type, size, text, truncated: raw.truncated === true });
  }

  let remaining = BLIP_FILE_LIMITS.text;
  return Object.freeze(records.map((record, index) => {
    const budget = Math.floor(remaining / (records.length - index));
    const excerpt = record.text.slice(0, budget).replace(/[\ud800-\udbff]$/, '').trimEnd();
    remaining -= excerpt.length;
    return Object.freeze({
      ...record,
      text: excerpt,
      truncated: record.truncated || excerpt.length < record.text.length,
    });
  }));
}

export async function readBlipFiles(files) {
  const accepted = [];
  const errors = [];
  const count = Number.isSafeInteger(files?.length) && files.length > 0 ? files.length : 0;

  for (let index = 0; index < Math.min(count, BLIP_FILE_LIMITS.count); index++) {
    const file = files[index];
    const basename = typeof file?.name === 'string' ? file.name.split(/[\\/]/).at(-1) : '';
    const name = fileName(basename) || 'Unnamed file';
    const error = message => errors.push({ name, message });
    const extension = basename?.match(/\.[^.]+$/)?.[0].toLowerCase();
    const type = fileTypes.get(extension);
    if (!type) {
      error(extension === '.pdf'
        ? 'PDF text extraction is unavailable. Export the document as TXT and attach that file.'
        : 'Use a TXT, Markdown, CSV, TSV, or JSON file.');
      continue;
    }
    if (!Number.isSafeInteger(file.size) || file.size > BLIP_FILE_LIMITS.bytes) {
      error('Files must be 256 KiB or smaller.');
      continue;
    }
    if (file.size <= 0) {
      error('This file is empty.');
      continue;
    }

    let buffer;
    try {
      buffer = await file.arrayBuffer();
      if (buffer.byteLength !== file.size) throw new Error('File size changed');
    } catch {
      error('The browser could not read this file.');
      continue;
    }

    let decoded;
    try {
      decoded = decodeText(buffer);
      if (binaryControls.test(decoded)) throw new Error('Unexpected binary content');
    } catch {
      error('This file is not readable plain text. Save it as UTF-8 and try again.');
      continue;
    }
    const text = documentText(decoded);
    if (!text) {
      error('This file has no readable text.');
      continue;
    }
    if (type === 'application/json') {
      try {
        JSON.parse(decoded);
      } catch {
        error('This file contains invalid JSON.');
        continue;
      }
    }
    accepted.push({ name, type, size: file.size, text });
  }

  if (count > BLIP_FILE_LIMITS.count) {
    errors.push({ name: 'Additional files', message: 'Select up to three files per message.' });
  }
  return { attachments: normalizeBlipAttachments(accepted), errors };
}
