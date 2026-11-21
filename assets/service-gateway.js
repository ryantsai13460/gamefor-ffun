const endpointKey = 'ffun.gateway.url';
let accessCode = '';

function endpoint() {
  try { return localStorage.getItem(endpointKey) || ''; } catch { return ''; }
}

export function gatewayConnected() {
  return Boolean(endpoint() && accessCode);
}

function configuredUrl(value) {
  try {
    const url = new URL(value);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash) return '';
    return url.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function renderGatewaySettings(target, label = 'Connect an authorized backend', onChange) {
  const settings = document.createElement('details');
  settings.className = 'gateway-settings';
  const title = document.createElement('summary');
  title.textContent = label;
  const form = document.createElement('form');
  form.className = 'gateway-configuration';
  form.innerHTML = `
    <label>Backend URL <input class="field" name="endpoint" type="url" autocomplete="off" placeholder="https://your-worker.example" required></label>
    <label>Backend access code <input class="field" name="access" type="password" autocomplete="off" maxlength="256" required></label>
    <div class="interaction-row"><button class="button" type="submit">Connect backend</button><button class="button" type="button" data-disconnect>Disconnect</button></div>
    <p class="muted" role="status"></p>
  `;
  const field = form.elements.endpoint;
  const code = form.elements.access;
  const status = form.querySelector('[role="status"]');
  field.value = endpoint();
  status.textContent = gatewayConnected() ? 'Backend configured for this tab.' : 'The access code stays in this tab. Provider requests may count toward your quota.';
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = configuredUrl(field.value.trim());
    const value = code.value.trim();
    if (!url || !value) {
      status.textContent = 'Enter a valid HTTPS backend URL and its access code.';
      return;
    }
    try {
      localStorage.setItem(endpointKey, url);
    } catch {
      status.textContent = 'Browser storage blocked this setting.';
      return;
    }
    field.value = url;
    accessCode = value;
    code.value = '';
    status.textContent = 'Backend configured for this tab. A request will check the connection.';
    onChange?.();
  });
  form.querySelector('[data-disconnect]').addEventListener('click', () => {
    accessCode = '';
    code.value = '';
    status.textContent = 'Backend disconnected in this tab.';
    onChange?.();
  });
  settings.append(title, form);
  target.append(settings);
}

export async function searchGatewayVideos(q, signal) {
  const response = await gatewayRequest('/api/youtube', { q }, signal);
  const data = await response.json();
  if (!Array.isArray(data?.items)) throw new Error('The backend returned an invalid video list.');
  return data.items;
}

async function gatewayRequest(path, body, signal) {
  if (!gatewayConnected()) throw new Error('Connect an authorized backend first.');
  const url = configuredUrl(endpoint());
  if (!url) throw new Error('The backend URL is invalid.');
  const response = await fetch(url + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessCode}` },
    body: JSON.stringify(body),
    credentials: 'omit',
    redirect: 'error',
    signal
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === 'string' ? body.error.slice(0, 180) : 'The backend did not return a result.');
  }
  return response;
}

export async function searchGateway(q, signal) {
  const response = await gatewayRequest('/api/search', { q }, signal);
  const data = await response.json();
  if (!Array.isArray(data?.results)) throw new Error('The backend returned invalid search results.');
  return data.results.slice(0, 10).flatMap(item => {
    if (typeof item?.url !== 'string' || typeof item?.title !== 'string') return [];
    let url;
    try { url = new URL(item.url); } catch { return []; }
    if (url.protocol !== 'https:' || url.username || url.password) return [];
    return [{ title: item.title.slice(0, 160), url: url.href,
      description: typeof item.description === 'string' ? item.description.slice(0, 400) : '' }];
  });
}

export async function hostedBlipReply({ text, history, mode, signal, onUpdate }) {
  const messages = history.filter(message => !message.attachments?.length && message.kind !== 'unavailable' &&
      ['user', 'assistant'].includes(message.role) && typeof message.text === 'string' && message.text.trim())
    .slice(-8).map(message => ({ role: message.role, content: message.text.slice(0, 950) }));
  messages.push({ role: 'user', content: text });
  const response = await gatewayRequest('/api/chat', { messages, mode, stream: true }, signal);
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const data = await response.json();
    if (typeof data?.text !== 'string' || !data.text.trim()) throw new Error('The model returned an empty reply.');
    return data.text;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The model reply stream was empty.');
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let complete = false;
  try {
    while (!complete) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 64_000) throw new Error('The model returned an oversized stream event.');
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          complete = true;
          break;
        }
        const event = JSON.parse(data);
        if (event.error) throw new Error('The model stopped streaming. Try again.');
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta !== 'string') continue;
        answer = (answer + delta).slice(0, 12_000);
        onUpdate(answer);
        if (answer.length >= 12_000) {
          complete = true;
          break;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!answer.trim() || !complete) throw new Error('The model response ended before completion.');
  return answer.trim();
}
