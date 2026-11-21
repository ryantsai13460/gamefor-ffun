import { normalizeBlipAttachments } from './blip-files.js';

export const BLIP_STORE_KEY = 'gamefor-ffun:blip:v1';
export const BLIP_MODES = Object.freeze(['quick', 'think', 'brainstorm', 'study']);
export const DEFAULT_BLIP_MODE = 'quick';
export const BLIP_LIMITS = Object.freeze({ chats: 40, messages: 100, title: 100, message: 12000 });

const defaultTitle = 'New chat';
const version = 1;
const maxSerializedLength = 2_000_000;
const roles = new Set(['user', 'assistant']);
const answerKinds = new Set(['model', 'hosted', 'local', 'calculator', 'conversion', 'wikipedia', 'unavailable']);
const idPattern = /^[a-z0-9_-]{1,96}$/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value, limit) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= limit ? text : null;
}

function validId(value) {
  return typeof value === 'string' && idPattern.test(value);
}

function timestamp(value, fallback, now) {
  return Number.isSafeInteger(value) && value >= 0 && value <= now ? value : fallback;
}

function wikipediaSource(value) {
  if (!isObject(value)) return null;
  const title = boundedText(value.title, 300);
  const address = boundedText(value.url, 2048);
  if (!title || !address) return null;

  try {
    const url = new URL(address);
    if (url.origin !== 'https://en.wikipedia.org' || url.username || url.password) return null;

    // Keep the article identifier and drop all other URL parameters.
    const article = url.searchParams.get('curid');
    if (url.pathname === '/' && /^[1-9][0-9]{0,14}$/.test(article || '')) {
      return Object.freeze({ title, url: url.origin + '/?curid=' + article });
    }
    if (url.pathname.startsWith('/wiki/') && url.pathname.length > '/wiki/'.length) {
      return Object.freeze({ title, url: url.origin + url.pathname });
    }
  } catch {
    // Invalid citations should never prevent a conversation from opening.
  }
  return null;
}

function researchSources(values) {
  if (!Array.isArray(values)) return [];
  const sources = [];
  for (const value of values.slice(0, 4)) {
    const title = boundedText(value?.title, 180);
    const address = boundedText(value?.url, 2048);
    if (!title || !address) continue;
    let url;
    try {
      url = new URL(address);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    const description = boundedText(value.description, 360) || '';
    sources.push(Object.freeze({ title, url: url.href, description }));
  }
  return Object.freeze(sources);
}

function messageRecord(id, role, value, createdAt, details) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length > BLIP_LIMITS.message) return null;

  const message = { id, role, text, createdAt };
  if (role === 'user') {
    const attachments = normalizeBlipAttachments(details?.attachments);
    if (attachments.length) message.attachments = attachments;
  } else if (isObject(details)) {
    if (answerKinds.has(details.kind)) message.kind = details.kind;
    const source = wikipediaSource(details.source);
    if (source) message.source = source;
    const sources = researchSources(details.sources);
    if (sources.length) message.sources = sources;
  }
  if (!text && !message.attachments) return null;
  return Object.freeze(message);
}

function restoreMessages(value, now) {
  const messages = [];
  if (!Array.isArray(value)) return messages;

  const seen = new Set();
  for (let index = value.length - 1; index >= 0 && messages.length < BLIP_LIMITS.messages; index--) {
    const record = value[index];
    if (!isObject(record) || !validId(record.id) || !roles.has(record.role) || seen.has(record.id)) continue;
    const message = messageRecord(record.id, record.role, record.text, timestamp(record.createdAt, now, now), record);
    if (!message) continue;

    seen.add(record.id);
    messages.push(message);
  }
  return messages.reverse();
}

function snapshot(activeId, chats) {
  return Object.freeze({ activeId, chats: Object.freeze(chats) });
}

