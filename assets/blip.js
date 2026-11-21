import { BLIP_FILE_ACCEPT, BLIP_FILE_LIMITS, normalizeBlipAttachments, readBlipFiles } from './blip-files.js';
import { mountBlipMusic } from './blip-music.js';

const assetVersion = new URL(import.meta.url).search;
const [{ BLIP_LIMITS, createBlipStore }, {
  answerBlip, blipModelAvailability, blipModes, cpuBlipAvailability, portableBlipAvailability,
  prepareBlipModel, prepareCpuBlipModel, preparePortableBlipModel,
  releaseCpuBlipModel, releasePortableBlipModel
}, { formatBlipReply }, { gatewayConnected, hostedBlipReply, renderGatewaySettings }] = await Promise.all([
  import(`./blip-store.js${assetVersion}`),
  import(`./blip-answer.js${assetVersion}`),
  import(`./blip-format.js${assetVersion}`),
  import(`./service-gateway.js${assetVersion}`)
]);

const examples = [
  ['Make a plan', 'Help me make a 20-minute study plan.', 'study'],
  ['Think it through', 'Compare two ways to start learning guitar.', 'think'],
  ['Brainstorm ideas', 'Brainstorm three ideas for a weekend game project.', 'brainstorm'],
  ['Convert units', 'Convert 5 miles to km', 'quick']
];

const messageSources = {
  model: 'On-device AI',
  hosted: 'Connected AI model',
  local: 'Local reply',
  calculator: 'Calculator',
  conversion: 'Unit converter',
  wikipedia: 'Wikipedia excerpt',
  unavailable: 'Blip unavailable'
};

