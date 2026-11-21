import { answerBlip, blipModelAvailability, blipModes, prepareBlipModel } from './blip-answer.js';
import { mountBlipMusic } from './blip-music.js';
import { BLIP_LIMITS, createBlipStore } from './blip-store.js';

const examples = [
  ['Make a plan', 'Help me make a 20-minute study plan.', 'study'],
  ['Think it through', 'Compare two ways to start learning guitar.', 'think'],
  ['Brainstorm ideas', 'Brainstorm three ideas for a weekend game project.', 'brainstorm'],
  ['Convert units', 'Convert 5 miles to km', 'quick']
];

const messageSources = {
  model: 'On-device AI',
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

function messageView(message) {
  const item = element('article', `blip-message blip-message--${message.role}`);
  item.append(element('h3', 'blip-message-author', message.role === 'user' ? 'You' : 'blip.ai'));
  if (message.kind) item.append(element('p', 'blip-answer-source', messageSources[message.kind]));
  item.append(element('p', 'blip-message-text', message.text));
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
            <label class="blip-check"><input type="checkbox" data-blip="references"> Use Wikipedia as a fallback</label>
            <p>When enabled, a short question may be sent to Wikipedia for an excerpt.</p>
          </div>
        </details>
      </div>
    </header>
    <div class="blip-layout" data-chats-open="false">
      <aside class="blip-rail" id="blip-chats" aria-label="Saved conversations">
        <button class="blip-button blip-button--primary blip-new-chat" data-blip="new" type="button"><span aria-hidden="true">+</span> New chat</button>
        <h2>Chats</h2>
        <ul class="blip-chat-list" data-blip="chats"></ul>
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
          </div>
          <div class="blip-messages" data-blip="messages"></div>
        </div>
        <form class="blip-compose" data-blip="compose">
          <fieldset class="blip-modes" aria-describedby="blip-mode-description">
            <legend>Thinking method</legend>
            <div class="blip-mode-choices" data-blip="modes"></div>
            <p class="blip-mode-description" id="blip-mode-description" data-blip="mode-description"></p>
          </fieldset>
          <div class="blip-prompt-box">
            <label class="sr-only" for="blip-prompt">Message blip.ai</label>
            <textarea id="blip-prompt" data-blip="input" rows="2" maxlength="2000" placeholder="Message blip.ai…" required></textarea>
            <button class="blip-button blip-button--primary" data-blip="send" type="submit">Send</button>
            <button class="blip-button" data-blip="stop" type="button" hidden>Stop</button>
          </div>
          <p class="blip-compose-status" data-blip="status" role="status"></p>
        </form>
      </section>
    </div>
    <dialog class="blip-dialog" aria-labelledby="blip-dialog-title">
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
  const modeInputs = new Map();
  const layout = root.querySelector('.blip-layout');
  const modelSettings = root.querySelector('.blip-settings-popover');
  const musicSettings = root.querySelector('.blip-music-popover');
  const composer = part('compose');
  const transcript = part('transcript');
  const status = part('status');
  const input = part('input');
  const dialog = root.querySelector('.blip-dialog');
  const nameInput = part('chat-name');
  const nameLabel = nameInput.closest('label');
  const stopMusic = mountBlipMusic(part('music'));
  let edit;

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
    const items = chats.map(chat => {
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
    part('new').disabled = chats.length >= BLIP_LIMITS.chats;
    part('privacy').textContent = chats.length >= BLIP_LIMITS.chats
      ? `This browser can keep up to ${BLIP_LIMITS.chats} chats.`
      : store.isPersistent() ? 'Chats are saved in this browser.' : 'Storage is unavailable. Chats last for this visit.';
  }

  function drawComposer(chat) {
    const currentMode = blipModes[chat?.mode] || blipModes.quick;
    const request = pending.get(chat?.id);
    for (const [id, option] of modeInputs) option.checked = currentMode.id === id;
    part('mode-description').textContent = currentMode.description;
    part('stop').hidden = !request;
    part('send').hidden = Boolean(request);
    status.textContent = request?.label || '';
  }

  function draw() {
    const chat = currentChat();
    drawRail();
    part('title').textContent = chat?.title || 'New chat';
    part('rename').disabled = part('delete').disabled = !chat;
    input.disabled = !chat;
    input.value = drafts.get(chat?.id) || '';
    part('welcome').hidden = Boolean(chat?.messages.length);
    part('messages').replaceChildren(...(chat?.messages || []).map(messageView));
    drawComposer(chat);
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
      if (chat && option.checked) drawComposer(store.setMode(chat.id, mode.id));
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
    draw();
    showChats(false);
    input.focus({ preventScroll: true });
  });
  part('toggle').addEventListener('click', () => showChats(layout.dataset.chatsOpen !== 'true'));
  input.addEventListener('input', () => drafts.set(store.getState().activeId, input.value));
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (pending.has(store.getState().activeId)) return;
    event.preventDefault();
    composer.requestSubmit(part('send'));
  });

  composer.addEventListener('submit', async event => {
    event.preventDefault();
    const chat = currentChat();
    const text = input.value.trim();
    if (!chat || pending.has(chat.id)) return;
    if (!text) {
      status.textContent = 'Enter a message.';
      return;
    }
    if (!store.addMessage(chat.id, 'user', text)) {
      status.textContent = 'This message could not be saved.';
      return;
    }
    if (!chat.messages.length && chat.title === 'New chat') {
      const compact = text.replace(/\s+/g, ' ');
      store.renameChat(chat.id, compact.length > 60 ? compact.slice(0, 59).trimEnd() + '…' : compact);
    }
    const request = { controller: new AbortController(), label: stages.checking };
    pending.set(chat.id, request);
    drafts.delete(chat.id);
    draw();
    input.focus({ preventScroll: true });
    let reply;
    try {
      reply = await answerBlip({
        text,
        history: chat.messages,
        mode: chat.mode,
        wikipedia: part('references').checked,
        signal: request.controller.signal,
        onStage(stage) {
          if (request.controller.signal.aborted) return;
          request.label = stages[stage] || stages.checking;
          if (store.getState().activeId === chat.id) status.textContent = request.label;
        }
      });
    } catch {
      if (!request.controller.signal.aborted) {
        reply = { kind: 'unavailable', text: 'Something interrupted the answer. You can try again.' };
      }
    }
    if (pending.get(chat.id) !== request || lifetime.signal.aborted) return;
    pending.delete(chat.id);
    if (!reply || request.controller.signal.aborted) return;
    const active = store.getState().activeId === chat.id;
    const saved = store.addMessage(chat.id, 'assistant', reply.text.slice(0, BLIP_LIMITS.message), reply);
    if (active) {
      draw();
      status.textContent = saved ? 'Reply added.' : 'The reply could not be saved.';
    } else if (saved) drawRail();
  });

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
    drawComposer(chat);
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
      store.deleteChat(edit.id);
      if (!currentChat()) store.createChat();
    }
    dialog.close();
    draw();
  });
  dialog.addEventListener('close', () => { edit = undefined; });

  function setModelStatus(availability) {
    const ready = availability === 'available';
    const availableToEnable = availability === 'downloadable' || availability === 'downloading';
    part('enable').hidden = !availableToEnable;
    part('settings-label').textContent = availableToEnable ? 'Set up AI' : 'AI settings';
    modelSettings.dataset.ready = String(ready);
    part('model-status').textContent = ready ? 'On-device AI is ready.'
      : availableToEnable ? 'Enable the browser model to use conversational AI and thinking methods.'
      : 'This browser does not have an on-device model. Calculations, conversions, and optional Wikipedia excerpts are available.';
  }

  blipModelAvailability().then(availability => {
    if (!lifetime.signal.aborted) setModelStatus(availability);
  }).catch(() => {
    if (!lifetime.signal.aborted) setModelStatus('unavailable');
  });
  part('enable').addEventListener('click', async () => {
    const enable = part('enable');
    const modelStatus = part('model-status');
    enable.disabled = true;
    modelStatus.textContent = 'Preparing the browser model…';
    try {
      await prepareBlipModel(lifetime.signal, fraction => {
        if (!lifetime.signal.aborted) modelStatus.textContent = `Downloading model · ${Math.round(fraction * 100)}%`;
      });
      if (!lifetime.signal.aborted) setModelStatus('available');
    } catch {
      if (!lifetime.signal.aborted) modelStatus.textContent = 'The browser could not prepare its model. Try again.';
    } finally {
      enable.disabled = false;
    }
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
    stopMusic();
  };
}
