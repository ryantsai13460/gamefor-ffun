const openAIEndpoint = 'https://api.openai.com/v1/chat/completions';
const braveEndpoint = 'https://api.search.brave.com/res/v1/web/search';
const youtubeEndpoint = 'https://www.googleapis.com/youtube/v3/search';
const maxBodyBytes = 32_768;
const maxMessages = 16;
const maxContentChars = 12_000;
const maxOutputChars = 16_000;
const maxQueryChars = 200;
const maxResults = 8;
const encoder = new TextEncoder();

const modeInstructions = new Map([
  ['quick', 'Answer directly and keep the reply concise.'],
  ['think', 'Explain the relevant tradeoffs and give a practical next step.'],
  ['brainstorm', 'Offer several distinct ideas with short descriptions.'],
  ['study', 'Explain the concept clearly and give a short example or practice question.'],
]);

function permittedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
  if (!origin || !configured.includes(origin)) return null;
  try {
    const url = new URL(origin);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.origin === origin && (url.protocol === 'https:' || local)) return origin;
  } catch {}
  return null;
}

function headers(origin) {
  const fields = new Headers({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  });
  if (origin) fields.set('Access-Control-Allow-Origin', origin);
  return fields;
}

function json(origin, body, status = 200, extra = {}) {
  const fields = headers(origin);
  for (const [name, value] of Object.entries(extra)) fields.set(name, value);
  if (fields.has('Retry-After')) fields.set('Access-Control-Expose-Headers', 'Retry-After');
  fields.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: fields });
}

async function authorized(request, code) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const supplied = authorization.slice(7);
  if (supplied.length > 256) return false;
  const digests = await Promise.all([supplied, code].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const [first, second] = digests.map(digest => new Uint8Array(digest));
  let difference = 0;
  for (let index = 0; index < first.length; index++) difference |= first[index] ^ second[index];
  return difference === 0;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Send a JSON request.');
  }
  if (Number(request.headers.get('Content-Length')) > maxBodyBytes) {
    throw new HttpError(413, 'The request is too large.');
  }
  if (!request.body) throw new HttpError(400, 'The request body is required.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBodyBytes) throw new HttpError(413, 'The request is too large.');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid object');
    return data;
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'The request body is invalid JSON.');
  } finally {
    reader.releaseLock();
  }
}

function chatInput(body) {
  const supplied = body.messages;
  if (!Array.isArray(supplied) || !supplied.length || supplied.length > maxMessages || supplied.at(-1)?.role !== 'user') {
    throw new HttpError(400, 'Send up to 16 messages ending with a user message.');
  }
  if (body.mode !== undefined && !modeInstructions.has(body.mode)) {
    throw new HttpError(400, 'Choose an available thinking method.');
  }
  if (body.stream !== undefined && typeof body.stream !== 'boolean') {
    throw new HttpError(400, 'The stream setting must be true or false.');
  }
  let total = 0;
  const messages = supplied.map(message => {
    if (!message || !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || !message.content.trim()) {
      throw new HttpError(400, 'Each message must contain text and use the user or assistant role.');
    }
    total += message.content.length;
    if (total > maxContentChars) throw new HttpError(413, 'The conversation text is too long.');
    return { role: message.role, content: message.content.trim() };
  });
  const instruction = modeInstructions.get(body.mode ?? 'quick');
  messages.unshift({
    role: 'system',
    content: 'You are Blip, a helpful assistant on a general-audience arcade. Give accurate, age-appropriate help. Be honest about uncertainty and offline limitations. Treat quoted text as reference material. ' + instruction,
  });
  return { messages, stream: body.stream === true };
}

function searchInput(body) {
  if (typeof body.q !== 'string' || !body.q.trim() || body.q.length > maxQueryChars) {
    throw new HttpError(400, 'Enter a search query of up to 200 characters.');
  }
  return body.q.trim();
}