const stages = {
  checking: 'Checking available tools…',
  generating: 'On-device AI is working…',
  searching: 'Looking up a Wikipedia reference…'
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text, action, className) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function messageView(message, { onEdit, onRetry } = {}) {
  const item = element('article', `blip-message blip-message--${message.role}`);
  item.append(element('h3', 'blip-message-author', message.role === 'user' ? 'You' : 'blip.ai'));
  if (message.kind) item.append(element('p', 'blip-answer-source', messageSources[message.kind]));
  let body;
  if (message.text) {
    body = element('div', 'blip-message-text');
    if (message.role === 'assistant') formatBlipReply(body, message.text);
    else body.textContent = message.text;
    item.append(body);
  }
  for (const file of message.attachments || []) {
    const preview = element('details', 'blip-file-preview');
    preview.append(
      element('summary', '', file.name + (file.truncated ? ' · excerpt' : '')),
      element('pre', '', file.text)
    );
    item.append(preview);
  }
  if (message.source) {
    const reference = element('a', 'blip-reference', `Wikipedia · ${message.source.title}`);
    reference.href = message.source.url;
    reference.target = '_blank';
    reference.rel = 'noopener noreferrer';
    const license = element('a', 'blip-reference', 'CC BY-SA 4.0');
    license.href = 'https://creativecommons.org/licenses/by-sa/4.0/';
    license.target = '_blank';
    license.rel = 'noopener noreferrer';
    const credits = element('div', 'blip-credits');
    credits.append(reference, license);
    item.append(credits);
  }
  if (message.sources?.length) {
    const citations = element('section', 'blip-web-citations');
    const list = element('ol');
    citations.append(element('h4', '', 'Research sources'), list);
    for (const source of message.sources) {
      const entry = element('li');
      const reference = element('a', 'blip-reference', source.title);
      reference.href = source.url;
      reference.target = '_blank';
      reference.rel = 'noopener noreferrer';
      entry.append(reference);
      if (source.description) entry.append(element('p', '', source.description));
      list.append(entry);
    }
    item.append(citations);
  }
  const canCopy = message.role === 'assistant' && body;
  if (canCopy || onEdit || onRetry) {
    const actions = element('div', 'blip-answer-actions');
    if (canCopy) {
      const feedback = element('span', 'blip-copy-feedback');
      feedback.setAttribute('role', 'status');
      const copy = button('Copy response', async () => {
        try {
          await navigator.clipboard.writeText(message.text);
          feedback.textContent = 'Response copied.';
        } catch {
          const selection = window.getSelection();
          if (selection && body.isConnected) {
            const range = document.createRange();
            range.selectNodeContents(body);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          feedback.textContent = selection ? 'Clipboard unavailable. You can copy the selected response manually.'
            : 'Clipboard unavailable. Select the response to copy it.';
        }
      }, 'blip-button');
      actions.append(copy, feedback);
    }
    if (onEdit) actions.append(button('Edit & resend', onEdit, 'blip-button'));
    if (onRetry) actions.append(button('Regenerate', onRetry, 'blip-button'));
    item.append(actions);
  }
  return item;
}

export function renderBlip(target) {
  const root = element('section', 'blip');
  root.innerHTML = `
    <header class="blip-header">
      <div class="blip-brand">
        <span class="blip-mark" aria-hidden="true"></span>
        <h1>blip<span>.ai</span></h1>
      </div>
      <div class="blip-header-tools">
        <details class="blip-popover blip-music-popover">
          <summary>Music</summary>
          <div class="blip-popover-content" data-blip="music"></div>
        </details>
        <details class="blip-popover blip-settings-popover">
          <summary><span class="blip-model-dot" aria-hidden="true"></span><span data-blip="settings-label">AI settings</span></summary>
          <div class="blip-popover-content">
            <h2>On-device AI</h2>
            <p data-blip="model-status" role="status">Checking this browser for a model…</p>
            <button class="blip-button blip-button--primary" type="button" data-blip="enable" hidden>Enable on-device AI</button>
            <p data-blip="cpu-status" role="status" hidden></p>
            <button class="blip-button blip-button--primary" type="button" data-blip="cpu" hidden>Start CPU AI</button>
            <p data-blip="portable-status" role="status"></p>
            <button class="blip-button" type="button" data-blip="portable" hidden>Start local AI</button>
            <label class="blip-check"><input type="checkbox" data-blip="references"> Use Wikipedia as a fallback</label>
            <p>Short questions in chats without files can use this lookup.</p>
            <div data-blip="gateway"></div>
            <label class="blip-check"><input type="checkbox" data-blip="hosted"> Use the connected model for chats without files</label>
            <p>When enabled, the current question and recent messages are sent to your backend.</p>
            <label class="blip-check"><input type="checkbox" data-blip="research" disabled> Research current question with Brave Search</label>
            <p>With the connected model enabled, questions up to 200 characters go to Brave Search through your backend and use its search quota.</p>
          </div>
        </details>
      </div>
    </header>
    <div class="blip-layout" data-chats-open="false">
      <aside class="blip-rail" id="blip-chats" aria-label="Saved conversations">
        <button class="blip-button blip-button--primary blip-new-chat" data-blip="new" type="button"><span aria-hidden="true">+</span> New chat</button>
        <h2>Chats</h2>
        <input class="blip-chat-search" type="search" data-blip="chat-search" aria-label="Search chats" placeholder="Search chats" maxlength="200" autocomplete="off">
        <ul class="blip-chat-list" data-blip="chats"></ul>
        <p class="blip-chat-empty" data-blip="chat-empty" hidden>No conversations match your search.</p>
        <p class="blip-privacy" data-blip="privacy"></p>
      </aside>
      <section class="blip-thread" aria-label="Chat workspace">
        <header class="blip-thread-header">
          <button class="blip-button blip-chat-toggle" data-blip="toggle" type="button" aria-controls="blip-chats" aria-expanded="false">Chats</button>
          <h2 class="blip-thread-title" data-blip="title">New chat</h2>
          <div class="blip-thread-actions">
            <button class="blip-button" type="button" data-blip="rename">Rename</button>
            <button class="blip-button" type="button" data-blip="delete">Delete</button>
          </div>
        </header>
        <div class="blip-transcript" data-blip="transcript" tabindex="0" role="region" aria-label="Conversation messages">
          <div class="blip-welcome" data-blip="welcome">
            <span class="blip-mark blip-mark--large" aria-hidden="true"></span>
            <h2>What are you curious about?</h2>
            <p>Ask a question or try one of these prompts.</p>
            <div class="blip-prompts" data-blip="prompts"></div>
            <button class="blip-button blip-welcome-setup" type="button" data-blip="setup-shortcut" hidden>Set up AI for generated replies</button>
          </div>
          <div class="blip-messages" data-blip="messages"></div>
        </div>
        <form class="blip-compose" data-blip="compose">
          <fieldset class="blip-modes" aria-describedby="blip-mode-description">
            <legend>Thinking method</legend>
            <div class="blip-mode-choices" data-blip="modes"></div>
            <p class="blip-mode-description" id="blip-mode-description" data-blip="mode-description"></p>
          </fieldset>
          <div class="blip-editing-note" data-blip="revising" hidden>
            <span>Resending starts a new chat from this message and keeps the original.</span>
            <button class="blip-button" type="button" data-blip="cancel-revision">Cancel edit</button>
          </div>
          <ul class="blip-attachments" data-blip="attachments" aria-label="Files attached to this draft" hidden></ul>
          <button class="blip-button blip-attachment-clear" type="button" data-blip="clear-files" hidden>Clear attachments</button>
          <p class="blip-compose-status" data-blip="file-status" role="status"></p>
          <div class="blip-prompt-box">
            <button class="blip-button blip-attach" type="button" data-blip="attach" title="TXT, Markdown, CSV, TSV, or JSON">Attach files</button>
            <input type="file" data-blip="file-input" aria-label="Choose files to attach" multiple hidden>
            <label class="sr-only" for="blip-prompt">Message blip.ai</label>
            <textarea id="blip-prompt" data-blip="input" rows="2" maxlength="2000" enterkeyhint="send" placeholder="Message blip.ai…"></textarea>
            <button class="blip-button blip-button--primary" data-blip="send" type="submit">Send</button>
            <button class="blip-button" data-blip="stop" type="button" hidden>Stop</button>
          </div>
          <p class="blip-compose-status" data-blip="status" role="status"></p>
        </form>
      </section>
    </div>
    <dialog class="blip-dialog blip-attachment-dialog" data-blip="attachment-dialog" aria-labelledby="blip-attachment-title">
      <h2 id="blip-attachment-title" data-blip="attachment-title"></h2>
      <p class="blip-attachment-metadata" data-blip="attachment-metadata"></p>
      <pre class="blip-attachment-preview-text" data-blip="attachment-preview" tabindex="0"></pre>
      <div class="blip-dialog-actions">
        <button class="blip-button" type="button" data-blip="close-attachment">Close</button>
      </div>
    </dialog>
    <dialog class="blip-dialog" data-blip="chat-dialog" aria-labelledby="blip-dialog-title">
      <form data-blip="chat-edit">
        <h2 id="blip-dialog-title" data-blip="edit-title"></h2>
        <p data-blip="edit-text" hidden></p>
        <label class="blip-name-label">Chat name <input type="text" data-blip="chat-name" autocomplete="off"></label>
        <p class="blip-edit-error" data-blip="edit-error" role="status"></p>
        <div class="blip-dialog-actions">
          <button class="blip-button" data-blip="cancel-edit" type="button">Cancel</button>
          <button class="blip-button blip-button--primary" data-blip="confirm-edit" type="submit"></button>
        </div>
      </form>
    </dialog>`;
  target.replaceChildren(root);

  const part = key => root.querySelector(`[data-blip="${key}"]`);
  const store = createBlipStore();
  const lifetime = new AbortController();
  const pending = new Map();
  const drafts = new Map();
  const draftFiles = new Map();
  const fileNotices = new Map();
  const readingFiles = new Set();
  const revisions = new Map();
  const modeInputs = new Map();
  const layout = root.querySelector('.blip-layout');
  const modelSettings = root.querySelector('.blip-settings-popover');
  const musicSettings = root.querySelector('.blip-music-popover');
  const composer = part('compose');
  const transcript = part('transcript');
  const status = part('status');
  const input = part('input');
  const chatSearch = part('chat-search');
  const fileInput = part('file-input');
  fileInput.accept = BLIP_FILE_ACCEPT;
  const dialog = part('chat-dialog');
  const attachmentDialog = part('attachment-dialog');
  const nameInput = part('chat-name');
  const nameLabel = nameInput.closest('label');
  const stopMusic = mountBlipMusic(part('music'));
  renderGatewaySettings(part('gateway'), 'Connect an AI provider');
  const musicLink = element('a', 'blip-button', 'Open Music library');
  musicLink.href = '#music';
  part('music').append(musicLink);
  let edit;
  let nativeStatus = 'unavailable';
  let cpuStatus = 'unavailable';
  let portableStatus = 'unavailable';
  let setupRunning = false;

  const currentChat = () => {
    const { chats, activeId } = store.getState();
    return chats.find(chat => chat.id === activeId);
  };

  function showChats(open) {
    layout.dataset.chatsOpen = String(open);
    part('toggle').setAttribute('aria-expanded', String(open));
  }

  function drawRail() {
    const { chats, activeId } = store.getState();
    const query = chatSearch.value.trim().toLocaleLowerCase();
    const visible = query ? chats.filter(chat => chat.title.toLocaleLowerCase().includes(query) ||
      chat.messages.some(message => message.text.toLocaleLowerCase().includes(query))) : chats;
    const items = visible.map(chat => {
      const item = element('li');
      const open = button(chat.title, () => {
        if (store.selectChat(chat.id)) {
          draw();
          showChats(false);
          input.focus({ preventScroll: true });
        }
      }, 'blip-chat-link');
      if (chat.id === activeId) open.setAttribute('aria-current', 'true');
      if (chat.unread) {
        open.classList.add('has-unread');
        open.append(element('span', 'sr-only', ' · New reply'));
      }
      item.append(open);
      return item;
    });
    part('chats').replaceChildren(...items);
    part('chat-empty').hidden = !query || Boolean(items.length);
    part('new').disabled = chats.length >= BLIP_LIMITS.chats;
    part('privacy').textContent = chats.length >= BLIP_LIMITS.chats
      ? `This browser can keep up to ${BLIP_LIMITS.chats} chats.`
      : store.isPersistent() ? 'Chats are saved in this browser.' : 'Storage is unavailable. Chats last for this visit.';
  }

  function drawComposer(chat) {
    const revision = revisions.get(chat?.id);
    const currentMode = blipModes[revision?.mode || chat?.mode] || blipModes.quick;
    const request = pending.get(chat?.id);
    for (const [id, option] of modeInputs) option.checked = currentMode.id === id;
    part('mode-description').textContent = currentMode.description;
    part('stop').hidden = !request;
    part('send').hidden = Boolean(request);
    part('send').disabled = readingFiles.has(chat?.id);
    part('send').textContent = revision ? 'Resend in new chat' : 'Send';
    part('revising').hidden = !revision;
    part('cancel-revision').disabled = readingFiles.has(chat?.id);
    status.textContent = request?.label || '';
    drawDraftFiles(chat?.id);
  }

  function drawDraftFiles(id) {
    const files = draftFiles.get(id) || [];
    const reading = readingFiles.has(id);
    const list = part('attachments');
    const clear = part('clear-files');
    clear.hidden = !files.length;
    clear.disabled = reading;
    list.hidden = !files.length;
    list.replaceChildren(...files.map((file, index) => {
      const item = element('li', 'blip-file-chip');
      item.append(element('span', '', file.name + (file.truncated ? ' · excerpt' : '')));
      const preview = button('Preview', () => showAttachment(file), 'blip-button');
      preview.setAttribute('aria-label', 'Preview ' + file.name);
      const remove = button('Remove', () => {
        if (readingFiles.has(id)) return;
        draftFiles.set(id, files.filter((_, fileIndex) => fileIndex !== index));
        drawDraftFiles(id);
        part('attach').focus();
      }, 'blip-button');
      remove.disabled = reading;
      remove.setAttribute('aria-label', 'Remove ' + file.name);
      item.append(preview, remove);
      return item;
    }));
    part('attach').disabled = !id || reading || files.length >= BLIP_FILE_LIMITS.count;
    part('file-status').textContent = fileNotices.get(id) || '';
  }

  function showAttachment(file) {
    const size = file.size < 1024 ? `${file.size} bytes` : `${(file.size / 1024).toFixed(1)} KiB`;
    part('attachment-title').textContent = file.name;
    part('attachment-metadata').textContent = file.truncated ? `${size} · Preview uses a text excerpt` : size;
    part('attachment-preview').textContent = file.text;
    attachmentDialog.showModal();
    part('close-attachment').focus();
  }

  function beginMessageEdit(chat, message) {
    if (pending.has(chat.id)) return;
    if (readingFiles.has(chat.id)) {
      status.textContent = 'Wait for the attached files to finish reading before editing.';
      return;
    }
    const original = revisions.get(chat.id) || {
      draft: drafts.get(chat.id), files: draftFiles.get(chat.id), notice: fileNotices.get(chat.id)
    };
    revisions.set(chat.id, { ...original, messageId: message.id });
    drafts.set(chat.id, message.text);
    draftFiles.set(chat.id, message.attachments || []);
    fileNotices.delete(chat.id);
    input.value = message.text;
    drawComposer(chat);
    input.focus({ preventScroll: true });
  }

  function restoreDraft(id) {
    const revision = revisions.get(id);
    if (!revision) return;
    for (const [map, value] of [[drafts, revision.draft], [draftFiles, revision.files], [fileNotices, revision.notice]]) {
      if (value === undefined) map.delete(id);
      else map.set(id, value);
    }
    revisions.delete(id);
  }

  function draw() {
    const chat = currentChat();
    drawRail();
    part('title').textContent = chat?.title || 'New chat';
    part('rename').disabled = part('delete').disabled = !chat;
    input.disabled = !chat;
    input.value = drafts.get(chat?.id) || '';
    part('welcome').hidden = Boolean(chat?.messages.length);
    const messages = chat?.messages || [];
    const items = messages.map((message, index) => messageView(message, {
      onEdit: message.role === 'user' && !pending.has(chat.id) ? () => beginMessageEdit(chat, message) : undefined,
      onRetry: message.role === 'assistant' && index === messages.length - 1 && !pending.has(chat.id)
        ? () => retryReply(chat, message.id) : undefined
    }));
    part('messages').replaceChildren(...items);
    drawPartial(chat?.id);
    drawComposer(chat);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function drawPartial(id) {
    let partial = part('messages').querySelector('.blip-reply-stream');
    const text = pending.get(id)?.partial;
    if (!text) {
      partial?.remove();
      return;
    }
    if (!partial) {
      partial = messageView({ role: 'assistant', kind: 'hosted' });
      partial.classList.add('blip-reply-stream');
      partial.append(element('p', 'blip-message-text'));
      part('messages').append(partial);
    }
    partial.lastElementChild.textContent = text;
    transcript.scrollTop = transcript.scrollHeight;
  }

  for (const mode of Object.values(blipModes)) {
    const label = element('label', 'blip-mode');
    const option = element('input', 'sr-only');
    option.type = 'radio';
    option.name = 'blip-mode';
    option.value = mode.id;
    option.addEventListener('change', () => {
      const chat = currentChat();
      if (!chat || !option.checked) return;
      const revision = revisions.get(chat.id);
      if (revision) {
        revision.mode = mode.id;
        drawComposer(chat);
      } else {
        drawComposer(store.setMode(chat.id, mode.id));
      }
    });
    label.append(option, element('span', '', mode.label));
    part('modes').append(label);
    modeInputs.set(mode.id, option);
  }

  for (const [label, prompt, mode] of examples) {
    part('prompts').append(button(label, () => {
      const chat = currentChat();
      if (!chat) return;
      drafts.set(chat.id, prompt);
      input.value = prompt;
      drawComposer(store.setMode(chat.id, mode));
      input.focus({ preventScroll: true });
    }, 'blip-example'));
  }

  part('new').addEventListener('click', () => {
    if (!store.createChat()) return;
    chatSearch.value = '';
    draw();
    showChats(false);
    input.focus({ preventScroll: true });
  });
  chatSearch.addEventListener('input', drawRail);
  part('toggle').addEventListener('click', () => showChats(layout.dataset.chatsOpen !== 'true'));
  part('attach').addEventListener('click', () => fileInput.click());
  part('close-attachment').addEventListener('click', () => attachmentDialog.close());
  attachmentDialog.addEventListener('close', () => { part('attachment-preview').textContent = ''; });
  part('clear-files').addEventListener('click', () => {
    const id = store.getState().activeId;
    if (!id || readingFiles.has(id)) return;
    draftFiles.delete(id);
    fileNotices.delete(id);
    drawDraftFiles(id);
    part('attach').focus({ preventScroll: true });
  });
  part('cancel-revision').addEventListener('click', () => {
    const chat = currentChat();
    if (!chat || readingFiles.has(chat.id)) return;
    restoreDraft(chat.id);
    input.value = drafts.get(chat.id) || '';
    drawComposer(chat);
    input.focus({ preventScroll: true });
  });
  part('hosted').addEventListener('change', () => {
    const enabled = part('hosted').checked;
    part('research').disabled = !enabled;
    if (!enabled) part('research').checked = false;
  });
  fileInput.addEventListener('change', async () => {
    const id = store.getState().activeId;
    const selected = [...fileInput.files];
    fileInput.value = '';
    if (!id || !selected.length || readingFiles.has(id)) return;
    readingFiles.add(id);
    fileNotices.set(id, 'Reading selected files…');
    drawComposer(currentChat());
    try {
      const slots = BLIP_FILE_LIMITS.count - (draftFiles.get(id)?.length || 0);
      const { attachments, errors } = await readBlipFiles(selected.slice(0, slots));
      if (lifetime.signal.aborted || !store.getState().chats.some(chat => chat.id === id)) return;
      const existing = draftFiles.get(id) || [];
      const combined = [...existing, ...attachments.filter(file =>
        !existing.some(other => other.name === file.name && other.size === file.size && other.text === file.text))];
      draftFiles.set(id, normalizeBlipAttachments(combined));
      const note = errors.map(error => `${error.name} · ${error.message}`);
      if (selected.length > slots) note.push('Attach up to three files per message.');
      fileNotices.set(id, note.join(' '));
    } catch {
      fileNotices.set(id, 'The browser could not read these files.');
    } finally {
      readingFiles.delete(id);
      if (!lifetime.signal.aborted && store.getState().activeId === id) drawComposer(currentChat());
    }
  });
  input.addEventListener('input', () => drafts.set(store.getState().activeId, input.value));
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (pending.has(store.getState().activeId) || readingFiles.has(store.getState().activeId)) return;
    event.preventDefault();
    composer.requestSubmit(part('send'));
  });

  composer.addEventListener('submit', async event => {
    event.preventDefault();
    let chat = currentChat();
    const text = input.value.trim();
    if (!chat || pending.has(chat.id) || readingFiles.has(chat.id)) return;
    const attachments = draftFiles.get(chat.id) || [];
    if (!text && !attachments.length) {
      status.textContent = 'Enter a message or attach a file.';
      return;
    }
    if (text.length > BLIP_LIMITS.message) {
      status.textContent = 'This message is too long. Shorten it before sending.';
      return;
    }
    const originalId = chat.id;
    const revision = revisions.get(originalId);
    if (revision) {
      const fork = store.forkChatBefore(originalId, revision.messageId);
      if (!fork) {
        status.textContent = store.getState().chats.length >= BLIP_LIMITS.chats
          ? 'Your saved chat list is full. Delete a chat before resending.'
          : 'This edit could not start a new chat. The original is still saved.';
        return;
      }
      chat = revision.mode ? store.setMode(fork.id, revision.mode) || fork : fork;
    }
    if (!store.addMessage(chat.id, 'user', text, { attachments })) {
      if (revision) {
        store.deleteChat(chat.id);
        store.selectChat(originalId);
        draw();
      }
      status.textContent = 'This message could not be saved.';
      return;
    }
    if (!chat.messages.length && chat.title === 'New chat') {
      const compact = (text || attachments[0].name).replace(/\s+/g, ' ');
      store.renameChat(chat.id, compact.length > 60 ? compact.slice(0, 59).trimEnd() + '…' : compact);
    }
    if (revision) {
      restoreDraft(originalId);
      chatSearch.value = '';
    } else {
      drafts.delete(chat.id);
      draftFiles.delete(chat.id);
      fileNotices.delete(chat.id);
    }
    input.focus({ preventScroll: true });
    await runReply(chat, text, attachments);
  });

  function retryReply(chat, messageId) {
    if (pending.has(chat.id)) return;
    const previousUser = chat.messages.findLastIndex(message => message.role === 'user');
    if (previousUser < 0) return;
    const user = chat.messages[previousUser];
    void runReply({ ...chat, messages: chat.messages.slice(0, previousUser) }, user.text, user.attachments || [], messageId);
  }

  async function runReply(chat, text, attachments, replaceId) {
    const request = { controller: new AbortController(), label: stages.checking };
    pending.set(chat.id, request);
    draw();
    let reply;
    try {
      const contextFiles = attachments.length ? attachments :
        chat.messages.findLast(message => message.attachments?.length)?.attachments || [];
      const useHosted = part('hosted').checked && !contextFiles.length;
      if (useHosted && gatewayConnected()) {
        const research = part('research').checked;
        let sources = [];
        request.label = research ? 'Researching and waiting for the connected model…' : 'Waiting for the connected model…';
        if (store.getState().activeId === chat.id) status.textContent = request.label;
        const answer = await hostedBlipReply({
          text, history: chat.messages, mode: chat.mode, research,
          signal: AbortSignal.any([request.controller.signal, AbortSignal.timeout(65000)]),
          onSources(value) { sources = value; },
          onUpdate(value) {
            request.partial = value;
            if (store.getState().activeId === chat.id) drawPartial(chat.id);
          }
        });
        reply = { kind: 'hosted', text: answer, sources };
      } else {
        reply = await answerBlip({
          text,
          attachments: contextFiles,
          history: chat.messages,
          mode: chat.mode,
          wikipedia: part('references').checked && !contextFiles.length,
          signal: request.controller.signal,
          onStage(stage) {
            if (request.controller.signal.aborted) return;
            request.label = stages[stage] || stages.checking;
            if (store.getState().activeId === chat.id) status.textContent = request.label;
          }
        });
      }
    } catch (error) {
      if (!request.controller.signal.aborted) {
        reply = { kind: 'unavailable', text: error.message || 'Something interrupted the answer. You can try again.' };
      }
    }
    if (pending.get(chat.id) !== request || lifetime.signal.aborted) return;
    pending.delete(chat.id);
    if (!reply || request.controller.signal.aborted) return;
    const active = store.getState().activeId === chat.id;
    const bounded = reply.text.slice(0, BLIP_LIMITS.message);
    const saved = replaceId
      ? reply.kind !== 'unavailable' && store.replaceAssistantReply(chat.id, replaceId, bounded, reply)
      : store.addMessage(chat.id, 'assistant', bounded, reply);
    if (active) {
      draw();
      status.textContent = saved ? 'Reply added.' : reply.kind === 'unavailable' ? bounded : 'The reply could not be saved.';
    } else if (saved) drawRail();
  }

  function stopReply(id) {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    request.controller.abort();
  }

  part('stop').addEventListener('click', () => {
    const chat = currentChat();
    if (!chat) return;
    stopReply(chat.id);
    draw();
    status.textContent = 'Reply stopped.';
    input.focus({ preventScroll: true });
  });

  function editChat(type) {
    const chat = currentChat();
    if (!chat) return;
    edit = { type, id: chat.id };
    const renaming = type === 'rename';
    part('edit-title').textContent = renaming ? 'Rename chat' : 'Delete this chat?';
    nameLabel.hidden = !renaming;
    nameInput.disabled = !renaming;
    nameInput.required = renaming;
    nameInput.maxLength = BLIP_LIMITS.title;
    nameInput.value = chat.title;
    part('edit-text').hidden = renaming;
    part('edit-text').textContent = `“${chat.title}” and its messages will be removed from this browser.`;
    part('edit-error').textContent = '';
    part('confirm-edit').textContent = renaming ? 'Save name' : 'Delete chat';
    dialog.showModal();
    if (renaming) nameInput.select();
    else part('cancel-edit').focus();
  }

  part('rename').addEventListener('click', () => editChat('rename'));
  part('delete').addEventListener('click', () => editChat('delete'));
  part('cancel-edit').addEventListener('click', () => dialog.close());
  part('chat-edit').addEventListener('submit', event => {
    event.preventDefault();
    if (!edit) return;
    if (edit.type === 'rename') {
      if (!store.renameChat(edit.id, nameInput.value.trim())) {
        part('edit-error').textContent = 'Enter a chat name.';
        return;
      }
    } else {
      stopReply(edit.id);
      drafts.delete(edit.id);
      draftFiles.delete(edit.id);
      fileNotices.delete(edit.id);
      revisions.delete(edit.id);
      store.deleteChat(edit.id);
      if (!currentChat()) store.createChat();
    }
    dialog.close();
    draw();
  });
  dialog.addEventListener('close', () => { edit = undefined; });

  function drawModels() {
    const nativeReady = nativeStatus === 'available';
    const cpuReady = cpuStatus === 'available';
    const portableReady = portableStatus === 'available';
    const ready = nativeReady || cpuReady || portableReady;
    const canEnable = !ready && ['downloadable', 'downloading'].includes(nativeStatus);
    const canStartCpu = !ready && ['downloadable', 'downloading'].includes(cpuStatus);
    const canDownload = !ready && ['downloadable', 'downloading'].includes(portableStatus);
    const canSetUp = canEnable || canStartCpu || canDownload;
    part('enable').hidden = !canEnable;
    part('cpu').hidden = !canStartCpu;
    part('portable').hidden = !canDownload;
    part('setup-shortcut').hidden = !canSetUp;
    part('settings-label').textContent = canSetUp ? 'Set up AI' : 'AI settings';
    modelSettings.dataset.ready = String(ready);
    part('model-status').textContent = nativeReady ? 'The browser model is ready.'
      : canEnable ? 'Enable the browser model to use conversational AI.'
      : 'This browser’s built-in model is unavailable.';
    part('cpu-status').hidden = !cpuReady && !canStartCpu;
    part('cpu-status').textContent = cpuReady ? 'CPU AI is ready.'
      : 'Runs on your processor. First-time setup downloads about 108 MB. Prompts and files stay on this device.';
    part('portable-status').textContent = portableReady ? 'The portable local model is ready.'
      : canDownload ? 'The WebGPU option downloads about 220 MB on first use.'
      : ready || canSetUp ? '' : 'Local replies, file previews, calculations, and optional Wikipedia lookups are available.';
  }

  Promise.allSettled([blipModelAvailability(), cpuBlipAvailability(), portableBlipAvailability()]).then(([native, cpu, portable]) => {
    if (lifetime.signal.aborted) return;
    nativeStatus = native.value || 'unavailable';
    cpuStatus = cpu.value || 'unavailable';
    portableStatus = portable.value || 'unavailable';
    drawModels();
  });

  const setupButtons = ['enable', 'cpu', 'portable'].map(part);
  for (const [control, notice, prepare, ready] of [
    ['enable', 'model-status', prepareBlipModel, () => { nativeStatus = 'available'; }],
    ['cpu', 'cpu-status', prepareCpuBlipModel, () => { cpuStatus = 'available'; }],
    ['portable', 'portable-status', preparePortableBlipModel, () => { portableStatus = 'available'; }]
  ]) {
    part(control).addEventListener('click', async () => {
      if (setupRunning) return;
      setupRunning = true;
      const message = part(notice);
      for (const button of setupButtons) button.disabled = true;
      message.textContent = 'Preparing the local model…';
      try {
        await prepare(lifetime.signal, (fraction, description) => {
          if (!lifetime.signal.aborted) message.textContent = `${description || 'Preparing local AI'} · ${Math.round(fraction * 100)}%`;
        });
        if (!lifetime.signal.aborted) {
          ready();
          drawModels();
        }
      } catch {
        if (!lifetime.signal.aborted) message.textContent = 'The model could not start. Try again or choose another available model.';
      } finally {
        setupRunning = false;
        for (const button of setupButtons) button.disabled = false;
      }
    });
  }
  part('setup-shortcut').addEventListener('click', () => {
    modelSettings.open = true;
    modelSettings.querySelector('summary').focus({ preventScroll: true });
  });
  for (const [popover, other] of [[modelSettings, musicSettings], [musicSettings, modelSettings]]) {
    popover.addEventListener('toggle', () => { if (popover.open) other.open = false; });
  }

  if (!currentChat()) store.createChat();
  draw();

  return () => {
    lifetime.abort();
    for (const id of pending.keys()) stopReply(id);
    if (dialog.open) dialog.close();
    if (attachmentDialog.open) attachmentDialog.close();
    stopMusic();
    void releaseCpuBlipModel();
    void releasePortableBlipModel();
  };
}
