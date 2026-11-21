const endpointKey = 'ffun.gateway.url';
const maxRequestBytes = 32_768;
const maxResponseBytes = 262_144;
const maxStreamBytes = 2_097_152;
const maxChatChars = 12_000;
const encoder = new TextEncoder();
let connection;

function endpoint() {
  try { return localStorage.getItem(endpointKey) || ''; } catch { return ''; }
}

export function gatewayConnected() {
  return Boolean(connection);
}

export function gatewayChatOptIn() {
  return connection?.chatOptIn === true;
}

export function setGatewayChatOptIn(enabled) {
  if (connection) connection.chatOptIn = enabled === true;
}

function configuredUrl(value) {
  try {
    const url = new URL(value);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash) return '';
    return url.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function renderGatewaySettings(target, label = 'Connect an authorized backend', onChange, onCapabilities) {
  const settings = document.createElement('details');
  settings.className = 'gateway-settings';
  const title = document.createElement('summary');
  title.textContent = label;
  const form = document.createElement('form');
  form.className = 'gateway-configuration';
  form.innerHTML = `
    <label>Backend URL <input class="field" name="endpoint" type="url" autocomplete="off" placeholder="https://your-worker.example" required></label>
    <label>Backend access code <input class="field" name="access" type="password" autocomplete="off" maxlength="256" required></label>
    <div class="interaction-row"><button class="button" type="submit">Connect backend</button><button class="button" type="button" data-check>Check backend</button><button class="button" type="button" data-disconnect>Disconnect</button></div>
    <p class="muted" role="status"></p>
  `;
  const field = form.elements.endpoint;
  const code = form.elements.access;
  const status = form.querySelector('[role="status"]');
  const check = form.querySelector('[data-check]');
  field.value = connection?.url || endpoint();
  status.textContent = gatewayConnected() ? 'Backend configured for this tab.' : 'The access code stays in this tab. Provider requests may count toward your quota.';
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = configuredUrl(field.value.trim());
    const value = code.value.trim();
    if (!url || !/^[!-~]{1,256}$/.test(value)) {
      status.textContent = 'Enter a valid HTTPS backend URL and its access code.';
      return;
    }
    try { localStorage.setItem(endpointKey, url); } catch {}
    field.value = url;
    connection?.controller.abort(new DOMException('The backend connection changed.', 'AbortError'));
    connection = { url, accessCode: value, controller: new AbortController() };
    code.value = '';
    status.textContent = 'Backend configured for this tab. A request will check the connection.';
    onChange?.();
  });
  form.querySelector('[data-disconnect]').addEventListener('click', () => {
    connection?.controller.abort(new DOMException('The backend was disconnected.', 'AbortError'));
    connection = undefined;
    code.value = '';
    status.textContent = 'Backend disconnected in this tab.';
    onChange?.();
  });
  check.addEventListener('click', async () => {
    const current = connection;
    if (!current) {
      status.textContent = 'Connect the backend before checking its features.';
      return;
    }
    check.disabled = true;
    status.textContent = 'Checking the gateway configuration…';
    try {
      const available = await getGatewayCapabilities(AbortSignal.timeout(8_000));
      if (connection !== current) return;
      const features = available ? [
        available.chat && 'chat', available.advanced && 'advanced chat', available.research && 'web research',
        available.search && 'web search', available.youtube && 'YouTube search',
      ].filter(Boolean) : null;
      status.textContent = !features ? 'This backend does not report its features. Check its version for advanced chat.'
        : features.length ? 'The gateway reports ' + features.join(', ') + ' configured.'
        : 'The gateway is reachable. Configure a provider on the backend to enable its features.';
      onCapabilities?.(available);
    } catch (error) {
      if (connection === current) status.textContent = error.message;
    } finally {
      check.disabled = false;
    }
  });
  settings.append(title, form);
  target.append(settings);
}

export async function searchGatewayVideos(q, signal) {
  return (await searchGatewayVideoPage(q, signal)).items;
}

export async function searchGatewayVideoPage(q, signal, pageToken) {
  const response = await gatewayRequest('/api/youtube', { q, pageToken }, signal);
  const data = await gatewayJson(response);
  if (!Array.isArray(data?.items)) throw new Error('The backend returned an invalid video list.');
  const token = data.nextPageToken;
  const nextPageToken = typeof token === 'string' && /^[!-~]{1,512}$/.test(token) && token !== pageToken
    ? token : undefined;
  return { items: data.items.slice(0, 12), nextPageToken };
}

