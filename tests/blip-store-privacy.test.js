import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLIP_LIMITS, createBlipStore } from '../assets/blip-store.js';

test('attachment chats stay local after history rolls over, reloads, and forks', () => {
  const cache = new Map();
  const storage = { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value) };
  const store = createBlipStore({ storage });
  const chat = store.createChat();
  const attachment = { name: 'notes.txt', type: 'text/plain', size: 12, text: 'Private note' };
  assert.ok(store.addMessage(chat.id, 'user', 'Summarize my file.', { attachments: [attachment] }));
  assert.equal(store.getState().chats[0].localOnly, true);
  for (let index = 0; index < BLIP_LIMITS.messages; index++) {
    assert.ok(store.addMessage(chat.id, 'user', 'Follow-up ' + index));
  }
  const restored = createBlipStore({ storage });
  const recent = restored.getState().chats[0];
  assert.equal(recent.messages.length, BLIP_LIMITS.messages);
  assert.equal(recent.messages.some(message => message.attachments?.length), false);
  assert.equal(recent.localOnly, true);
  assert.equal(restored.forkChatBefore(chat.id, recent.messages.at(-1).id).localOnly, true);
  assert.ok(!restored.createChat().localOnly);
});