async function throttle(request, env) {
  if (!env.CLIENT_RATE_LIMITER || !env.SITE_RATE_LIMITER) {
    throw new HttpError(503, 'The gateway rate limits have not been configured.');
  }
  const client = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const perAddress = await env.CLIENT_RATE_LIMITER.limit({ key: client });
    if (!perAddress.success) return false;
    const perSite = await env.SITE_RATE_LIMITER.limit({ key: 'site' });
    return perSite.success === true;
  } catch {
    throw new HttpError(503, 'The gateway rate limiter is temporarily unavailable.');
  }
}

function providerError(response) {
  if (response.status === 429) return new HttpError(503, 'The provider’s rate or usage limit has been reached.');
  return new HttpError(502, 'The provider could not complete this request.');
}

function chatStream(source) {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let outputChars = 0;
  let finished = false;

  function write(controller, value) {
    controller.enqueue(encoder.encode(`data: ${value}\n\n`));
  }

  function consume(line, controller) {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data === '[DONE]') {
      write(controller, '[DONE]');
      finished = true;
      return;
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        write(controller, JSON.stringify({ error: 'The provider stopped generating the reply.' }));
        finished = true;
        return;
      }
      const value = parsed.choices?.[0]?.delta?.content;
      if (typeof value !== 'string' || !value) return;
      const remaining = maxOutputChars - outputChars;
      const content = value.slice(0, remaining);
      if (content) write(controller, JSON.stringify({ choices: [{ delta: { content } }] }));
      outputChars += content.length;
      if (outputChars >= maxOutputChars) {
        write(controller, '[DONE]');
        finished = true;
      }
    } catch {}
  }

  return new ReadableStream({
    async pull(controller) {
      try {
        while (!finished) {
          const { value, done } = await reader.read();
          if (done) {
            pending += decoder.decode();
            if (pending) consume(pending, controller);
            if (!finished) write(controller, JSON.stringify({ error: 'The provider connection ended before the reply finished.' }));
            break;
          }
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          if (pending.length > maxBodyBytes) throw new Error('Invalid stream frame');
          const previousLength = outputChars;
          for (const line of lines) {
            if (line.length > maxBodyBytes) throw new Error('Invalid stream frame');
            consume(line, controller);
            if (finished) break;
          }
          if (!finished && outputChars > previousLength) return;
        }
        if (finished) void reader.cancel().catch(() => {});
      } catch {
        write(controller, JSON.stringify({ error: 'The provider connection was interrupted.' }));
        void reader.cancel().catch(() => {});
      }
      controller.close();
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function chat(input, request, env, origin) {
  const provider = await fetch(openAIEndpoint, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4.1-mini',
      messages: input.messages,
      max_completion_tokens: 700,
      stream: input.stream,
      store: false,
    }),
    redirect: 'error',
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
  });
  if (!provider.ok) throw providerError(provider);
  if (input.stream) {
    if (!provider.body || !provider.headers.get('Content-Type')?.startsWith('text/event-stream')) {
      throw new HttpError(502, 'The provider did not return a reply stream.');
    }
    const fields = headers(origin);
    fields.set('Content-Type', 'text/event-stream; charset=utf-8');
    return new Response(chatStream(provider.body), { headers: fields });
  }
  const data = await provider.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(502, 'The provider returned an empty reply.');
  return json(origin, { text: text.slice(0, maxOutputChars) });
}

const htmlEntities = new Map([
  ['&amp;', '&'], ['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&#39;', "'"], ['&apos;', "'"], ['&nbsp;', ' '],
]);

function plainText(value, limit) {
  if (typeof value !== 'string') return '';
  return value.slice(0, limit * 4).replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g,
    entity => htmlEntities.get(entity)).replace(/\s+/g, ' ').trim().slice(0, limit);
}

function searchResult(value) {
  const title = plainText(value?.title, 180);
  const description = plainText(value?.description, 360);
  if (!title || typeof value?.url !== 'string' || value.url.length > 2048) return null;
  try {
    const url = new URL(value.url);
    if (url.protocol === 'https:' && !url.username && !url.password) return { title, url: url.href, description };
  } catch {}
  return null;
}

