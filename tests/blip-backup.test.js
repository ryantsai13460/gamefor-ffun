import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLIP_LIMITS, BLIP_STORE_KEY, createBlipStore } from '../assets/blip-store.js';

function browserStorage() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}

test('Blip backs up chat records, restores fresh copies, and preserves local-only attachments', () => {
  const storage = browserStorage();
  storage.setItem('provider-credential', 'secret-value');
  const source = createBlipStore({ storage });
  const lesson = source.createChat({ title: 'Study — 复习', mode: 'study' });
  source.setPinned(lesson.id, true);
  const attachment = { name: 'review.txt', type: 'text/plain', size: 10, text: 'Study note' };
  source.addMessage(lesson.id, 'user', 'Please summarize.', { attachments: [attachment] });
  source.addMessage(lesson.id, 'assistant', 'Your notes are ready.', { kind: 'local' });
  source.createChat({ title: 'Other conversation', mode: 'code' });

  const raw = source.exportBackup();
  const backup = JSON.parse(raw);
  assert.deepEqual(Object.keys(backup), ['format', 'version', 'chats']);
  assert.ok(!raw.includes('secret-value'));
  assert.equal(source.importBackup(raw), 2);
  const { chats, activeId } = createBlipStore({ storage }).getState();
  assert.equal(chats.length, 4);
  const copies = chats.filter(chat => chat.title === lesson.title);
  assert.equal(copies.length, 2);
  const restored = copies.find(chat => chat.id !== lesson.id);
  assert.ok(restored);
  assert.ok(chats.some(chat => chat.id === activeId && !backup.chats.some(previous => previous.id === chat.id)));
  assert.equal(restored.mode, 'study');
  assert.equal(restored.pinned, true);
  assert.equal(restored.localOnly, true);
  assert.deepEqual(restored.messages, copies.find(chat => chat.id === lesson.id).messages);
  assert.equal(restored.messages[0].attachments[0].text, 'Study note');
});

test('invalid or unsavable backups leave Blip memory and storage intact', () => {
  const storage = browserStorage();
  const store = createBlipStore({ storage });
  const original = store.createChat({ title: 'Keep this chat' });
  store.addMessage(original.id, 'user', 'Keep this message.');
  const state = store.getState();
  const saved = storage.getItem(BLIP_STORE_KEY);
  const raw = store.exportBackup();
  const malformed = JSON.parse(raw);
  malformed.chats[0].messages.push(malformed.chats[0].messages[0]);
  assert.throws(() => store.importBackup(JSON.stringify(malformed)), /invalid conversations or messages/);
  assert.throws(() => store.importBackup(JSON.stringify({ ...malformed, version: 2 })), /supported Blip/);
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => store.importBackup(raw), /could not save/);
  assert.equal(store.getState(), state);
  assert.equal(storage.getItem(BLIP_STORE_KEY), saved);
  assert.equal(store.isPersistent(), true);
});

test('a full Blip backup fits an untouched new library and preserves a real chat at the limit', () => {
  const source = createBlipStore({ storage: null });
  for (let i = 1; i <= BLIP_LIMITS.chats; i++) source.createChat({ title: `Conversation ${i}` });
  const raw = source.exportBackup();
  const target = createBlipStore({ storage: null });
  const placeholder = target.createChat();
  const unchanged = target.getState();
  assert.throws(() => target.importBackup(raw), /40-conversation limit/);
  assert.equal(target.getState(), unchanged);
  assert.equal(target.importBackup(raw, { emptyChatId: placeholder.id }), BLIP_LIMITS.chats);
  assert.equal(target.getState().chats.length, BLIP_LIMITS.chats);
  assert.ok(!target.getState().chats.some(chat => chat.id === placeholder.id));
  assert.equal(target.isPersistent(), false);
});

test('restoring with stale Blip state preserves changes made from another tab', () => {
  const storage = browserStorage();
  const first = createBlipStore({ storage });
  first.createChat({ title: 'First conversation' });
  const backup = first.exportBackup();
  const second = createBlipStore({ storage });
  second.createChat({ title: 'Created in another tab' });
  const saved = storage.getItem(BLIP_STORE_KEY);

  assert.throws(() => first.importBackup(backup), /Saved conversations changed/);
  assert.equal(first.getState().chats.length, 1);
  assert.equal(storage.getItem(BLIP_STORE_KEY), saved);
  assert.equal(createBlipStore({ storage }).importBackup(backup), 1);
});
