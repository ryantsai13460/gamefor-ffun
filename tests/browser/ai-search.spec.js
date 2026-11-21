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

test('Draft in AI Mode carries a Web Search query in the same tab and preserves an edited question', async ({ page }) => {
  const firstQuery = 'Compare HTML and CSS';
  const secondQuery = 'Why is the sky blue?';
  await page.goto('/#web-search');
  const web = page.getByRole('combobox', { name: 'Search the web' });
  await web.fill(firstQuery);
  await web.press('Enter');
  const categories = page.getByRole('group', { name: 'Result category' });
  const wiki = categories.getByRole('button', { name: 'Wiki', exact: true });
  await wiki.click();
  const tabs = page.getByRole('tablist', { name: 'Web Search tabs' });
  await page.getByRole('button', { name: 'Draft in AI Mode', exact: true }).click();
  await expect(prompt(page)).toHaveValue(firstQuery);
  await expect(prompt(page)).toBeFocused();
  await expect(page.locator('.assistant-result')).toBeHidden();
  await expect(page).toHaveURL(/\/#web-search$/);
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText(firstQuery);
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'Reference comparison' })).toBeVisible();
  await prompt(page).fill('My unsent question about the comparison');

  await page.getByRole('button', { name: 'Web & YouTube', exact: true }).click();
  await expect(web).toHaveValue(firstQuery);
  await expect(wiki).toHaveAttribute('aria-pressed', 'true');
  await web.fill(secondQuery);
  await web.press('Enter');
  await page.getByRole('button', { name: 'Draft in AI Mode', exact: true }).click();
  await expect(prompt(page)).toHaveValue('My unsent question about the comparison');
  await expect(panel(page).getByText('Web Search query: ' + secondQuery)).toBeVisible();
  await panel(page).getByRole('button', { name: 'Use Web Search query', exact: true }).click();
  await expect(prompt(page)).toHaveValue(secondQuery);
  await expect(panel(page).getByRole('heading', { name: 'Reference comparison' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Reference explanation' })).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(1);
});

test('an AI Mode handoff waits for a running answer and leaves it visible after loading the new draft', async ({ page }) => {
  await page.goto('/#web-search');
  await page.getByRole('combobox', { name: 'Search the web' }).waitFor();
  await page.evaluate(() => {
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => 'available',
        create: async () => ({
          prompt: async () => new Promise(resolve => { window.completeAiSearch = resolve; }),
          destroy() {}
        })
      }
    });
  });
  await page.getByRole('button', { name: 'AI Mode', exact: true }).click();
  await prompt(page).fill('Explain how orbital motion works');
  await prompt(page).press('Enter');
  await expect.poll(() => page.evaluate(() => typeof window.completeAiSearch)).toBe('function');

  await page.getByRole('button', { name: 'Web & YouTube', exact: true }).click();
  const web = page.getByRole('combobox', { name: 'Search the web' });
  await web.fill('What causes the seasons?');
  await web.press('Enter');
  await page.getByRole('button', { name: 'Draft in AI Mode', exact: true }).click();
  const offered = panel(page).getByRole('button', { name: 'Use Web Search query', exact: true });
  await expect(offered).toBeDisabled();
  await expect(prompt(page)).toHaveValue('Explain how orbital motion works');
  await expect(panel(page).getByRole('button', { name: 'Stop answering', exact: true })).toBeVisible();
  await page.evaluate(() => window.completeAiSearch('The text from the original answer.'));
  await expect(offered).toBeEnabled();
  await expect(panel(page).getByText('The text from the original answer.')).toBeVisible();
  await offered.click();
  await expect(prompt(page)).toHaveValue('What causes the seasons?');
  await expect(panel(page).getByText('The text from the original answer.')).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Stop answering', exact: true })).toBeHidden();
});

