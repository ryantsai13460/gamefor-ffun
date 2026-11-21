import { renderBlipMath } from './blip-math.js';

function safeLink(text, href) {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 2048) return null;
    const node = document.createElement('a');
    node.href = url.href;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    node.textContent = text;
    return node;
  } catch {
    return null;
  }
}

function appendInline(target, text, { sources, allowLinks }) {
  const tokens = /\x60([^\x60\n]+)\x60|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\\\((.+?)\\\)|(?<!\\)\$(?![\s$])([^$\n]+?)(?<!\s)\$(?![\p{L}\p{N}$])|\[([^\]\n]+)\]\(([^\s)]+)\)|\[([1-9]\d?)\]/gu;
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    target.append(text.slice(start, match.index));
    const [raw, code, strong, emphasis, parenMath, dollarMath, linkText, href, citation] = match;
    let node;
    if (code || strong || emphasis) {
      node = document.createElement(code ? 'code' : strong ? 'strong' : 'em');
      node.textContent = code || strong || emphasis;
    } else if (parenMath || dollarMath) {
      node = renderBlipMath(parenMath || dollarMath);
    } else if (linkText) {
      node = allowLinks ? safeLink(linkText, href) : linkText;
    } else if (citation && sources[Number(citation) - 1]) {
      node = safeLink(raw, sources[Number(citation) - 1].url);
      node?.setAttribute('aria-label', 'Source ' + citation);
    }
    target.append(node || raw);
    start = match.index + raw.length;
  }
  target.append(text.slice(start));
}

function tableCells(line) {
  const cells = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/);
  return cells.map(cell => cell.trim().replace(/\\\|/g, '|'));
}

function appendTable(target, lines, start, inlineOptions) {
  if (!lines[start].includes('|') || !lines[start + 1]?.includes('|')) return start;
  const labels = tableCells(lines[start]);
  const rules = tableCells(lines[start + 1]);
  if (labels.length !== rules.length || labels.length > 16 || !rules.every(rule => /^:?-{3,}:?$/.test(rule))) {
    return start;
  }
  const table = document.createElement('table');
  const header = table.createTHead().insertRow();
  const body = table.createTBody();
  const alignments = rules.map(rule => rule.endsWith(':') ? (rule.startsWith(':') ? 'center' : 'right') : 'left');
  for (const [index, label] of labels.entries()) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.style.textAlign = alignments[index];
    appendInline(cell, label, inlineOptions);
    header.append(cell);
  }
  let end = start + 2;
  for (; lines[end]?.includes('|'); end++) {
    const row = body.insertRow();
    const values = tableCells(lines[end]);
    for (const [index, alignment] of alignments.entries()) {
      const cell = row.insertCell();
      cell.style.textAlign = alignment;
      appendInline(cell, values[index] || '', inlineOptions);
    }
  }
  const frame = document.createElement('div');
  frame.className = 'blip-table-frame';
  frame.tabIndex = 0;
  frame.setAttribute('role', 'region');
  frame.setAttribute('aria-label', 'Table in reply');
  frame.append(table);
  target.append(frame);
  return end - 1;
}

function appendDisplayEquation(target, lines, start) {
  const first = lines[start].trim();
  const opening = first.startsWith('$$') ? '$$' : first.startsWith('\\[') ? '\\[' : '';
  if (!opening) return start - 1;
  const closing = opening === '$$' ? '$$' : '\\]';
  let expression = first.slice(2);
  let end = start;
  while (!expression.trimEnd().endsWith(closing) && expression.length <= 900 && end + 1 < lines.length) {
    expression += '\n' + lines[++end].trim();
  }
  expression = expression.trimEnd();
  const math = expression.endsWith(closing) && renderBlipMath(expression.slice(0, -2), true);
  if (!math) return start - 1;
  const frame = document.createElement('div');
  frame.className = 'blip-math-frame';
  frame.append(math);
  target.append(frame);
  return end;
}

function appendCode(target, text) {
  const block = document.createElement('div');
  block.className = 'blip-code-block';
  const tools = document.createElement('div');
  tools.className = 'blip-code-tools';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const copy = document.createElement('button');
  copy.className = 'blip-button';
  copy.type = 'button';
  copy.textContent = 'Copy code';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Code copied.';
    } catch {
      status.textContent = 'Clipboard unavailable.';
    }
  });
  tools.append(status, copy);
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  const tokens = /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\b(?:const|let|var|function|return|if|else|for|while|class|new|import|from|true|false|null|def|print|in|await|async|export)\b)/g;
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    code.append(text.slice(start, match.index));
    const token = document.createElement('span');
    token.className = /^["']/.test(match[0]) ? 'blip-code-string' : 'blip-code-keyword';
    token.textContent = match[0];
    code.append(token);
    start = match.index + match[0].length;
  }
  code.append(text.slice(start));
  pre.append(code);
  block.append(tools, pre);
  target.append(block);
}

export function formatBlipReply(target, text, sources = [], { allowLinks = true } = {}) {
  const inlineOptions = { sources, allowLinks };
  const sections = text.split(/^\s*```[^\n]*\n|^\s*```\s*$/m);
  for (const [index, section] of sections.entries()) {
    if (index % 2) {
      appendCode(target, section.replace(/\n$/, ''));
      continue;
    }
    let list;
    const lines = section.trim().split('\n');
    for (let cursor = 0; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      const equationEnd = appendDisplayEquation(target, lines, cursor);
      if (equationEnd >= cursor) {
        cursor = equationEnd;
        list = undefined;
        continue;
      }
      const tableEnd = appendTable(target, lines, cursor, inlineOptions);
      if (tableEnd > cursor) {
        cursor = tableEnd;
        list = undefined;
        continue;
      }
      const bullet = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)/);
      if (bullet) {
        const type = bullet[2] ? 'OL' : 'UL';
        if (list?.tagName !== type) {
          list = document.createElement(type.toLowerCase());
          target.append(list);
        }
        const item = document.createElement('li');
        appendInline(item, bullet[3], inlineOptions);
        list.append(item);
        continue;
      }
      list = undefined;
      if (!line.trim()) continue;
      const heading = line.match(/^#{1,6}\s+(.*)/);
      const block = document.createElement(heading ? 'h4' : 'p');
      appendInline(block, heading ? heading[1] : line, inlineOptions);
      target.append(block);
    }
  }
}