function restoreState(raw) {
  if (typeof raw !== 'string' || raw.length > maxSerializedLength) return snapshot(null, []);

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return snapshot(null, []);
  }
  if (!isObject(saved) || saved.version !== version || !Array.isArray(saved.chats)) return snapshot(null, []);

  const now = Date.now();
  const chats = [];
  const seen = new Set();
  for (const chat of saved.chats) {
    if (chats.length === BLIP_LIMITS.chats) break;
    if (!isObject(chat) || !validId(chat.id) || seen.has(chat.id)) continue;

    const messages = restoreMessages(chat.messages, now);
    const createdAt = messages.reduce((earliest, message) => Math.min(earliest, message.createdAt),
      timestamp(chat.createdAt, messages[0]?.createdAt ?? now, now));
    const updatedAt = messages.reduce((latest, message) => Math.max(latest, message.createdAt),
      Math.max(createdAt, timestamp(chat.updatedAt, createdAt, now)));

    seen.add(chat.id);
    chats.push(Object.freeze({
      id: chat.id,
      title: boundedText(chat.title, BLIP_LIMITS.title) || defaultTitle,
      mode: BLIP_MODES.includes(chat.mode) ? chat.mode : DEFAULT_BLIP_MODE,
      createdAt,
      updatedAt,
      unread: chat.unread === true,
      messages: Object.freeze(messages),
    }));
  }
  chats.sort((first, second) => second.updatedAt - first.updatedAt);
  return snapshot(seen.has(saved.activeId) ? saved.activeId : chats[0]?.id ?? null, chats);
}

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createBlipStore({ storage = browserStorage() } = {}) {
  let persistent = false;
  let state = snapshot(null, []);
  let idSuffix = 0;

  try {
    if (storage && typeof storage.setItem === 'function') {
      state = restoreState(storage.getItem(BLIP_STORE_KEY));
      persistent = true;
    }
  } catch {
    // Keep the current visit usable if access to browser storage is denied.
  }

  function save(activeId, chats) {
    state = snapshot(activeId, chats);
    if (!storage) return;

    try {
      const serialized = JSON.stringify({ version, ...state });
      if (serialized.length > maxSerializedLength) {
        persistent = false;
        return;
      }
      storage.setItem(BLIP_STORE_KEY, serialized);
      persistent = true;
    } catch {
      persistent = false;
    }
  }

  function newId(prefix, exists) {
    const random = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const base = prefix + '-' + random;
    let id = base;
    while (exists(id)) id = base + '-' + (++idSuffix);
    return id;
  }

  function getChat(id) {
    return state.chats.find(chat => chat.id === id) || null;
  }

  function saveChat(chat, { activeId = state.activeId, first = false } = {}) {
    const chats = first
      ? [chat, ...state.chats.filter(previous => previous.id !== chat.id)]
      : state.chats.map(previous => previous.id === chat.id ? chat : previous);
    save(activeId, chats);
    return chat;
  }

  function readChat(chat) {
    return chat.unread ? Object.freeze({ ...chat, unread: false }) : chat;
  }

  return Object.freeze({
    getState: () => state,
    isPersistent: () => persistent,

    createChat({ title = defaultTitle, mode = DEFAULT_BLIP_MODE } = {}) {
      if (state.chats.length >= BLIP_LIMITS.chats || !BLIP_MODES.includes(mode)) return null;
      title = boundedText(title, BLIP_LIMITS.title);
      if (!title) return null;

      const now = Date.now();
      const id = newId('chat', candidate => Boolean(getChat(candidate)));
      return saveChat(Object.freeze({
        id, title, mode, createdAt: now, updatedAt: now, unread: false, messages: Object.freeze([]),
      }), { activeId: id, first: true });
    },

    forkChatBefore(id, messageId) {
      const chat = getChat(id);
      if (!chat || state.chats.length >= BLIP_LIMITS.chats) return null;
      const index = chat.messages.findIndex(message => message.id === messageId && message.role === 'user');
      if (index === -1) return null;
      const forkId = newId('chat', candidate => Boolean(getChat(candidate)));
      const suffix = ' (edited)';
      const title = chat.title.slice(0, BLIP_LIMITS.title - suffix.length).trimEnd() + suffix;
      const now = Date.now();
      const messages = Object.freeze(chat.messages.slice(0, index));
      return saveChat(Object.freeze({
        id: forkId, title, mode: chat.mode, createdAt: messages[0]?.createdAt ?? now,
        updatedAt: now, unread: false, messages,
      }), { activeId: forkId, first: true });
    },

    selectChat(id) {
      const chat = getChat(id);
      if (!chat) return null;

      const read = readChat(chat);
      return state.activeId === id && read === chat ? chat : saveChat(read, { activeId: id });
    },

    renameChat(id, value) {
      const chat = getChat(id);
      const title = boundedText(value, BLIP_LIMITS.title);
      if (!chat || !title) return null;
      return chat.title === title ? chat : saveChat(Object.freeze({ ...chat, title }));
    },

    setMode(id, mode) {
      const chat = getChat(id);
      if (!chat || !BLIP_MODES.includes(mode)) return null;
      return chat.mode === mode ? chat : saveChat(Object.freeze({ ...chat, mode }));
    },

    setUnread(id, unread = true) {
      const chat = getChat(id);
      if (!chat || typeof unread !== 'boolean') return null;
      return chat.unread === unread ? chat : saveChat(Object.freeze({ ...chat, unread }));
    },

    deleteChat(id) {
      if (!getChat(id)) return false;
      const remaining = state.chats.filter(chat => chat.id !== id);
      let activeId = state.activeId;
      if (id === activeId) {
        activeId = remaining[0]?.id ?? null;
        if (remaining[0]) remaining[0] = readChat(remaining[0]);
      }
      save(activeId, remaining);
      return true;
    },

    addMessage(id, role, value, details) {
      const chat = getChat(id);
      if (!chat || !roles.has(role)) return null;

      const now = Math.max(chat.updatedAt, Date.now());
      const messageId = newId('message', candidate => chat.messages.some(message => message.id === candidate));
      const message = messageRecord(messageId, role, value, now, details);
      if (!message) return null;
      const messages = Object.freeze([...chat.messages, message].slice(-BLIP_LIMITS.messages));
      const unread = chat.unread || (role === 'assistant' && state.activeId !== id);
      saveChat(Object.freeze({ ...chat, updatedAt: now, messages, unread }), { first: true });
      return message;
    },
    replaceAssistantReply(id, messageId, value, details) {
      const chat = getChat(id);
      const last = chat?.messages.at(-1);
      if (last?.role !== 'assistant' || last.id !== messageId) return null;
      const now = Math.max(chat.updatedAt, Date.now());
      const reply = messageRecord(messageId, 'assistant', value, now, details);
      if (!reply) return null;
      const messages = Object.freeze([...chat.messages.slice(0, -1), reply]);
      const unread = chat.unread || state.activeId !== id;
      saveChat(Object.freeze({ ...chat, updatedAt: now, messages, unread }), { first: true });
      return reply;
    },
  });
}