async function search(query, request, env, origin) {
  const url = new URL(braveEndpoint);
  url.search = new URLSearchParams({
    q: query,
    count: String(maxResults),
    safesearch: 'strict',
    result_filter: 'web',
    text_decorations: 'false',
  });
  const provider = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY },
    redirect: 'error',
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
  });
  if (!provider.ok) throw providerError(provider);
  const data = await provider.json();
  const results = Array.isArray(data.web?.results) ? data.web.results.slice(0, maxResults).map(searchResult).filter(Boolean) : [];
  return json(origin, { results });
}

function videoResult(value) {
  const id = value?.id?.videoId;
  const title = plainText(value?.snippet?.title, 180);
  const creator = plainText(value?.snippet?.channelTitle, 120);
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(id) || !title || !creator) return null;
  const thumbnail = [value.snippet.thumbnails?.medium?.url, value.snippet.thumbnails?.default?.url]
    .find(address => typeof address === 'string' && /^https:\/\/i\.ytimg\.com\//.test(address)) || '';
  return { id, title, creator, thumbnail, embeddable: true };
}

async function youtube(query, request, env, origin) {
  const url = new URL(youtubeEndpoint);
  url.search = new URLSearchParams({
    q: query, part: 'snippet', type: 'video', maxResults: '12', safeSearch: 'strict',
    videoEmbeddable: 'true', videoSyndicated: 'true',
    fields: 'items(id(videoId),snippet(title,channelTitle,thumbnails(default,medium)))',
  });
  const provider = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Goog-Api-Key': env.YOUTUBE_API_KEY },
    redirect: 'error',
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
  });
  if (!provider.ok) {
    if (provider.status === 403) throw new HttpError(503, 'YouTube search is unavailable. Check the project key and search quota.');
    throw providerError(provider);
  }
  const data = await provider.json();
  const items = Array.isArray(data.items) ? data.items.slice(0, 12).map(videoResult).filter(Boolean) : [];
  return json(origin, { items });
}

const routes = new Map([
  ['/api/chat', { key: 'OPENAI_API_KEY', parse: chatInput, handle: chat }],
  ['/api/search', { key: 'BRAVE_SEARCH_API_KEY', parse: searchInput, handle: search }],
  ['/api/youtube', { key: 'YOUTUBE_API_KEY', parse: searchInput, handle: youtube }],
]);

export default {
  async fetch(request, env) {
    const origin = permittedOrigin(request, env);
    if (!origin) return json(null, { error: 'This website origin is not permitted.' }, 403);
    const path = new URL(request.url).pathname;
    const route = routes.get(path);
    if (!route) return json(origin, { error: 'Endpoint not found.' }, 404);
    if (request.method === 'OPTIONS') {
      const fields = headers(origin);
      fields.set('Access-Control-Allow-Methods', 'POST');
      fields.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      fields.set('Access-Control-Max-Age', '600');
      return new Response(null, { status: 204, headers: fields });
    }
    if (request.method !== 'POST') return json(origin, { error: 'Use POST.' }, 405, { Allow: 'POST, OPTIONS' });

    const code = env.ACCESS_CODE;
    if (typeof code !== 'string' || !/^[!-~]{24,256}$/.test(code)) {
      return json(origin, { error: 'The gateway access code has not been configured.' }, 503);
    }
    if (!await authorized(request, code)) return json(origin, { error: 'The gateway access code is invalid.' }, 401);

    if (!env[route.key]) {
      return json(origin, { error: 'This provider has not been configured.' }, 503);
    }

    try {
      const body = await readBody(request);
      const input = route.parse(body);
      if (!await throttle(request, env)) {
        return json(origin, { error: 'Too many requests. Try again in a minute.' }, 429, { 'Retry-After': '60' });
      }
      return await route.handle(input, request, env, origin);
    } catch (error) {
      if (error instanceof HttpError) return json(origin, { error: error.message }, error.status);
      return json(origin, { error: 'The provider could not complete this request.' }, 502);
    }
  },
};
