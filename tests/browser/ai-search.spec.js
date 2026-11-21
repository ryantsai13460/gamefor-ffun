import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';

const prompt = page => page.getByRole('searchbox', { name: 'Ask AI' });
const panel = page => page.locator('.assistant-panel');

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'LanguageModel', { configurable: true, value: undefined });
  });
});

test('AI Mode builds offline plans and offers only relevant Wikipedia excerpts and related videos', async ({ page }) => {
  const queries = [];
  await page.route(url => url.hostname === 'en.wikipedia.org', route => {
    const query = new URL(route.request().url()).searchParams.get('gsrsearch');
    queries.push(query);
    const pages = query === 'rainbow' ? [
      { pageid: 10, index: 1, title: 'Unrelated article', extract: 'This does not answer the question.' },
      { pageid: 20, index: 2, title: 'Rainbow', extract: 'A rainbow forms when light is refracted and reflected in water droplets.' }
    ] : [{ pageid: 30, index: 1, title: 'Minecraft', extract: 'Minecraft is a sandbox game.' }];
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { query: { pages } } });
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#web-search?mode=ai');
  await page.getByRole('button', { name: 'Plan a task' }).click();
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(panel(page).getByRole('heading', { name: 'Built-in study plan' })).toBeVisible();
  await expect(panel(page).getByText('20-minute study plan for a history quiz')).toBeVisible();
  await expect(page.locator('.assistant-result-text li')).toHaveCount(4);
  expect(queries).toEqual([]);

  await page.getByRole('button', { name: 'Explain a topic' }).click();
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'Wikipedia excerpt' })).toBeVisible();
  await expect(panel(page).getByText(/light is refracted and reflected/)).toBeVisible();
  await expect(panel(page).getByRole('link', { name: 'Rainbow', exact: true })).toHaveAttribute('href', 'https://en.wikipedia.org/?curid=20');
  await expect(panel(page).getByText('Unrelated article')).toHaveCount(0);

  await prompt(page).fill('Minecraft');
  await prompt(page).press('Enter');
  await expect(panel(page).getByText('Minecraft is a sandbox game.')).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Related videos' })).toBeVisible();
  await expect(page.locator('.assistant-related a').first()).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/(?:watch\?v=|shorts\/)/);
  expect(queries).toEqual(['rainbow', 'Minecraft']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

async function startGateway() {
  const calls = [];
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  const source = { title: 'Weather service reference', url: 'https://www.weather.gov/jetstream/rainbow', description: 'Light and weather.' };
  const server = createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers).end();
      return;
    }
    let body = '';
    for await (const chunk of request) body += chunk;
    const call = { body: JSON.parse(body), authorization: request.headers.authorization, ended: false };
    calls.push(call);
    response.once('close', () => { call.ended = true; });
    if (calls.length === 3) {
      response.writeHead(503, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'The test provider is unavailable.' }));
      return;
    }
    response.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    const event = data => response.write(`data: ${JSON.stringify(data)}\n\n`);
    const delta = content => event({ choices: [{ delta: { content } }] });
    event({ sources: [source] });
    delta(calls.length === 1 ? 'Water droplets redirect sunlight' : 'Unfinished follow-up');
    call.finish = () => {
      delta(' into colors [1].\n\n- Light refracts through water.\n- [Unverified link](https://unverified.example/claim)');
      response.end('data: [DONE]\n\n');
    };
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls, source,
    close() {
      server.closeAllConnections();
      return new Promise(resolve => server.close(resolve));
    }
  };
}