test('an AI Mode link opens an editable question without submitting it', async ({ page }) => {
  let wikipediaRequests = 0;
  await page.route(url => url.hostname === 'en.wikipedia.org', route => {
    wikipediaRequests++;
    return route.abort();
  });
  await page.goto('/#web-search?mode=ai&q=Explain+orbital+motion');
  await expect(page.getByRole('button', { name: 'AI Mode', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(prompt(page)).toHaveValue('Explain orbital motion');
  await expect(page.locator('.assistant-result')).toBeHidden();
  expect(wikipediaRequests).toBe(0);
});

test('AI Mode explains reference topics and calculates without a model or external lookup', async ({ page }) => {
  let lookups = 0;
  await page.route(url => url.hostname === 'en.wikipedia.org', route => {
    lookups++;
    return route.abort();
  });
  await page.goto('/#web-search?mode=ai');
  await panel(page).getByRole('button', { name: 'Compare topics' }).click();
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'Reference comparison' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'HTML', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'CSS', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('link', { name: 'What is CSS?', exact: true })).toHaveAttribute('href', /^https:\/\/developer\.mozilla\.org\//);
  await prompt(page).fill('Why is the sky blue?');
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'Reference explanation' })).toBeVisible();
  await expect(panel(page).getByText(/shorter blue wavelengths/)).toBeVisible();
  await expect(panel(page).getByRole('link', { name: 'Why Is the Sky Blue?', exact: true })).toHaveAttribute('href', 'https://spaceplace.nasa.gov/blue-sky/en/');
  await prompt(page).fill('Find the average of 12, 15, and 18');
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'Calculator' })).toBeVisible();
  await expect(page.locator('.assistant-result-text')).toContainText('Mean: 15');
  await expect(page.locator('.assistant-result-text')).toContainText('divide by 3');
  expect(lookups).toBe(0);
});

test('AI Mode looks up the two sides of a comparison and keeps the source excerpts distinct', async ({ page }) => {
  const queries = [];
  let partial = false;
  await page.route(url => url.hostname === 'en.wikipedia.org', route => {
    const query = new URL(route.request().url()).searchParams.get('gsrsearch');
    queries.push(query);
    if (partial && query === 'Venus') return route.abort();
    const pageData = query === 'Mercury' ? { pageid: 47, index: 1, title: 'Mercury', extract: 'Mercury is the first planet from the Sun.' }
      : { pageid: 48, index: 1, title: 'Venus', extract: 'Venus is the second planet from the Sun.' };
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { query: { pages: [pageData] } } });
  });
  await page.goto('/#web-search?mode=ai');
  await prompt(page).fill('Compare Mercury and Venus');
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'Wikipedia excerpts' })).toBeVisible();
  await expect(page.locator('.assistant-result-text')).toContainText('Mercury is the first planet');
  await expect(page.locator('.assistant-result-text')).toContainText('Venus is the second planet');
  await expect(panel(page).getByRole('link', { name: 'Mercury', exact: true })).toHaveAttribute('href', 'https://en.wikipedia.org/?curid=47');
  await expect(panel(page).getByRole('link', { name: 'Venus', exact: true })).toHaveAttribute('href', 'https://en.wikipedia.org/?curid=48');
  expect(queries.sort()).toEqual(['Mercury', 'Venus']);

  partial = true;
  await prompt(page).press('Enter');
  await expect(panel(page).getByRole('heading', { name: 'Wikipedia excerpt', exact: true })).toBeVisible();
  await expect(panel(page).getByText('One source excerpt is available for this comparison.')).toBeVisible();
  await expect(panel(page).getByRole('link', { name: 'Search web and YouTube', exact: true }))
    .toHaveAttribute('href', '#web-search?q=Compare+Mercury+and+Venus');
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
      delta([
        ' into colors [1].',
        '- Light refracts through water.',
        '- [Unverified link](https://unverified.example/claim)',
        '- [Nested [link](https://shown.example)](https://unverified.example/nested)',
        '| Text | Citation |',
        '| --- | --- |',
        '| [Table link](https://unverified.example/table) | [1] |',
        '```markdown',
        '[Literal example](https://unverified.example/code)',
        '```'
      ].join('\n'));
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
    const citations = reply.getByRole('link', { name: 'Source 1' });
    await expect(citations).toHaveCount(2);
    await expect(citations.first()).toHaveAttribute('href', gateway.source.url);
    await expect(citations.last()).toHaveAttribute('href', gateway.source.url);
    await expect(panel(page).getByRole('link', { name: gateway.source.title })).toHaveAttribute('href', gateway.source.url);
    await expect(reply.getByRole('link')).toHaveCount(2);
    await expect(reply.locator('pre code')).toHaveText('[Literal example](https://unverified.example/code)');

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
    export function releaseCpuBlipModel() {
      if (ready) globalThis.releasedTestCpuModel = true;
      ready = false;
    }
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

  await page.getByRole('button', { name: 'New search tab' }).click();
  await page.getByRole('tab', { selected: true }).press('Delete');
  expect(await page.evaluate(() => globalThis.releasedTestCpuModel)).toBeUndefined();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.releasedTestCpuModel)).toBe(true);
});
