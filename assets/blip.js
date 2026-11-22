const assetVersion = new URL(import.meta.url).search;
const [{ BLIP_FILE_ACCEPT, BLIP_FILE_LIMITS, normalizeBlipAttachments, readBlipFiles }, {
  BLIP_BACKUP_FILE_BYTES, BLIP_LIMITS, createBlipStore
}, {
  answerBlip, blipModelAvailability, blipModes, cpuBlipAvailability, portableBlipAvailability,
  prepareBlipModel, prepareCpuBlipModel, preparePortableBlipModel,
  releaseCpuBlipModel, releasePortableBlipModel
}, { formatBlipReply }, { gatewayChatOptIn, gatewayConnected, gatewayCooldownSeconds, getGatewayCapabilities, hostedBlipReply,
  renderGatewaySettings, setGatewayChatOptIn }, { mountBlipMusic }] = await Promise.all([
  import(`./blip-files.js${assetVersion}`),
  import(`./blip-store.js${assetVersion}`),
  import(`./blip-answer.js${assetVersion}`),
  import(`./blip-format.js${assetVersion}`),
  import(`./service-gateway.js${assetVersion}`),
  import(`./blip-music.js${assetVersion}`)
]);

const examples = [
  ['Make a plan', 'Help me make a 20-minute study plan.', 'study'],
  ['Compare fractions', 'Which is greater, 3/5 or 5/8?', 'study'],
  ['Try a coding example', 'Show how to filter a list of game titles in JavaScript.', 'code'],
  ['Convert units', 'Convert 5 miles to km', 'quick']
];
const themeKey = 'gamefor-ffun:blip-theme';
const legacyHostedModes = { code: 'think', creative: 'brainstorm', games: 'think' };

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

const localModels = [
  { id: 'browser', label: 'Browser AI', control: 'enable', notice: 'model-status', availability: blipModelAvailability,
    prepare: prepareBlipModel, download: 'Your browser manages its model download and storage.' },
  { id: 'webgpu', label: 'WebGPU AI', control: 'portable', notice: 'portable-status', availability: portableBlipAvailability,
    prepare: preparePortableBlipModel, download: 'First-time setup downloads about 220 MB.' },
  { id: 'cpu', label: 'CPU AI', control: 'cpu', notice: 'cpu-status', availability: cpuBlipAvailability,
    prepare: prepareCpuBlipModel, download: 'First-time setup downloads about 273 MB and runs on your processor.' },
];

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

