const parserPath = './vendor/pdfjs-6.5.438/pdf.min.mjs';
const workerPath = './vendor/pdfjs-6.5.438/pdf.worker.min.mjs';

export async function extractBlipPdf(buffer, { maxPages, maxChars, signal }) {
  const { getDocument, GlobalWorkerOptions } = await import(parserPath);
  signal.throwIfAborted();
  GlobalWorkerOptions.workerSrc = new URL(workerPath, import.meta.url).href;
  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    useWasm: false,
    stopAtErrors: true
  });
  let stopped;
  const stop = () => stopped ??= task.destroy().catch(() => {});
  signal.addEventListener('abort', stop, { once: true });
  try {
    const pdf = await task.promise;
    let text = '';
    let truncated = pdf.numPages > maxPages;
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, maxPages); pageNumber++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => typeof item.str === 'string'
        ? item.str + (item.hasEOL ? '\n' : ' ')
        : '').join('').replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/g, '').trim();
      if (!pageText) continue;
      const section = `${text ? '\n\n' : ''}Page ${pageNumber}\n${pageText}`;
      if (text.length + section.length > maxChars) {
        text += section.slice(0, maxChars - text.length);
        truncated = true;
        break;
      }
      text += section;
      page.cleanup();
    }
    return { text, truncated };
  } finally {
    signal.removeEventListener('abort', stop);
    await stop();
  }
}