test('connected AI is explicit, streams cited answers, stops follow-ups, and falls back locally', async ({ page }) => {
  test.setTimeout(45_000);
  const gateway = await startGateway();
  let wikipediaCalls = 0;
  await page.route(url => url.hostname === 'en.wikipedia.org', route => {
    wikipediaCalls++;
    return route.abort();
  });
  try {
    await page.goto('/#web-search?mode=ai');
    await panel(page).getByText('Connected AI', { exact: true }).click();
    await panel(page).getByText('Connect an AI provider', { exact: true }).click();
    await panel(page).getByLabel('Backend URL').fill(gateway.url);
    await panel(page).getByLabel('Backend access code').fill('test-code');
    await panel(page).getByRole('button', { name: 'Connect backend' }).click();
    await page.getByRole('button', { name: 'Plan a task' }).click();
    await prompt(page).press('Enter');
    await expect(panel(page).getByRole('heading', { name: 'Built-in study plan' })).toBeVisible();
    expect(gateway.calls).toHaveLength(0);

    await panel(page).getByRole('checkbox', { name: 'Use web research for sources' }).check();
    await prompt(page).fill('How do rainbows form?');
    await panel(page).getByRole('button', { name: 'Ask connected AI', exact: true }).click();
    const reply = page.locator('.assistant-result-text');
    await expect(reply).toHaveText('Water droplets redirect sunlight');
    expect(gateway.calls[0].authorization).toBe('Bearer test-code');
    expect(gateway.calls[0].body).toMatchObject({ research: true, stream: true, messages: [
      { role: 'user', content: 'How do rainbows form?' }
    ] });
    gateway.calls[0].finish();
    await expect(reply.getByRole('link', { name: 'Source 1' })).toHaveAttribute('href', gateway.source.url);
    await expect(panel(page).getByRole('link', { name: gateway.source.title })).toHaveAttribute('href', gateway.source.url);
    await expect(reply.getByRole('link', { name: 'Unverified link' })).toHaveCount(0);

    await panel(page).getByRole('button', { name: 'Ask a follow-up' }).click();
    await prompt(page).fill('What bends the light?');
    await panel(page).getByRole('button', { name: 'Ask connected AI', exact: true }).click();
    await expect(reply).toHaveText('Unfinished follow-up');
    expect(gateway.calls[1].body.messages.map(message => message.role)).toEqual(['user', 'assistant', 'user']);
    await panel(page).getByRole('button', { name: 'Stop answering', exact: true }).click();
    await expect(panel(page).getByText('Answer stopped.', { exact: true })).toBeVisible();
    await expect(reply).toContainText('Water droplets redirect sunlight');
    await expect.poll(() => gateway.calls[1].ended).toBe(true);

    await panel(page).getByRole('button', { name: 'Start a new question' }).click();
    await prompt(page).fill('Make a 15-minute study plan for music theory');
    await panel(page).getByRole('button', { name: 'Ask connected AI', exact: true }).click();
    await expect(panel(page).getByRole('heading', { name: 'Built-in study plan' })).toBeVisible();
    await expect(panel(page).getByText('The connected model could not finish. A built-in guide is available.')).toBeVisible();
    expect(gateway.calls).toHaveLength(3);
    expect(wikipediaCalls).toBe(0);
  } finally {
    await gateway.close();
  }
});

test('AI Mode can explicitly prepare and use the CPU model', async ({ page }) => {
  await page.route(url => url.pathname === '/assets/blip-cpu.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    let ready = false;
    export const cpuBlipReady = () => ready;
    export const cpuBlipAvailability = async () => ready ? 'available' : 'downloadable';
    export async function prepareCpuBlipModel(signal, progress) {
      signal.throwIfAborted();
      progress(0.5, 'Preparing test model');
      ready = true;
    }
    export async function runCpuBlipPrompt(messages) {
      if (!ready || !messages[1].content.includes('project outline')) throw new Error('Missing request');
      return 'Start by writing one outcome and three milestones.';
    }
  ` }));
  await page.goto('/#web-search?mode=ai');
  await panel(page).getByText('Sources and on-device AI', { exact: true }).click();
  await panel(page).getByRole('checkbox', { name: 'Look up topics on Wikipedia' }).uncheck();
  await panel(page).getByRole('button', { name: 'Download CPU model (271 MB)' }).click();
  await expect(panel(page).getByText('The CPU model is ready to answer locally.')).toBeVisible();
  await prompt(page).fill('Help with a project outline');
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'CPU on-device AI answer' })).toBeVisible();
  await expect(panel(page).getByText('Start by writing one outcome and three milestones.')).toBeVisible();
});