function downloadBlipFile(contents, name, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const download = element('a');
  download.download = name;
  download.href = url;
  download.hidden = true;
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadTranscript(chat) {
  const entries = chat.messages.map(message => {
    const parts = [message.role === 'user' ? 'You' : 'blip.ai', message.text];
    if (message.researchQuery) parts.push('Web lookup phrase · ' + message.researchQuery);
    for (const file of message.attachments || []) {
      parts.push(`${file.name}${file.truncated ? ' (loaded excerpt)' : ''}`, file.text);
    }
    const sources = message.source ? [message.source, ...(message.sources || [])] : message.sources || [];
    for (const [index, source] of sources.entries()) parts.push(`[${index + 1}] ${source.title}\n${source.url}`);
    return parts.filter(Boolean).join('\n\n');
  });
  const contents = [chat.title, ...entries].join('\n\n────────\n\n');
  const name = chat.title.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  downloadBlipFile(contents, `${name || 'blip-chat'}.txt`, 'text/plain;charset=utf-8');
}

function messageView(message, { onEdit, onRetry, onContinue } = {}) {
  const item = element('article', `blip-message blip-message--${message.role}`);
  if (message.kind) item.dataset.replyKind = message.kind;
  item.append(element('h3', 'blip-message-author', message.role === 'user' ? 'You' : 'blip.ai'));
  if (message.kind) item.append(element('p', 'blip-answer-source', messageSources[message.kind]));
  let body;
  if (message.text) {
    body = element('div', 'blip-message-text');
    if (message.role === 'assistant') formatBlipReply(body, message.text, message.sources);
    else body.textContent = message.text;
    item.append(body);
  }
  if (message.researchQuery) item.append(element('p', 'blip-answer-source', 'Web lookup phrase · ' + message.researchQuery));
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
  if (message.truncated) item.append(element('p', 'blip-answer-limit', 'This reply reached its model limit.'));
  if (canCopy || onEdit || onRetry || onContinue) {
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
    if (onContinue) actions.append(button('Draft a continuation', onContinue, 'blip-button'));
    item.append(actions);
  }
  return item;
}

export function getBlipChatSummary() {
  return createBlipStore().getState().chats.map(({ id, title, mode }) => ({ id, title, mode }));
}

export function renderBlip(target, { draft = '', research: requestedResearch = '', chat: requestedChat = '', onDraftUsed } = {}) {
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
            <h2>Online AI</h2>
            <p>Get generated replies without downloading a model. Ask the arcade owner for a backend URL and access code.</p>
            <div data-blip="gateway"></div>
            <label class="blip-check"><input type="checkbox" data-blip="hosted"> Use the connected model for chats without files</label>
            <p>Online replies send your current question and recent messages to the selected provider through the backend. Chats with attachments stay on your device.</p>
            <p data-blip="gateway-capabilities" role="status"></p>
            <label class="blip-check"><input type="checkbox" data-blip="advanced" disabled> Use Advanced replies</label>
            <p data-blip="reply-budget" hidden></p>
            <h2>On-device AI</h2>
            <p data-blip="model-status" role="status">Checking this browser for a model…</p>
            <button class="blip-button blip-button--primary" type="button" data-blip="enable" hidden>Enable on-device AI</button>
            <p data-blip="cpu-status" role="status" hidden></p>
            <button class="blip-button blip-button--primary" type="button" data-blip="cpu" hidden>Start CPU AI</button>
            <p data-blip="portable-status" role="status"></p>
            <button class="blip-button" type="button" data-blip="portable" hidden>Start local AI</button>
            <label class="blip-check"><input type="checkbox" data-blip="references"> Use Wikipedia as a fallback</label>
            <p>Short questions in chats without files can use this lookup.</p>
          </div>
        </details>
      </div>
    </header>
    <div class="blip-layout" data-chats-open="true">
      <aside class="blip-rail" id="blip-chats" aria-label="Saved conversations">
        <button class="blip-button blip-button--primary blip-new-chat" data-blip="new" type="button" aria-keyshortcuts="Alt+Shift+N"><span aria-hidden="true">+</span> New chat</button>
        <h2>Chats</h2>
        <input class="blip-chat-search" type="search" data-blip="chat-search" aria-label="Search chats" placeholder="Search chats" maxlength="200" autocomplete="off">
        <ul class="blip-chat-list" data-blip="chats"></ul>
        <p class="blip-chat-empty" data-blip="chat-empty" hidden>No conversations match your search.</p>
        <p class="blip-privacy" data-blip="privacy"></p>
      </aside>
      <section class="blip-thread" aria-label="Chat workspace">
        <header class="blip-thread-header">
          <button class="blip-button blip-chat-toggle" data-blip="toggle" type="button" aria-controls="blip-chats" aria-expanded="true" aria-keyshortcuts="Alt+Shift+H">Chats</button>
          <h2 class="blip-thread-title" data-blip="title">New chat</h2>
          <div class="blip-thread-actions">
            <details class="blip-popover blip-chat-actions" data-blip="chat-actions">
              <summary>Chat tools</summary>
              <div class="blip-popover-content">
                <button class="blip-button" type="button" data-blip="pin">Pin chat</button>
                <button class="blip-button" type="button" data-blip="download">Download transcript</button>
                <button class="blip-button" type="button" data-blip="back-up">Back up conversations</button>
                <button class="blip-button" type="button" data-blip="restore">Restore from backup</button>
                <label class="blip-theme-control">Chat theme
                  <select data-blip="theme"><option value="dark">Dark</option><option value="light">Light</option></select>
                </label>
                <button class="blip-button" type="button" data-blip="shortcuts">Keyboard shortcuts</button>
              </div>
            </details>
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
            <div class="blip-welcome-setup">
              <button class="blip-button" type="button" data-blip="welcome-online">Set up online chat</button>
              <button class="blip-button" type="button" data-blip="setup-shortcut" hidden>Review local AI options</button>
            </div>
          </div>
          <div class="blip-messages" data-blip="messages"></div>
          <aside class="blip-recovery" data-blip="recovery" aria-label="Reply recovery" hidden>
            <h3 data-blip="recovery-title"></h3>
            <p data-blip="recovery-copy"></p>
            <progress class="blip-recovery-progress" data-blip="setup-progress" aria-label="Local AI setup progress" max="100" hidden></progress>
            <p class="blip-recovery-status" data-blip="setup-status" role="status"></p>
            <div class="blip-recovery-actions">
              <button class="blip-button" type="button" data-blip="recovery-online" hidden>Set up online chat</button>
              <button class="blip-button blip-button--primary" type="button" data-blip="start-local" hidden>Start local AI</button>
              <button class="blip-button" type="button" data-blip="start-cpu" hidden>Use CPU AI instead</button>
              <button class="blip-button blip-button--primary" type="button" data-blip="retry-last" hidden>Retry last message</button>
              <button class="blip-button" type="button" data-blip="cancel-setup" hidden>Cancel setup</button>
              <button class="blip-button" type="button" data-blip="recovery-settings">Review AI options</button>
            </div>
          </aside>
        </div>
        <form class="blip-compose" data-blip="compose">
          <fieldset class="blip-modes" aria-describedby="blip-mode-description">
            <legend>Thinking method</legend>
            <div class="blip-mode-choices" data-blip="modes"></div>
            <p class="blip-mode-description" id="blip-mode-description" data-blip="mode-description"></p>
          </fieldset>
          <details class="blip-research" data-blip="research-panel">
            <summary>Blip Search <span data-blip="research-badge" hidden>· On for next reply</span></summary>
            <div class="blip-research-controls">
              <label class="blip-check"><input type="checkbox" data-blip="research"> Research current question with Brave Search</label>
              <div class="blip-research-phrase" data-blip="research-phrase" hidden>
                <label for="blip-research-query">Web lookup phrase</label>
                <input id="blip-research-query" data-blip="research-query" type="search" maxlength="200" autocomplete="off" placeholder="Use the question if it is short">
              </div>
              <p data-blip="research-note"></p>
              <button class="blip-button" type="button" data-blip="research-settings" hidden>Set up online research</button>
            </div>
          </details>
          <div class="blip-editing-note" data-blip="revising" hidden>
            <span>Resending starts a new chat from this message and keeps the original.</span>
            <button class="blip-button" type="button" data-blip="cancel-revision">Cancel edit</button>
          </div>
          <ul class="blip-attachments" data-blip="attachments" aria-label="Files attached to this draft" hidden></ul>
          <button class="blip-button blip-attachment-clear" type="button" data-blip="clear-files" hidden>Clear attachments</button>
          <p class="blip-compose-status" data-blip="file-status" role="status"></p>
          <div class="blip-prompt-box">
            <button class="blip-button blip-attach" type="button" data-blip="attach" title="PDF, TXT, Markdown, CSV, TSV, or JSON">Attach files</button>
            <input type="file" data-blip="file-input" aria-label="Choose files to attach" multiple hidden>
            <label class="sr-only" for="blip-prompt">Message blip.ai</label>
            <textarea id="blip-prompt" data-blip="input" rows="2" maxlength="3000" enterkeyhint="send" aria-keyshortcuts="Alt+Shift+M" placeholder="Message blip.ai…"></textarea>
            <button class="blip-button blip-button--primary" data-blip="send" type="submit">Send</button>
            <button class="blip-button" data-blip="stop" type="button" hidden>Stop</button>
          </div>
          <p class="blip-engine-state" data-blip="engine-state">Reply engine · Checking local AI</p>
          <p class="blip-compose-status" data-blip="gateway-wait" role="status"></p>
          <p class="blip-compose-status" data-blip="status" role="status"></p>
        </form>
      </section>
    </div>
    <dialog class="blip-dialog" data-blip="shortcuts-dialog" aria-labelledby="blip-shortcuts-title">
      <h2 id="blip-shortcuts-title">Keyboard shortcuts</h2>
      <dl class="blip-shortcuts">
        <div><dt>New chat</dt><dd><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd></dd></div>
        <div><dt>Toggle chat history</dt><dd><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd></dd></div>
        <div><dt>Focus message</dt><dd><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd></dd></div>
        <div><dt>Send message</dt><dd><kbd>Enter</kbd></dd></div>
        <div><dt>New line</dt><dd><kbd>Shift</kbd> + <kbd>Enter</kbd></dd></div>
        <div><dt>Close menu or stop reply</dt><dd><kbd>Escape</kbd></dd></div>
      </dl>
      <form method="dialog"><div class="blip-dialog-actions"><button class="blip-button" type="submit">Close</button></div></form>
    </dialog>
    <dialog class="blip-dialog blip-attachment-dialog" data-blip="attachment-dialog" aria-labelledby="blip-attachment-title">
      <h2 id="blip-attachment-title" data-blip="attachment-title"></h2>
      <p class="blip-attachment-metadata" data-blip="attachment-metadata"></p>
      <pre class="blip-attachment-preview-text" data-blip="attachment-preview" tabindex="0"></pre>
      <div class="blip-dialog-actions">
        <button class="blip-button" type="button" data-blip="close-attachment">Close</button>
      </div>
    </dialog>
    <dialog class="blip-dialog" data-blip="backup-dialog" aria-labelledby="blip-backup-title" aria-describedby="blip-backup-description">
      <form data-blip="backup-form">
        <h2 id="blip-backup-title">Restore conversations</h2>
        <p id="blip-backup-description">Add copies of saved chats and their attachment excerpts from a Blip JSON backup. The file is read on this device.</p>
        <label class="blip-backup-file" data-blip="backup-file-label">Blip backup file</label>
        <p class="blip-backup-status" data-blip="backup-status" role="status"></p>
        <div class="blip-dialog-actions">
          <button class="blip-button" data-blip="cancel-restore" type="button">Cancel</button>
          <button class="blip-button blip-button--primary" data-blip="confirm-restore" type="submit" disabled>Add conversations</button>
        </div>
      </form>
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
  const researchDrafts = new Map();
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
  const shortcutsDialog = part('shortcuts-dialog');
  const researchPanel = part('research-panel');
  const researchChoice = part('research');
  const researchInput = part('research-query');
  let cooldownTimer;
  let linkedDraft = false;
  const backupDialog = part('backup-dialog');
  const backupFile = element('input');
  backupFile.type = 'file';
  backupFile.accept = '.json,application/json';
  let backupRead;
  const nameInput = part('chat-name');
  const nameLabel = nameInput.closest('label');
  const theme = part('theme');
  try { theme.value = localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'; } catch {}
  root.dataset.theme = theme.value;
  theme.addEventListener('change', () => {
    root.dataset.theme = theme.value;
    try { localStorage.setItem(themeKey, theme.value); } catch {}
  });
  let compact = root.clientWidth <= 750;
  let desktopChatsOpen = true;
  let mobileChatsOpen = false;
  const stopMusic = mountBlipMusic(part('music'));
  let capabilities;
  let capabilityRequest;
  let capabilityProblem;
  part('hosted').checked = gatewayChatOptIn();
  renderGatewaySettings(part('gateway'), 'Connect an AI provider', () => {
    part('hosted').checked = gatewayChatOptIn();
    void refreshGatewayCapabilities();
  }, result => {
    capabilityRequest?.abort();
    capabilityRequest = undefined;
    capabilities = result;
    capabilityProblem = undefined;
    updateHostedOptions();
  });
  const musicLink = element('a', 'blip-button', 'Open Music library');
  musicLink.href = '#music';
  part('music').append(musicLink);
  let edit;
  const modelStates = new Map(localModels.map(model => [model.id, 'checking']));
  let modelSetup;
  let setupNote;

  function updateHostedOptions() {
    const optIn = part('hosted');
    optIn.disabled = !gatewayConnected() || capabilities?.chat === false || [401, 403, 503].includes(capabilityProblem?.status);
    const hosted = optIn.checked && !optIn.disabled;
    const advanced = part('advanced');
    advanced.disabled = !hosted || capabilities?.advanced !== true;
    if (advanced.disabled) advanced.checked = false;
    const notice = part('gateway-capabilities');
    notice.textContent = !gatewayConnected() ? 'Connect a backend to use online chat.'
      : capabilityRequest ? 'Checking the connected gateway…'
      : capabilityProblem ? capabilityProblem.message
      : capabilities?.chatProvider === 'workers-ai' ? 'Workers AI is configured. Replies use the owner’s Cloudflare allowance.'
      : capabilities?.advanced ? 'Advanced replies allow more detail and may use more tokens.'
      : capabilities?.chat === false ? 'This gateway needs a Workers AI binding or an OpenAI key to offer chat.'
      : 'This gateway’s Advanced replies are unavailable.';
    drawEngineState(currentChat());
    drawRecovery(currentChat());
    drawResearch(currentChat());
  }

  async function refreshGatewayCapabilities() {
    capabilityRequest?.abort();
    capabilityRequest = undefined;
    capabilities = undefined;
    capabilityProblem = undefined;
    if (!gatewayConnected()) {
      updateHostedOptions();
      return;
    }
    const request = new AbortController();
    capabilityRequest = request;
    updateHostedOptions();
    try {
      const result = await getGatewayCapabilities(AbortSignal.any([
        request.signal, lifetime.signal, AbortSignal.timeout(5000)
      ]));
      if (capabilityRequest === request) capabilities = result;
    } catch (error) {
      if (capabilityRequest === request && !lifetime.signal.aborted) {
        capabilityProblem = error.name === 'TimeoutError' ? new Error('The gateway check timed out.') : error;
      }
    } finally {
      if (capabilityRequest === request && !lifetime.signal.aborted) {
        capabilityRequest = undefined;
        updateHostedOptions();
      }
    }
  }

  const currentChat = () => {
    const { chats, activeId } = store.getState();
    return chats.find(chat => chat.id === activeId);
  };

  function showChats(open) {
    if (compact) mobileChatsOpen = open;
    else desktopChatsOpen = open;
    syncChats();
  }

  function syncChats() {
    const open = compact ? mobileChatsOpen : desktopChatsOpen;
    layout.dataset.chatsOpen = String(open);
    part('toggle').setAttribute('aria-expanded', String(open));
  }

  const layoutObserver = new ResizeObserver(([entry]) => {
    compact = entry.contentRect.width <= 750;
    syncChats();
  });
  layoutObserver.observe(root);
  syncChats();

  function drawRail() {
    const { chats, activeId } = store.getState();
    const query = chatSearch.value.trim().toLocaleLowerCase();
    const visible = query ? chats.filter(chat => chat.title.toLocaleLowerCase().includes(query) ||
      chat.messages.some(message => message.text.toLocaleLowerCase().includes(query))) : chats;
    const items = [...visible].sort((first, second) => Number(Boolean(second.pinned)) - Number(Boolean(first.pinned))).map(chat => {
      const item = element('li');
      const open = button(chat.title, () => {
        if (store.selectChat(chat.id)) {
          draw();
          if (compact) showChats(false);
          input.focus({ preventScroll: true });
        }
      }, 'blip-chat-link');
      if (chat.pinned) {
        const marker = element('span', 'blip-pin-mark', '●');
        marker.setAttribute('aria-hidden', 'true');
        open.prepend(marker);
        open.setAttribute('aria-description', 'Pinned chat');
      }
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
    transcript.setAttribute('aria-busy', String(Boolean(request)));
    for (const [id, option] of modeInputs) option.checked = currentMode.id === id;
    input.placeholder = currentMode.id === 'quick' ? 'Message blip.ai…' : currentMode.example;
    part('mode-description').textContent = currentMode.description;
    part('stop').hidden = !request;
    part('send').hidden = Boolean(request);
    part('send').disabled = readingFiles.has(chat?.id) || Boolean(chat && modelSetup?.turn?.chatId === chat.id);
    part('send').textContent = revision ? 'Resend in new chat' : 'Send';
    part('revising').hidden = !revision;
    part('cancel-revision').disabled = readingFiles.has(chat?.id);
    status.textContent = request?.label || '';
    drawDraftFiles(chat?.id);
    drawEngineState(chat);
    drawRecovery(chat);
  }

  function drawResearch(chat) {
    const selected = researchDrafts.has(chat?.id);
    const canSearch = hostedFor(chat) && capabilities?.research !== false;
    const attached = chatHasFiles(chat);
    researchChoice.checked = selected;
    researchChoice.disabled = !chat || pending.has(chat.id);
    part('research-badge').hidden = !selected;
    part('research-phrase').hidden = !selected;
    researchInput.value = researchDrafts.get(chat?.id) || '';
    researchInput.readOnly = canSearch && !capabilities?.customResearchQuery;
    part('research-settings').hidden = canSearch || attached;
    part('research-note').textContent = attached ? 'Chats with files stay on this device. Turn off Blip Search to send here.'
      : !canSearch ? 'Connect an online model and a Brave Search-enabled backend to use Blip Search.'
      : researchInput.readOnly ? 'This backend searches the question itself. Keep it within 200 characters.'
      : 'Brave receives the lookup phrase. The connected model receives your question, recent chat, and up to four excerpts.';
  }

  function researchProblem(chat, text, query) {
    if (!text) return 'Enter a question to ask Blip Search.';
    if (chatHasFiles(chat)) return 'Chats with files stay on this device. Turn off Blip Search to send here.';
    if (!hostedFor(chat) || capabilities?.research === false) return 'Set up online research before sending this question.';
    if (gatewayCooldownSeconds()) return 'Online AI is waiting before trying again. Your draft is ready to send after the wait.';
    if (query.length > 200) return 'Enter a web lookup phrase of up to 200 characters.';
    if (query !== text && !capabilities?.customResearchQuery) return 'This backend searches the message itself. Use that as the lookup phrase or update the Worker.';
    return '';
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
    drawEngineState(currentChat());
    drawResearch(currentChat());
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
      draft: drafts.get(chat.id), files: draftFiles.get(chat.id), notice: fileNotices.get(chat.id), lookup: researchDrafts.get(chat.id)
    };
    revisions.set(chat.id, { ...original, messageId: message.id });
    drafts.set(chat.id, message.text);
    draftFiles.set(chat.id, message.attachments || []);
    if (message.researchQuery) {
      researchDrafts.set(chat.id, message.researchQuery);
      researchPanel.open = true;
    } else researchDrafts.delete(chat.id);
    fileNotices.delete(chat.id);
    input.value = message.text;
    drawComposer(chat);
    input.focus({ preventScroll: true });
  }

  function restoreDraft(id) {
    const revision = revisions.get(id);
    if (!revision) return;
    for (const [map, value] of [[drafts, revision.draft], [draftFiles, revision.files], [fileNotices, revision.notice], [researchDrafts, revision.lookup]]) {
      if (value === undefined) map.delete(id);
      else map.set(id, value);
    }
    revisions.delete(id);
  }

  function draw({ follow = true } = {}) {
    const previousScroll = transcript.scrollTop;
    const chat = currentChat();
    drawRail();
    part('title').textContent = chat?.title || 'New chat';
    part('rename').disabled = part('delete').disabled = !chat;
    part('pin').disabled = !chat;
    part('pin').textContent = chat?.pinned ? 'Unpin chat' : 'Pin chat';
    part('download').disabled = !chat?.messages.length;
    part('chat-actions').open = false;
    input.disabled = !chat;
    input.value = drafts.get(chat?.id) || '';
    part('welcome').hidden = Boolean(chat?.messages.length);
    const messages = chat?.messages || [];
    const items = messages.map((message, index) => messageView(message, {
      onEdit: message.role === 'user' && !pending.has(chat.id) ? () => beginMessageEdit(chat, message) : undefined,
      onRetry: message.role === 'assistant' && index === messages.length - 1 && !pending.has(chat.id) && modelSetup?.turn?.chatId !== chat.id
        ? () => retryReply(chat, message.id) : undefined,
      onContinue: message.truncated && index === messages.length - 1 && !pending.has(chat.id)
        ? () => draftContinuation(chat) : undefined,
    }));
    part('messages').replaceChildren(...items);
    drawPartial(chat?.id);
    drawComposer(chat);
    transcript.scrollTop = follow ? transcript.scrollHeight : previousScroll;
  }

  function nearTranscriptEnd() {
    return transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 90;
  }

  function draftContinuation(chat) {
    input.focus({ preventScroll: true });
    if (input.value.trim() || draftFiles.get(chat.id)?.length || revisions.has(chat.id)) {
      status.textContent = 'Finish or clear your current draft before adding a continuation.';
      return;
    }
    const next = 'Continue the previous reply from the last unfinished point.';
    drafts.set(chat.id, next);
    input.value = next;
  }

  function drawPartial(id) {
    let partial = part('messages').querySelector('.blip-reply-stream');
    const request = pending.get(id);
    const text = request?.partial;
    if (!text) {
      partial?.remove();
      return;
    }
    const follow = nearTranscriptEnd();
    if (!partial) {
      partial = messageView({ role: 'assistant', kind: request.engine === 'hosted' ? 'hosted' : 'model' });
      partial.classList.add('blip-reply-stream');
      partial.append(element('p', 'blip-message-text'));
      part('messages').append(partial);
    }
    partial.lastElementChild.textContent = text;
    if (follow) transcript.scrollTop = transcript.scrollHeight;
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
    if (compact) showChats(false);
    input.focus({ preventScroll: true });
  });
  chatSearch.addEventListener('input', drawRail);
  part('toggle').addEventListener('click', () => showChats(layout.dataset.chatsOpen !== 'true'));
  part('shortcuts').addEventListener('click', () => shortcutsDialog.showModal());
  root.addEventListener('keydown', event => {
    if (dialog.open || attachmentDialog.open || shortcutsDialog.open || backupDialog.open || event.isComposing) return;
    if (event.key === 'Escape') {
      const menu = root.querySelector('.blip-popover[open]');
      if (menu) {
        menu.open = false;
        menu.querySelector('summary').focus();
      } else if (pending.has(currentChat()?.id)) {
        part('stop').click();
      } else if (compact && mobileChatsOpen) {
        showChats(false);
        part('toggle').focus();
      } else return;
      event.preventDefault();
      return;
    }
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.code === 'KeyN') {
      part('new').click();
    } else if (event.code === 'KeyH') {
      const open = layout.dataset.chatsOpen !== 'true';
      showChats(open);
      (open ? chatSearch : part('toggle')).focus({ preventScroll: true });
    } else if (event.code === 'KeyM') {
      input.focus({ preventScroll: true });
    } else return;
    event.preventDefault();
  });
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
  part('hosted').addEventListener('change', event => {
    setGatewayChatOptIn(event.currentTarget.checked);
    updateHostedOptions();
  });
  part('advanced').addEventListener('change', () => drawEngineState(currentChat()));
  researchChoice.addEventListener('change', () => {
    const chat = currentChat();
    if (!chat) return;
    if (researchChoice.checked) researchDrafts.set(chat.id, '');
    else researchDrafts.delete(chat.id);
    drawResearch(chat);
  });
  researchInput.addEventListener('input', () => {
    const chat = currentChat();
    if (chat && researchDrafts.has(chat.id)) researchDrafts.set(chat.id, researchInput.value);
  });
  part('research-settings').addEventListener('click', showOnlineSettings);
  part('pin').addEventListener('click', () => {
    const chat = currentChat();
    if (chat && store.setPinned(chat.id, !chat.pinned)) {
      drawRail();
      part('pin').textContent = chat.pinned ? 'Pin chat' : 'Unpin chat';
    }
  });
  part('download').addEventListener('click', () => {
    const chat = currentChat();
    if (chat?.messages.length) downloadTranscript(chat);
  });
  part('back-up').addEventListener('click', () => {
    const tools = part('chat-actions');
    tools.open = false;
    tools.querySelector('summary').focus({ preventScroll: true });
    try {
      const day = new Date().toISOString().slice(0, 10);
      downloadBlipFile(store.exportBackup(), `blip-chats-${day}.json`, 'application/json;charset=utf-8');
      status.textContent = 'The backup includes saved messages and attachment excerpts.';
    } catch (error) {
      status.textContent = error.message;
    }
  });
  const confirmRestore = part('confirm-restore');
  const backupStatus = part('backup-status');
  function resetRestore() {
    backupRead = undefined;
    backupStatus.textContent = '';
    confirmRestore.disabled = true;
    backupFile.disabled = false;
    backupFile.value = '';
    backupFile.remove();
  }
  part('restore').addEventListener('click', () => {
    const tools = part('chat-actions');
    tools.open = false;
    tools.querySelector('summary').focus({ preventScroll: true });
    resetRestore();
    part('backup-file-label').append(backupFile);
    backupDialog.showModal();
    backupFile.focus();
  });
  part('cancel-restore').addEventListener('click', () => backupDialog.close());
  backupDialog.addEventListener('close', () => {
    if (!backupDialog.open) resetRestore();
  });
  backupFile.addEventListener('change', () => {
    backupStatus.textContent = '';
    confirmRestore.disabled = !backupFile.files.length;
  });
  part('backup-form').addEventListener('submit', async event => {
    event.preventDefault();
    const file = backupFile.files[0];
    if (!file || backupRead) return;
    if (file.size > BLIP_BACKUP_FILE_BYTES) {
      backupStatus.textContent = 'This backup exceeds the Blip size limit.';
      return;
    }
    backupFile.disabled = confirmRestore.disabled = true;
    backupStatus.textContent = 'Reading backup…';
    backupRead = file;
    try {
      let raw;
      try {
        raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      } catch {
        throw new Error('Choose a readable Blip JSON backup.');
      }
      if (lifetime.signal.aborted || backupRead !== file || !backupDialog.open) return;
      const id = currentChat()?.id;
      const hasDraft = drafts.get(id)?.trim() || draftFiles.get(id)?.length || readingFiles.has(id) || revisions.has(id);
      const added = store.importBackup(raw, { emptyChatId: hasDraft ? undefined : id });
      backupDialog.close();
      chatSearch.value = '';
      draw();
      input.focus({ preventScroll: true });
      status.textContent = `Added ${added} ${added === 1 ? 'conversation' : 'conversations'}${store.isPersistent() ? '.' : ' for this visit.'}`;
    } catch (error) {
      if (!lifetime.signal.aborted && backupRead === file && backupDialog.open) backupStatus.textContent = error.message;
    } finally {
      if (backupRead === file && backupDialog.open) {
        backupRead = undefined;
        backupFile.disabled = confirmRestore.disabled = false;
      }
    }
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
      const { attachments, errors } = await readBlipFiles(selected.slice(0, slots), { signal: lifetime.signal });
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
    const id = store.getState().activeId;
    if (pending.has(id) || readingFiles.has(id) || modelSetup?.turn?.chatId === id) return;
    event.preventDefault();
    composer.requestSubmit(part('send'));
  });

  composer.addEventListener('submit', async event => {
    event.preventDefault();
    let chat = currentChat();
    const text = input.value.trim();
    if (!chat || pending.has(chat.id) || readingFiles.has(chat.id) || modelSetup?.turn?.chatId === chat.id) return;
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
    const researchQuery = researchDrafts.has(originalId) ? researchDrafts.get(originalId).trim() || text : undefined;
    if (researchDrafts.has(originalId)) {
      const problem = researchProblem(chat, text, researchQuery);
      if (problem) {
        status.textContent = problem;
        researchPanel.open = true;
        return;
      }
    }
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
    if (!store.addMessage(chat.id, 'user', text, { attachments, researchQuery })) {
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
      researchDrafts.delete(chat.id);
    }
    if (linkedDraft) {
      linkedDraft = false;
      onDraftUsed?.(chat.id);
    }
    input.focus({ preventScroll: true });
    await runReply(chat, text, attachments, { researchQuery });
  });

  function lastTurn(chat) {
    const index = chat?.messages.findLastIndex(message => message.role === 'user') ?? -1;
    if (index < 0) return null;
    const last = chat.messages.at(-1);
    const user = chat.messages[index];
    return { chatId: chat.id, userId: user.id, replyId: last.role === 'assistant' ? last.id : undefined, index };
  }

  function retryTurn(turn, localOnly = false) {
    if (!turn || pending.has(turn.chatId) || modelSetup?.turn?.chatId === turn.chatId) return false;
    const chat = store.getState().chats.find(item => item.id === turn.chatId);
    const latest = lastTurn(chat);
    if (!latest || latest.userId !== turn.userId || latest.replyId !== turn.replyId) return false;
    const user = chat.messages[latest.index];
    void runReply({ ...chat, messages: chat.messages.slice(0, latest.index) }, user.text, user.attachments || [], {
      replaceId: turn.replyId, localOnly, researchQuery: user.researchQuery,
    });
    return true;
  }

  function retryReply(chat, messageId) {
    const turn = lastTurn(chat);
    if (turn?.replyId === messageId) retryTurn(turn);
  }

  async function runReply(chat, text, attachments, { replaceId, localOnly = false, researchQuery } = {}) {
    const request = { controller: new AbortController(), label: stages.checking };
    pending.set(chat.id, request);
    draw();
    const isActive = () => store.getState().activeId === chat.id;
    const onUpdate = value => {
      if (typeof value !== 'string' || request.controller.signal.aborted) return;
      request.partial = value;
      if (isActive()) drawPartial(chat.id);
    };
    let reply;
    let connectedError;
    try {
      const contextFiles = attachments.length ? attachments :
        chat.messages.findLast(message => message.attachments?.length)?.attachments || [];
      const research = Boolean(researchQuery && !localOnly);
      const problem = research && researchProblem(chat, text, researchQuery);
      if (problem) reply = { kind: 'unavailable', text: problem };
      const useHosted = !reply && !localOnly && !contextFiles.length && hostedFor(chat);
      if (useHosted) {
        const advanced = part('advanced').checked;
        let sources = [];
        let truncated = false;
        request.engine = 'hosted';
        request.engineLabel = hostedEngineLabel();
        request.label = research ? 'Researching and waiting for the connected model…' : 'Waiting for the connected model…';
        if (isActive()) {
          status.textContent = request.label;
          drawEngineState(currentChat());
        }
        try {
          const answer = await hostedBlipReply({
            text, history: chat.messages,
            mode: capabilities?.modes?.includes(chat.mode) ? chat.mode : legacyHostedModes[chat.mode] || chat.mode,
            research,
            researchQuery,
            depth: advanced ? 'advanced' : undefined,
            signal: AbortSignal.any([request.controller.signal, AbortSignal.timeout(advanced ? 95_000 : 65_000)]),
            onSources(value) { sources = value; },
            onFinish(value) { truncated = value; },
            onUpdate,
          });
          reply = { kind: 'hosted', text: answer, sources, truncated };
        } catch (error) {
          request.controller.signal.throwIfAborted();
          if (error?.name === 'AbortError') throw error;
          connectedError = error?.message || 'The connected model could not complete the reply.';
          if (research) reply = { kind: 'unavailable', text: connectedError };
        }
      }
      if (!reply) {
        reply = await answerBlip({
          text,
          attachments: contextFiles,
          history: chat.messages,
          mode: chat.mode,
          wikipedia: !connectedError && !localOnly && part('references').checked && !contextFiles.length && !chatHasFiles(chat),
          preferGenerated: localOnly,
          signal: request.controller.signal,
          onUpdate,
          onStage(stage, engine) {
            if (request.controller.signal.aborted) return;
            if (request.engine !== engine) {
              request.engine = engine;
              request.partial = undefined;
            }
            const model = localModels.find(item => item.id === engine);
            request.engineLabel = model?.label;
            request.label = model ? model.label + ' is working…' : stages[stage] || stages.checking;
            if (isActive()) {
              status.textContent = request.label;
              drawEngineState(currentChat());
              drawPartial(chat.id);
            }
          }
        });
        if (connectedError && reply.kind === 'unavailable') reply.text = connectedError;
      }
    } catch (error) {
      if (!request.controller.signal.aborted) {
        reply = { kind: 'unavailable', text: error.message || 'Something interrupted the answer. You can try again.' };
      }
    }
    if (pending.get(chat.id) !== request || lifetime.signal.aborted) return;
    pending.delete(chat.id);
    if (!reply || request.controller.signal.aborted) return;
    if (reply.kind === 'unavailable' && request.engine !== 'hosted') {
      for (const model of localModels) refreshModelState(model);
    }
    const active = store.getState().activeId === chat.id;
    const bounded = reply.text.slice(0, BLIP_LIMITS.message);
    const saved = replaceId
      ? reply.kind !== 'unavailable' && store.replaceAssistantReply(chat.id, replaceId, bounded, reply)
      : store.addMessage(chat.id, 'assistant', bounded, reply);
    if (active) {
      draw({ follow: nearTranscriptEnd() });
      if (saved) {
        status.textContent = reply.kind === 'unavailable' ? 'Reply unavailable.'
          : connectedError ? 'Connected AI was unavailable. Blip answered on this device.' : 'Reply added.';
      } else {
        status.textContent = reply.kind === 'unavailable' ? bounded : 'The reply could not be saved.';
      }
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
      if (modelSetup?.turn?.chatId === edit.id) modelSetup.controller.abort();
      drafts.delete(edit.id);
      draftFiles.delete(edit.id);
      fileNotices.delete(edit.id);
      researchDrafts.delete(edit.id);
      revisions.delete(edit.id);
      store.deleteChat(edit.id);
      if (!currentChat()) store.createChat();
    }
    dialog.close();
    draw();
  });
  dialog.addEventListener('close', () => { edit = undefined; });

  function readyModel() {
    // Match the inference order when more than one local runtime is ready.
    return ['browser', 'cpu', 'webgpu'].map(id => localModels.find(model => model.id === id))
      .find(model => modelStates.get(model.id) === 'available');
  }

  function canPrepare(model) {
    return ['downloadable', 'downloading'].includes(modelStates.get(model.id));
  }

  function suggestedModel() {
    const available = localModels.filter(canPrepare);
    return available.find(model => model.id !== setupNote?.modelId) || available[0];
  }

  function hostedAvailable() {
    return gatewayChatOptIn() && gatewayConnected() && !part('hosted').disabled;
  }

  function chatHasFiles(chat) {
    return Boolean(chat && (chat.localOnly || draftFiles.get(chat.id)?.length || chat.messages.some(message => message.attachments?.length)));
  }

  function hostedFor(chat) {
    return Boolean(chat && hostedAvailable() && !chatHasFiles(chat));
  }

  function hostedEngineLabel() {
    if (capabilities?.chatProvider === 'workers-ai') return 'Workers AI';
    return part('advanced').checked ? 'Connected AI · Advanced' : 'Connected AI';
  }

  function drawEngineState(chat) {
    const state = part('engine-state');
    const request = pending.get(chat?.id);
    const ready = readyModel();
    const online = hostedFor(chat);
    const label = request?.engineLabel ? request.engineLabel + ' · Generating' : modelSetup
        ? modelSetup.label : online
        ? hostedEngineLabel()
        : ready ? ready.label + ' ready' : ([...modelStates.values()].includes('checking') ? 'Checking local AI' : 'Local tools');
    state.textContent = 'Reply engine · ' + label;
    const engineReady = Boolean(ready || online);
    state.dataset.ready = String(!modelSetup && engineReady);
    modelSettings.dataset.ready = String(engineReady);
    part('settings-label').textContent = !engineReady && localModels.some(canPrepare) ? 'Set up AI' : 'AI settings';
    part('welcome-online').hidden = online || chatHasFiles(chat);
    const limit = part('reply-budget');
    const basic = capabilities?.chat && (capabilities.maxStandardOutputTokens || capabilities.standardOutputTokens);
    const advanced = capabilities?.advancedOutputTokens;
    limit.hidden = !basic;
    limit.textContent = basic ? `Online replies use up to ${basic.toLocaleString()} tokens${advanced ? `, or ${advanced.toLocaleString()} with Advanced replies` : ''}.` : '';
    const wait = gatewayCooldownSeconds();
    const note = part('gateway-wait');
    note.textContent = wait ? `Online AI is waiting before another try. About ${wait} ${wait === 1 ? 'second' : 'seconds'} remain.` : '';
    clearTimeout(cooldownTimer);
    if (wait) cooldownTimer = setTimeout(() => drawEngineState(currentChat()), wait * 1000);
  }

  function drawRecovery(chat) {
    const turn = lastTurn(chat);
    const latest = chat?.messages.at(-1);
    const setupHere = modelSetup && (!modelSetup.turn || modelSetup.turn.chatId === chat?.id);
    const ready = readyModel();
    const checking = [...modelStates.values()].includes('checking');
    const recoverable = turn && !pending.has(chat.id) &&
      (latest.role === 'user' || latest.kind === 'unavailable' || (latest.kind === 'local' && !ready && !hostedFor(chat)));
    const card = part('recovery');
    card.hidden = !setupHere && !recoverable;
    if (card.hidden) return;

    const suggested = suggestedModel();
    const cpu = localModels.find(model => model.id === 'cpu');
    const canRetry = Boolean(turn && (ready || hostedFor(chat)));
    const showStart = !modelSetup && !canRetry && Boolean(suggested);
    const showCpu = showStart && suggested !== cpu && canPrepare(cpu);
    part('recovery-title').textContent = setupHere ? 'Starting ' + modelSetup.model.label
      : canRetry ? 'Retry this reply' : 'Get a generated reply';
    part('recovery-copy').textContent = setupHere
      ? (modelSetup.turn ? 'Blip will retry your last message here when the model is ready.' : 'The model runs on this device.')
      : canRetry ? 'Blip will use the saved message and its conversation context.'
      : suggested ? suggested.label + '. ' + suggested.download +
        (showCpu ? ' The CPU option downloads about 273 MB.' : '') + ' Prompts and files stay on this device.'
      : checking ? 'Checking which local models this device supports.'
      : 'This device could not start a local model. Chats without files can use a connected AI provider.';
    const note = setupNote && (!setupNote.chatId || setupNote.chatId === chat?.id) ? setupNote.text : '';
    part('setup-status').textContent = setupHere ? modelSetup.label : note;
    const progress = part('setup-progress');
    progress.hidden = !setupHere;
    if (setupHere && Number.isFinite(modelSetup.fraction)) progress.value = modelSetup.fraction * 100;
    else progress.removeAttribute('value');

    part('start-local').hidden = !showStart;
    part('start-cpu').hidden = !showCpu;
    part('retry-last').hidden = Boolean(modelSetup) || !canRetry;
    part('cancel-setup').hidden = !setupHere;
    part('cancel-setup').disabled = Boolean(setupHere && modelSetup.controller.signal.aborted);
    part('recovery-settings').hidden = Boolean(setupHere);
    part('recovery-online').hidden = Boolean(modelSetup) || hostedFor(chat) || chatHasFiles(chat);
  }

  function drawModels() {
    const ready = readyModel();
    const canSetUp = localModels.some(canPrepare);
    part('setup-shortcut').hidden = !canSetUp || Boolean(ready) || Boolean(modelSetup);
    for (const model of localModels) {
      const state = modelStates.get(model.id);
      const control = part(model.control);
      const notice = part(model.notice);
      control.hidden = !canPrepare(model) || Boolean(ready);
      control.disabled = Boolean(modelSetup);
      notice.hidden = model.id !== 'browser' && state === 'unavailable';
      notice.textContent = modelSetup?.model === model ? modelSetup.label
        : setupNote?.modelId === model.id ? setupNote.text
        : state === 'available' ? model.label + ' ready.'
        : state === 'checking' ? 'Checking ' + model.label + '…'
        : canPrepare(model) ? model.download
        : model.label + ' is unavailable in this browser.';
    }
    drawEngineState(currentChat());
    drawRecovery(currentChat());
  }

  async function startLocalModel(model, turn) {
    if (!model || modelSetup || !canPrepare(model)) return;
    if (turn && pending.has(turn.chatId)) return;
    const controller = new AbortController();
    const request = { model, turn, controller, label: 'Preparing ' + model.label + '…' };
    modelSetup = request;
    setupNote = undefined;
    drawModels();
    if (turn) draw();
    else drawComposer(currentChat());
    let ready = false;
    try {
      await model.prepare(AbortSignal.any([controller.signal, lifetime.signal]), (fraction, description) => {
        if (lifetime.signal.aborted || controller.signal.aborted) return;
        request.fraction = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : undefined;
        request.label = (description || 'Preparing ' + model.label) +
          (Number.isFinite(request.fraction) ? ' · ' + Math.round(request.fraction * 100) + '%' : '');
        drawModels();
      });
      controller.signal.throwIfAborted();
      if (!lifetime.signal.aborted) {
        modelStates.set(model.id, 'available');
        ready = true;
      }
    } catch {
      if (!lifetime.signal.aborted) {
        setupNote = {
          modelId: model.id,
          chatId: turn?.chatId,
          text: controller.signal.aborted ? 'Setup canceled.' : model.label + ' could not start. Try another available model.',
        };
      }
    } finally {
      modelSetup = undefined;
      if (!lifetime.signal.aborted) {
        drawModels();
        if (turn) draw();
        else drawComposer(currentChat());
      }
    }
    if (ready && turn && !lifetime.signal.aborted) retryTurn(turn, true);
  }

  function showModelSettings() {
    modelSettings.open = true;
    modelSettings.querySelector('summary').focus({ preventScroll: true });
  }

  function showOnlineSettings() {
    modelSettings.open = true;
    const details = part('gateway').querySelector('details');
    details.open = true;
    const form = details.querySelector('form');
    const optIn = part('hosted');
    const control = gatewayConnected() && !optIn.disabled ? optIn
      : form.elements.endpoint.value ? form.elements.access : form.elements.endpoint;
    control.focus();
  }

  function refreshModelState(model) {
    const previous = modelStates.get(model.id);
    void model.availability().catch(() => 'unavailable').then(state => {
      if (lifetime.signal.aborted || modelSetup?.model === model || modelStates.get(model.id) !== previous) return;
      modelStates.set(model.id, state || 'unavailable');
      drawModels();
    });
  }

  for (const model of localModels) {
    refreshModelState(model);
    part(model.control).addEventListener('click', () => { void startLocalModel(model); });
  }
  part('start-local').addEventListener('click', () => { void startLocalModel(suggestedModel(), lastTurn(currentChat())); });
  part('start-cpu').addEventListener('click', () => {
    void startLocalModel(localModels.find(model => model.id === 'cpu'), lastTurn(currentChat()));
  });
  part('retry-last').addEventListener('click', () => { retryTurn(lastTurn(currentChat()), !hostedFor(currentChat())); });
  part('cancel-setup').addEventListener('click', () => {
    modelSetup?.controller.abort();
    if (modelSetup) {
      modelSetup.label = 'Canceling setup…';
      drawModels();
    }
  });
  part('recovery-settings').addEventListener('click', showModelSettings);
  part('recovery-online').addEventListener('click', showOnlineSettings);
  part('welcome-online').addEventListener('click', showOnlineSettings);
  part('setup-shortcut').addEventListener('click', showModelSettings);
  for (const [popover, other] of [[modelSettings, musicSettings], [musicSettings, modelSettings]]) {
    popover.addEventListener('toggle', () => { if (popover.open) other.open = false; });
  }

  const selectedChat = requestedChat && store.selectChat(requestedChat);
  const initialDraft = typeof draft === 'string' ? draft.trim().slice(0, input.maxLength) : '';
  const chat = initialDraft && !selectedChat && currentChat()?.messages.length ? store.createChat() : null;
  const initialChat = chat || currentChat() || store.createChat();
  if (initialChat && initialDraft) {
    linkedDraft = true;
    drafts.set(initialChat.id, initialDraft);
    const phrase = typeof requestedResearch === 'string' ? requestedResearch.trim() : '';
    if (phrase && phrase.length <= 200) {
      researchDrafts.set(initialChat.id, phrase);
      researchPanel.open = true;
    }
  }
  draw();
  if (initialChat && initialDraft) input.focus({ preventScroll: true });
  void refreshGatewayCapabilities();

  return () => {
    lifetime.abort();
    clearTimeout(cooldownTimer);
    layoutObserver.disconnect();
    for (const id of pending.keys()) stopReply(id);
    if (dialog.open) dialog.close();
    if (attachmentDialog.open) attachmentDialog.close();
    if (shortcutsDialog.open) shortcutsDialog.close();
    if (backupDialog.open) backupDialog.close();
    stopMusic();
    void releaseCpuBlipModel();
    void releasePortableBlipModel();
  };
}
