export function clipBlipContext(text, maxChars) {
  if (text.length <= maxChars) return text;
  const gap = '\n[…]\n';
  const available = maxChars - gap.length;
  if (available < 12) return text.slice(0, maxChars);
  const headLength = Math.floor(available * .6);
  const tailLength = available - headLength;
  const head = text.slice(0, headLength).replace(/[\uD800-\uDBFF]$/, '');
  const tail = text.slice(-tailLength).replace(/^[\uDC00-\uDFFF]/, '');
  return head + gap + tail;
}

export function recentBlipTurns(messages, { maxChars, maxMessages, maxMessageChars }) {
  const turns = [];
  const perMessage = Math.min(maxMessageChars, Math.floor(maxChars / 2));
  if (perMessage < 16) return [];
  for (const message of messages) {
    if (!message.content.trim()) continue;
    const item = { role: message.role, content: clipBlipContext(message.content, perMessage) };
    if (message.role === 'user') {
      turns.push([item]);
    } else if (message.role === 'assistant' && turns.length) {
      turns.at(-1)[1] = item;
    }
  }
  const window = [];
  let chars = 0;
  let messagesUsed = 0;
  for (const turn of turns.reverse()) {
    const cost = turn.reduce((sum, message) => sum + message.content.length, 0);
    if (chars + cost > maxChars || messagesUsed + turn.length > maxMessages) break;
    chars += cost;
    messagesUsed += turn.length;
    window.unshift(turn);
  }
  return window;
}
