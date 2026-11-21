import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipBlipContext, recentBlipTurns } from '../assets/blip-context.js';

test('a short context window keeps whole recent exchanges and skips orphaned replies', () => {
  const prior = [
    { role: 'assistant', content: 'Earlier answer with no retained question' },
    { role: 'user', content: 'First question' },
    { role: 'assistant', content: 'First reply' },
    { role: 'user', content: 'Latest question' },
    { role: 'assistant', content: 'Latest reply' },
  ];
  const packed = recentBlipTurns(prior, { maxChars: 60, maxMessages: 3, maxMessageChars: 30 });
  assert.deepEqual(packed, [prior.slice(-2)]);
});

test('excerpts retain both ends of long inputs within a Unicode-safe budget', () => {
  const prompt = 'CODE START: ' + '🙂'.repeat(550) + ' LAST ERROR';
  const excerpt = clipBlipContext(prompt, 63);
  assert.ok(excerpt.length <= 63);
  assert.match(excerpt, /^CODE START: .*\n\[…\]\n.* LAST ERROR$/u);
  assert.doesNotMatch(excerpt, /[\uD800-\uDFFF]/u);
});
