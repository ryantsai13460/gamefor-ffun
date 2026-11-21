function appendInline(target, text) {
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  for (const [index, part] of text.split(tokens).entries()) {
    if (index % 2 === 0) target.append(part);
    else {
      const size = part.startsWith('**') ? 2 : 1;
      const node = document.createElement(part.startsWith('`') ? 'code' : size === 2 ? 'strong' : 'em');
      node.textContent = part.slice(size, -size);
      target.append(node);
    }
  }
}

function appendCode(target, text) {
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
  target.append(pre);
}

export function formatBlipReply(target, text) {
  const sections = text.split(/^\s*```[^\n]*\n|^\s*```\s*$/m);
  for (const [index, section] of sections.entries()) {
    if (index % 2) {
      appendCode(target, section.replace(/\n$/, ''));
      continue;
    }
    let list;
    for (const line of section.trim().split('\n')) {
      const bullet = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)/);
      if (bullet) {
        const type = bullet[2] ? 'OL' : 'UL';
        if (list?.tagName !== type) {
          list = document.createElement(type.toLowerCase());
          target.append(list);
        }
        const item = document.createElement('li');
        appendInline(item, bullet[3]);
        list.append(item);
        continue;
      }
      list = undefined;
      if (!line.trim()) continue;
      const heading = line.match(/^#{1,6}\s+(.*)/);
      const block = document.createElement(heading ? 'h4' : 'p');
      appendInline(block, heading ? heading[1] : line);
      target.append(block);
    }
  }
}