async function gatewayJson(response) {
  if (!response.body || Number(response.headers.get('Content-Length')) > maxResponseBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error('The backend returned an invalid response.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let content = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) throw new Error('The backend returned an oversized response.');
      content += decoder.decode(value, { stream: true });
    }
    return JSON.parse(content + decoder.decode());
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof SyntaxError || error instanceof TypeError) throw new Error('The backend returned an invalid response.');
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function gatewayRequest(path, body, signal, timeout = 12_000) {
  if (!connection) throw new Error('Connect an authorized backend first.');
  const { url, accessCode, controller } = connection;
  const requestSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeout), ...(signal ? [signal] : [])]);
  let response;
  try {
    response = await fetch(url + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessCode}` },
      body: JSON.stringify(body),
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: requestSignal
    });
  } catch {
    requestSignal.throwIfAborted();
    throw new Error('The backend could not be reached. Check the URL and allowed website origin.');
  }
  if (!response.ok) {
    const body = await gatewayJson(response).catch(() => null);
    requestSignal.throwIfAborted();
    const error = new Error(typeof body?.error === 'string' ? body.error.slice(0, 180) : 'The backend did not return a result.');
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function getGatewayCapabilities(signal) {
  let response;
  try {
    response = await gatewayRequest('/api/capabilities', {}, signal);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  const data = await gatewayJson(response);
  const flags = ['chat', 'advanced', 'research', 'search', 'youtube'];
  if (!flags.every(flag => typeof data?.[flag] === 'boolean')) {
    throw new Error('The backend returned invalid capability information.');
  }
  const available = Object.fromEntries(flags.map(flag => [flag, data[flag]]));
  if (available.chat && ['workers-ai', 'openai'].includes(data.chatProvider)) available.chatProvider = data.chatProvider;
  for (const key of ['standardOutputTokens', 'advancedOutputTokens']) {
    if (Number.isInteger(data[key]) && data[key] > 0 && data[key] <= 2400) available[key] = data[key];
  }
  const knownModes = ['quick', 'think', 'brainstorm', 'study', 'code', 'creative', 'games'];
  if (Array.isArray(data.modes)) available.modes = knownModes.filter(mode => data.modes.includes(mode));
  return available;
}

export async function searchGateway(q, signal) {
  const response = await gatewayRequest('/api/search', { q }, signal);
  const data = await gatewayJson(response);
  if (!Array.isArray(data?.results)) throw new Error('The backend returned invalid search results.');
  return safeReferences(data.results, 10);
}

function safeReferences(items, limit) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).flatMap(item => {
    if (typeof item?.url !== 'string' || !item.url || item.url.length > 2048 ||
        typeof item?.title !== 'string' || !item.title.trim()) return [];
    let url;
    try { url = new URL(item.url); } catch { return []; }
    if (url.protocol !== 'https:' || url.username || url.password) return [];
    if (url.href.length > 2048) return [];
    return [{ title: item.title.trim().slice(0, 180), url: url.href,
      description: typeof item.description === 'string' ? item.description.trim().slice(0, 360) : '' }];
  });
}

export async function hostedBlipReply({ text, history = [], mode, signal, onUpdate, research = false, onSources, depth = 'standard' }) {
  if (history.some(message => message.attachments?.length)) throw new Error('Use a local model for chats with attached files.');
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content) throw new Error('Enter a message to send to the model.');
  if (content.length > maxChatChars) throw new Error('The message is too long for the connected model.');
  if (research && content.length > 200) throw new Error('Web research is available for short questions of up to 200 characters.');
  const messages = history.filter(message => !message.attachments?.length && message.kind !== 'unavailable' &&
      ['user', 'assistant'].includes(message.role) && typeof message.text === 'string' && message.text.trim())
    .slice(-8).map(message => ({ role: message.role, content: message.text.trim().slice(0, 950) }));
  messages.push({ role: 'user', content });
  const request = {
    messages, mode, stream: true,
    ...(research ? { research: true } : {}),
    ...(depth === 'advanced' ? { depth: 'advanced' } : {})
  };
  let chars = messages.reduce((total, message) => total + message.content.length, 0);
  while (chars > maxChatChars || encoder.encode(JSON.stringify(request)).byteLength > maxRequestBytes) {
    if (messages.length === 1) throw new Error('The message is too large for the connected model.');
    chars -= messages.shift().content.length;
  }
  const response = await gatewayRequest('/api/chat', request, signal, depth === 'advanced' ? 95_000 : 65_000);
  let hasSources = false;
  const readSources = items => {
    if (!research || hasSources) return;
    const sources = safeReferences(items, 4);
    if (!sources.length) return;
    hasSources = true;
    onSources?.(sources);
  };
  const requireSources = () => {
    if (research && !hasSources) throw new Error('The backend returned no web sources. Check its research setup.');
  };
  if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') {
    const data = await gatewayJson(response);
    if (typeof data?.text !== 'string' || !data.text.trim()) throw new Error('The model returned an empty reply.');
    readSources(data.sources);
    requireSources();
    return data.text.trim().slice(0, maxChatChars);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The model reply stream was empty.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let eventData = '';
  let size = 0;
  let answer = '';
  let complete = false;

  function consumeLine(line) {
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line.startsWith('data:')) {
      if (eventData.length + line.length > 64_000) throw new Error('The model returned an oversized stream event.');
      eventData += line.slice(5).trimStart() + '\n';
      return;
    }
    if (line || !eventData) return;
    const data = eventData.trim();
    eventData = '';
    if (!data) return;
    if (data === '[DONE]') {
      complete = true;
      return;
    }
    let event;
    try { event = JSON.parse(data); } catch { throw new Error('The model returned an invalid stream event.'); }
    if (event?.error) {
      throw new Error(typeof event.error === 'string' ? event.error.slice(0, 180) : 'The model stopped streaming. Try again.');
    }
    if (Array.isArray(event?.sources)) readSources(event.sources);
    const delta = event?.choices?.[0]?.delta?.content;
    if (typeof delta !== 'string') return;
    answer = (answer + delta).slice(0, maxChatChars);
    onUpdate?.(answer);
    if (answer.length >= maxChatChars) complete = true;
  }

  try {
    while (!complete) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        consumeLine(buffer);
        consumeLine('');
        break;
      }
      size += value.byteLength;
      if (size > maxStreamBytes) throw new Error('The model returned an oversized stream.');
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      if (buffer.length > 64_000) throw new Error('The model returned an oversized stream event.');
      for (const line of lines) {
        consumeLine(line);
        if (complete) break;
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!complete) throw new Error('The model response ended before completion.');
  if (!answer.trim()) throw new Error('The model returned an empty reply.');
  requireSources();
  return answer.trim();
}
