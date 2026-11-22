import { expect, test } from '@playwright/test';

function textPdf(text) {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let file = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const position = Buffer.byteLength(file);
    file += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return position;
  });
  return Buffer.from(file + `xref\n0 6\n0000000000 65535 f \n${offsets.map(position => `${String(position).padStart(10, '0')} 00000 n `).join('\n')}\n` +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(file)}\n%%EOF\n`);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503 }));
});

test('blip.ai keeps conversations and thinking methods separate across reloads', async ({ page }) => {
  await page.addInitScript(() => {
    window.blipPrompts = [];
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => 'available',
        create: async ({ initialPrompts }) => ({
          async prompt(text) {
            window.blipPrompts.push({ text, initialPrompts });
            return initialPrompts.length > 1 ? 'Keep using the same guitar practice plan.' : 'Start with a ten-minute guitar practice.';
          },
          destroy() {}
        })
      }
    });
  });
  await page.goto('/#blip');
  await expect(page.getByRole('heading', { level: 1, name: 'blip.ai', exact: true })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await page.locator('.blip-mode').filter({ hasText: 'Think it through' }).click();
  await expect(page.getByRole('radio', { name: 'Think it through' })).toBeChecked();
  await input.fill('Help me practice guitar.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Start with a ten-minute guitar practice.')).toBeVisible();
  await input.fill('What should I do tomorrow?');
  await input.press('Enter');
  await expect(page.getByText('Keep using the same guitar practice plan.')).toBeVisible();
  const calls = await page.evaluate(() => window.blipPrompts);
  expect(calls[1].initialPrompts[0].content).toContain('Give a conclusion and the key reasons the user can check');
  expect(calls[1].initialPrompts.slice(1)).toEqual([
    { role: 'user', content: 'Help me practice guitar.' },
    { role: 'assistant', content: 'Start with a ten-minute guitar practice.' }
  ]);

  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  const rename = page.getByRole('dialog', { name: 'Rename chat' });
  await rename.getByRole('textbox', { name: 'Chat name' }).fill('Guitar plan');
  await rename.getByRole('button', { name: 'Save name' }).click();
  const rail = page.getByRole('complementary', { name: 'Saved conversations' });
  await rail.getByRole('button', { name: 'New chat', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Quick', exact: true })).toBeChecked();
  await expect(page.getByText('Keep using the same guitar practice plan.')).toHaveCount(0);
  await input.fill('Calculate 6 × 7');
  await input.press('Enter');
  await expect(page.getByText('42', { exact: true })).toBeVisible();

  await rail.getByRole('button', { name: 'Guitar plan', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Think it through' })).toBeChecked();
  await expect(page.getByText('Keep using the same guitar practice plan.')).toBeVisible();
  await rail.getByRole('button', { name: 'Calculate 6 × 7', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete this chat?' }).getByRole('button', { name: 'Delete chat' }).click();
  await expect(rail.getByRole('button', { name: 'Calculate 6 × 7', exact: true })).toHaveCount(0);
  await expect(rail.getByRole('button', { name: 'Guitar plan', exact: true })).toBeVisible();
});

test('blip.ai works on a phone and looks up sources only when enabled', async ({ page }) => {
  let lookups = 0;
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
  });
  await page.route(url => url.hostname === 'en.wikipedia.org' && url.pathname === '/w/api.php', route => {
    lookups++;
    expect(new URL(route.request().url()).searchParams.get('gsrsearch')).toBe('violin');
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { query: { pages: [{ pageid: 32747, title: 'Violin', extract: 'The violin is a bowed string instrument.' }] } }
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#blip');
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('hi');
  await input.press('Enter');
  await expect(page.getByText('Hey! Want to plan something, practice a topic, or try a quick calculation?')).toBeVisible();
  await input.fill('wsp');
  await input.press('Enter');
  await expect(page.getByText('Local reply', { exact: true })).toHaveCount(2);
  await input.fill('Convert 5 miles to km.');
  await input.press('Enter');
  await expect(page.getByText('5 mi = 8.04672 km')).toBeVisible();
  await input.fill('What is violin');
  await input.press('Enter');
  await expect(page.getByText('Blip unavailable', { exact: true })).toBeVisible();
  expect(lookups).toBe(0);
  await page.getByText(/^(AI settings|Set up AI)$/).click();
  await page.getByRole('checkbox', { name: 'Use Wikipedia as a fallback' }).check();
  await page.getByText(/^(AI settings|Set up AI)$/).click();
  await input.fill('What is violin');
  await input.press('Enter');
  await expect(page.getByRole('link', { name: 'Wikipedia · Violin' })).toHaveAttribute('href', 'https://en.wikipedia.org/?curid=32747');
  await expect(page.getByText('The violin is a bowed string instrument.')).toBeVisible();
  expect(lookups).toBe(1);
  const chats = page.getByRole('button', { name: 'Chats', exact: true });
  await chats.click();
  await expect(page.getByRole('complementary', { name: 'Saved conversations' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('Blip starts an opted-in local engine and retries the saved turn with context', async ({ page }) => {
  await page.addInitScript(() => {
    let ready = false;
    window.blipSetupAttempts = 0;
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => ready ? 'available' : 'downloadable',
        async create({ monitor, initialPrompts, signal } = {}) {
          if (monitor) {
            window.blipSetupAttempts++;
            await new Promise((resolve, reject) => {
              const download = new EventTarget();
              monitor(download);
              download.dispatchEvent(new ProgressEvent('downloadprogress', { loaded: 42, total: 100 }));
              window.finishBlipSetup = resolve;
              signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
            ready = true;
          }
          return {
            destroy() {},
            async prompt(text) {
              window.blipRetriedTurn = { text, initialPrompts };
              return 'A tide pool shelters small shore creatures between tides.';
            }
          };
        }
      }
    });
  });
  await page.goto('/#blip');
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  const thread = page.getByRole('region', { name: 'Conversation messages' });
  await input.fill('Calculate 6 × 7');
  await input.press('Enter');
  await expect(thread.getByText('42', { exact: true })).toBeVisible();
  await input.fill('Explain what is inside a tide pool');
  await input.press('Enter');
  await expect(thread.getByText('Blip unavailable', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.blipSetupAttempts)).toBe(0);

  const recovery = page.getByRole('complementary', { name: 'Reply recovery' });
  await recovery.getByRole('button', { name: 'Start local AI', exact: true }).click();
  await expect(recovery.getByRole('progressbar', { name: 'Local AI setup progress' })).toHaveAttribute('value', '42');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await page.evaluate(() => window.finishBlipSetup());
  await expect(thread.getByText('A tide pool shelters small shore creatures between tides.')).toBeVisible();
  await expect(thread.getByText('Blip unavailable', { exact: true })).toHaveCount(0);
  await expect(thread.locator('.blip-message--user')).toHaveCount(2);
  await expect(page.getByText('Reply engine · Browser AI ready')).toBeVisible();
  expect(await page.evaluate(() => window.blipSetupAttempts)).toBe(1);
  const retried = await page.evaluate(() => window.blipRetriedTurn);
  expect(retried.text).toBe('Explain what is inside a tide pool');
  expect(retried.initialPrompts.slice(1)).toEqual([
    { role: 'user', content: 'Calculate 6 × 7' }, { role: 'assistant', content: '42' },
  ]);
});

test('Blip offers the CPU model after setup fails and starts it only on request', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => 'downloadable',
        create: async () => { throw new Error('Test browser setup failure'); }
      }
    });
  });
  await page.route('**/assets/blip-cpu.js*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      let ready = false;
      window.blipCpuSetups = 0;
      export async function cpuBlipAvailability() { return ready ? 'available' : 'downloadable'; }
      export function cpuBlipReady() { return ready; }
      export async function prepareCpuBlipModel() { window.blipCpuSetups++; ready = true; }
      export function releaseCpuBlipModel() { ready = false; }
      export async function runCpuBlipPrompt() { return 'The CPU model retried the original question.'; }
    `
  }));
  await page.goto('/#blip');
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('Explain how tides affect a shipping schedule');
  await input.press('Enter');
  const recovery = page.getByRole('complementary', { name: 'Reply recovery' });
  await expect(recovery.getByRole('button', { name: 'Use CPU AI instead' })).toBeVisible();
  await recovery.getByRole('button', { name: 'Start local AI', exact: true }).click();
  await expect(recovery.getByText('Browser AI could not start. Try another available model.')).toBeVisible();
  await expect(recovery.getByText(/CPU AI\. First-time setup downloads about 273 MB/)).toBeVisible();
  expect(await page.evaluate(() => window.blipCpuSetups)).toBe(0);
  await recovery.getByRole('button', { name: 'Start local AI', exact: true }).click();
  await expect(page.getByText('The CPU model retried the original question.')).toBeVisible();
  await expect(page.getByText('Reply engine · CPU AI ready')).toBeVisible();
  expect(await page.evaluate(() => window.blipCpuSetups)).toBe(1);
});

test('blip.ai keeps attached text in its saved chat and skips external lookup', async ({ page }) => {
  let lookups = 0;
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
  });
  await page.route(url => url.hostname === 'en.wikipedia.org', route => {
    lookups++;
    return route.abort();
  });
  await page.goto('/#blip');
  await page.getByText(/^(AI settings|Set up AI)$/).click();
  await page.getByRole('checkbox', { name: 'Use Wikipedia as a fallback' }).check();
  await page.getByText(/^(AI settings|Set up AI)$/).click();
  const picker = page.locator('input[type=file]');
  await picker.setInputFiles({
    name: 'study-notes.txt', mimeType: 'text/plain',
    buffer: Buffer.from('A cello has four strings.\nPractice slowly for ten minutes.')
  });
  await page.getByRole('button', { name: 'Preview study-notes.txt' }).click();
  const draftPreview = page.getByRole('dialog', { name: 'study-notes.txt' });
  await expect(draftPreview.getByText(/A cello has four strings/)).toBeVisible();
  await draftPreview.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Remove study-notes.txt' })).toBeVisible();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/2 lines · \d+ words in the loaded text/)).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('What is a cello?');
  await input.press('Enter');
  await expect(page.getByText(/2 lines · \d+ words in the loaded text/)).toHaveCount(2);
  expect(lookups).toBe(0);
  await page.reload();
  const attachment = page.locator('.blip-file-preview').filter({ hasText: 'study-notes.txt' });
  await attachment.locator('summary').click();
  await expect(attachment.getByText(/A cello has four strings/)).toBeVisible();
});

test('Blip retrieves relevant late passages for private file follow-ups', async ({ page }) => {
  await page.addInitScript(() => {
    window.filePrompts = [];
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => 'available',
        create: async () => ({
          prompt(text) { window.filePrompts.push(text); return 'A reply from the on-device model fixture.'; },
          destroy() {}
        })
      }
    });
  });
  await page.goto('/#blip');
  const latePassage = 'The observatory telescope opens at 7 p.m. on Thursdays.';
  await page.locator('input[type=file]').setInputFiles({
    name: 'observatory.txt', mimeType: 'text/plain',
    buffer: Buffer.from(`${'The building has a parking lot and a small reception room.\n'.repeat(93)}\n${latePassage}\nA walking path surrounds the park.\n`)
  });
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('Summarize the attachment.');
  await input.press('Enter');
  await expect(page.getByText('A reply from the on-device model fixture.')).toBeVisible();
  await input.fill('When does the telescope open?');
  await input.press('Enter');
  await expect(page.getByText('A reply from the on-device model fixture.')).toHaveCount(2);
  const prompt = await page.evaluate(() => window.filePrompts.at(-1));
  const [attachment] = JSON.parse(prompt.slice(prompt.indexOf('\n[') + 1));
  expect(attachment).toMatchObject({ name: 'observatory.txt', excerptTruncated: true });
  expect(attachment.excerpt).toContain(latePassage);
  expect(attachment.excerpt.length).toBeLessThanOrEqual(4000);
  expect(attachment.excerpt).not.toContain('parking lot');
});

test('replies stay with their original chat, and Stop cancels an in-progress reply', async ({ page }) => {
  await page.addInitScript(() => {
    window.blipJobs = {};
    window.blipStops = 0;
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => 'available',
        create: async () => ({
          prompt(text, { signal }) {
            return new Promise((resolve, reject) => {
              window.blipJobs[text] = resolve;
              signal.addEventListener('abort', () => {
                window.blipStops++;
                reject(signal.reason);
              }, { once: true });
            });
          },
          destroy() {}
        })
      }
    });
  });
  await page.goto('/#blip');
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('First question');
  await input.press('Enter');
  await page.waitForFunction(() => Boolean(window.blipJobs['First question']));
  const rail = page.getByRole('complementary', { name: 'Saved conversations' });
  await rail.getByRole('button', { name: 'New chat', exact: true }).click();
  await page.evaluate(() => { window.blipJobs['First question']('First chat answer.'); });
  const unread = rail.getByRole('button', { name: /First question.*New reply/ });
  await expect(unread).toBeVisible();
  await expect(page.getByText('First chat answer.')).toHaveCount(0);
  await unread.click();
  await expect(page.getByText('First chat answer.')).toBeVisible();

  await input.fill('Stop this reply');
  await input.press('Enter');
  await page.waitForFunction(() => Boolean(window.blipJobs['Stop this reply']));
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Reply stopped.')).toBeVisible();
  expect(await page.evaluate(() => window.blipStops)).toBe(1);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
});

test('blip.ai background music is opt-in and keeps playing while switching chats', async ({ page }) => {
  await page.goto('/#blip');
  const music = page.locator('.blip-music-popover > summary');
  await music.click();
  await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible();
  await page.getByRole('button', { name: 'Play music' }).click();
  await expect(page.getByText('Playing Blue Hour.')).toBeVisible({ timeout: 12000 });
  await music.click();
  await page.getByRole('complementary', { name: 'Saved conversations' }).getByRole('button', { name: 'New chat', exact: true }).first().click();
  await music.click();
  await expect(page.getByRole('button', { name: 'Pause music' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause music' }).click();
  await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible();
  await page.goto('/#home');
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
  await page.goto('/#blip');
  await music.click();
  await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible();
});

test('connected Blip streams authorized replies and regenerates the last answer', async ({ page }) => {
  let requests = 0;
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.copiedBlipText = text; } }
    });
  });
  await page.route('https://gateway.example/api/capabilities', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(route.request().headers().authorization).toBe('Bearer fixture-access');
    return route.fulfill({ headers, json: {
      chat: true, advanced: true, research: true, search: true, youtube: false, modes: ['quick', 'code']
    } });
  });
  await page.route('https://gateway.example/api/chat', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests++;
    expect(route.request().headers().authorization).toBe('Bearer fixture-access');
    const expected = { messages: [{ role: 'user', content: 'Show a JavaScript example' }], mode: 'quick', stream: true };
    if (requests === 3) {
      expected.depth = 'advanced';
      expected.mode = 'code';
    }
    expect(route.request().postDataJSON()).toEqual(expected);
    const text = ['**First example**\n\n```js\nconst score = 1;\n```', '**Updated example**', '**Advanced example**'][requests - 1];
    const event = JSON.stringify({ choices: [{ delta: { content: text } }] });
    const limit = requests === 2 ? 'data: {"choices":[{"finish_reason":"length"}]}\n\n' : '';
    await route.fulfill({ status: 200, headers, contentType: 'text/event-stream',
      body: `data: ${event}\n\n${limit}data: [DONE]\n\n` });
  });
  await page.goto('/#blip');
  await page.locator('.blip-settings-popover > summary').click();
  await page.getByText('Connect an AI provider', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await page.getByRole('checkbox', { name: 'Use the connected model for chats without files' }).check();
  await page.locator('.blip-settings-popover > summary').click();
  await page.getByRole('textbox', { name: 'Message blip.ai' }).fill('Show a JavaScript example');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.blip-message strong')).toHaveText('First example');
  await expect(page.locator('.blip-code-keyword')).toHaveText('const');
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect(page.getByText('Code copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.copiedBlipText)).toBe('const score = 1;');
  await expect(page.getByRole('button', { name: 'Copy response', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await expect(page.locator('.blip-message strong')).toHaveText('Updated example');
  await expect(page.getByText('This reply reached its model limit.')).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  const continueButton = page.getByRole('button', { name: 'Draft a continuation' });
  await input.fill('My unsent notes');
  await continueButton.click();
  await expect(input).toHaveValue('My unsent notes');
  await input.clear();
  await continueButton.click();
  await expect(input).toHaveValue('Continue the previous reply from the last unfinished point.');
  expect(requests).toBe(2);
  await page.locator('.blip-settings-popover > summary').click();
  await page.getByRole('checkbox', { name: 'Use Advanced replies' }).check();
  await page.locator('.blip-settings-popover > summary').click();
  await page.getByText('Code', { exact: true }).click();
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await expect(page.locator('.blip-message strong')).toHaveText('Advanced example');
  expect(requests).toBe(3);
});

test('Blip offers no-download Workers AI after opt-in and keeps attached chats local', async ({ page }) => {
  let hostedRequests = 0;
  let localModelDownloads = 0;
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  page.on('request', request => {
    if (/\.gguf(?:[?#]|$)|mlc-ai.*SmolLM2/.test(request.url())) localModelDownloads++;
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
  });
  await page.route('https://gateway.example/api/capabilities', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    return route.fulfill({ headers, json: {
      chat: true, chatProvider: 'workers-ai', advanced: false, research: false, search: false, youtube: false, standardOutputTokens: 512
    } });
  });
  await page.route('https://gateway.example/api/chat', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    hostedRequests++;
    expect(route.request().headers().authorization).toBe('Bearer fixture-access');
    expect(route.request().postDataJSON().messages.at(-1).content).toBe('How do I improve my chess opening?');
    await route.fulfill({ headers, contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Develop your minor pieces early."}}]}\n\ndata: [DONE]\n\n' });
  });

  await page.goto('/#blip');
  let settings = page.locator('.blip-settings-popover > summary');
  const optIn = page.getByRole('checkbox', { name: 'Use the connected model for chats without files' });
  await page.getByRole('button', { name: 'Set up online chat' }).click();
  await expect(page.getByLabel('Backend URL')).toBeFocused();
  await expect(optIn).toBeDisabled();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await expect(page.getByText(/Workers AI is configured/)).toBeVisible();
  await expect(optIn).not.toBeChecked();
  expect(hostedRequests).toBe(0);
  await optIn.check();
  await expect(page.getByRole('checkbox', { name: 'Use Advanced replies' })).toBeDisabled();
  await settings.click();
  let input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('How do I improve my chess opening?');
  await input.press('Enter');
  await expect(page.getByText('Develop your minor pieces early.')).toBeVisible();

  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('navigation', { name: 'Arcade navigation' }).getByRole('link', { name: 'blip.ai', exact: true }).click();
  settings = page.locator('.blip-settings-popover > summary');
  await settings.click();
  await expect(optIn).toBeChecked();
  await settings.click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'private-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('This attachment stays on the device.')
  });
  await expect(page.getByRole('button', { name: 'Preview private-notes.txt' })).toBeVisible();
  input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('Summarize the attachment');
  await input.press('Enter');
  await expect(page.locator('.blip-message--assistant').last()).toContainText('This attachment stays on the device.');
  expect(hostedRequests).toBe(1);
  expect(localModelDownloads).toBe(0);

  await page.reload();
  await settings.click();
  await expect(optIn).toBeDisabled();
  await expect(optIn).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('ffun.gateway.url'))).toBe('https://gateway.example');
});

test('Blip starter tasks give labeled code and math help without setting up a model', async ({ page }) => {
  await page.route(url => url.pathname.endsWith('/search-answer.js') && !url.search, route =>
    route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
  });
  await page.goto('/#blip');
  await page.getByRole('button', { name: 'Try a coding example', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Code', exact: true })).toBeChecked();
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await expect(input).toHaveValue('Show how to filter a list of game titles in JavaScript.');
  await input.press('Enter');
  const conversation = page.getByRole('region', { name: 'Conversation messages' });
  await expect(conversation.getByText('Local reply', { exact: true })).toBeVisible();
  await expect(conversation.locator('pre code')).toContainText('games.filter(title =>');
  await input.fill('Which is greater, 3/5 or 5/8?');
  await input.press('Enter');
  await expect(conversation.getByText('3/5 is less than 5/8.', { exact: true })).toBeVisible();
  await input.fill('Help me outline an essay.');
  await input.press('Enter');
  await expect(conversation.getByText(/working thesis/)).toBeVisible();
  await expect(conversation.getByText('On-device AI', { exact: true })).toHaveCount(0);
});

test('a failed connected reply can use built-in help without retrying the provider or sending a Wikipedia lookup', async ({ page }) => {
  let hostedRequests = 0;
  let wikipediaRequests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
  });
  await page.route('https://en.wikipedia.org/**', route => {
    wikipediaRequests++;
    return route.abort();
  });
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  await page.route('https://gateway.example/api/**', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (new URL(route.request().url()).pathname === '/api/capabilities') {
      return route.fulfill({ headers, json: { chat: true, advanced: false, research: false, search: false, youtube: false } });
    }
    hostedRequests++;
    return route.fulfill({ status: 503, headers, json: { error: 'The test gateway is unavailable.' } });
  });
  await page.goto('/#blip');
  await page.getByRole('button', { name: 'Set up online chat' }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await page.getByRole('checkbox', { name: 'Use the connected model for chats without files' }).check();
  await page.getByRole('checkbox', { name: 'Use Wikipedia as a fallback' }).check();
  await page.locator('.blip-settings-popover > summary').click();

  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('Make a 10-minute study plan for history.');
  await input.press('Enter');
  await expect(page.getByText('10-minute study plan for history', { exact: true })).toBeVisible();
  await expect(page.getByText('Connected AI was unavailable. Blip answered on this device.')).toBeVisible();
  expect(hostedRequests).toBe(1);

  await input.fill('Explain neutron stars.');
  await input.press('Enter');
  await expect(page.locator('.blip-message--assistant').last()).toContainText('The test gateway is unavailable.');
  expect(hostedRequests).toBe(2);
  expect(wikipediaRequests).toBe(0);
});

test('Blip resends an edited message in a new chat with the earlier context', async ({ page }) => {
  await page.goto('/#blip');
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  const thread = page.getByRole('region', { name: 'Conversation messages' });
  const rail = page.getByRole('complementary', { name: 'Saved conversations' });
  await input.fill('hi');
  await input.press('Enter');
  await expect(thread.getByText(/Want to plan something/)).toBeVisible();
  await input.fill('Calculate 6 × 7');
  await input.press('Enter');
  await expect(thread.getByText('42', { exact: true })).toBeVisible();

  const edit = thread.locator('.blip-message--user').filter({ hasText: 'Calculate 6 × 7' })
    .getByRole('button', { name: 'Edit & resend' });
  await input.fill('My unfinished prompt');
  await edit.click();
  await expect(input).toHaveValue('Calculate 6 × 7');
  await page.getByRole('button', { name: 'Cancel edit' }).click();
  await expect(input).toHaveValue('My unfinished prompt');
  await edit.click();
  await input.fill('Calculate 6 × 8');
  await input.press('Enter');
  await expect(thread.getByText('48', { exact: true })).toBeVisible();
  await expect(thread.getByText(/Want to plan something/)).toBeVisible();
  await expect(thread.getByText('42', { exact: true })).toHaveCount(0);

  const chatSearch = rail.getByRole('searchbox', { name: 'Search chats' });
  await chatSearch.fill('edited');
  await expect(rail.getByRole('button', { name: 'hi (edited)', exact: true })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'hi', exact: true })).toHaveCount(0);
  await chatSearch.fill('');
  await rail.getByRole('button', { name: 'hi', exact: true }).click();
  await expect(input).toHaveValue('My unfinished prompt');
  await expect(thread.getByText('42', { exact: true })).toBeVisible();
  await page.reload();
  await rail.getByRole('button', { name: 'hi (edited)', exact: true }).click();
  await expect(thread.getByText('48', { exact: true })).toBeVisible();
});

test('Blip research saves source links and keeps file chats local', async ({ page }) => {
  let requests = 0;
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
  });
  await page.route('https://gateway.example/api/capabilities', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    return route.fulfill({ headers, json: { chat: true, advanced: true, research: true, search: true, youtube: false } });
  });
  await page.route('https://gateway.example/api/chat', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests++;
    expect(route.request().postDataJSON()).toEqual({
      messages: [{ role: 'user', content: 'Which planet has the longest day?' }],
      mode: 'quick', research: true, stream: true
    });
    const sources = [{ title: 'NASA Venus facts', url: 'https://science.nasa.gov/venus/', description: 'Venus rotates slowly.' }];
    const delta = { choices: [{ delta: { content: 'Venus has a long rotation period. [1]' } }] };
    await route.fulfill({ headers, contentType: 'text/event-stream',
      body: `data: ${JSON.stringify({ sources })}\n\ndata: ${JSON.stringify(delta)}\n\ndata: [DONE]\n\n` });
  });
  await page.goto('/#blip');
  const settings = page.locator('.blip-settings-popover > summary');
  await settings.click();
  await page.getByText('Connect an AI provider', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await page.getByRole('checkbox', { name: 'Use the connected model for chats without files' }).check();
  await settings.click();
  await page.locator('.blip-research > summary').click();
  await page.getByRole('checkbox', { name: 'Research current question with Brave Search' }).check();

  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('Which planet has the longest day?');
  await input.press('Enter');
  const source = page.getByRole('link', { name: /NASA Venus facts/ });
  await expect(source).toHaveAttribute('href', 'https://science.nasa.gov/venus/');
  await expect(page.getByRole('link', { name: 'Source 1', exact: true })).toHaveAttribute('href', 'https://science.nasa.gov/venus/');
  await page.reload();
  await expect(source).toHaveAttribute('href', 'https://science.nasa.gov/venus/');

  await page.locator('input[type=file]').setInputFiles({
    name: 'private-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Private study notes for the next review.')
  });
  await expect(page.getByRole('button', { name: 'Preview private-notes.txt' })).toBeVisible();
  await input.fill('Summarize the attachment');
  await input.press('Enter');
  await expect(page.locator('.blip-message--assistant').last()).toContainText('Private study notes for the next review.');
  expect(requests).toBe(1);
});

test('Blip extracts private PDF text, exports a transcript, and keeps pinned chats first', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined }));
  await page.goto('/#blip');
  const sample = 'Orchard team planted forty trees on Tuesday.';
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await page.locator('input[type=file]').setInputFiles({
    name: 'orchard.pdf', mimeType: 'application/pdf', buffer: textPdf(sample)
  });
  await page.getByRole('button', { name: 'Preview orchard.pdf' }).click({ timeout: 12_000 });
  const preview = page.getByRole('dialog', { name: 'orchard.pdf' });
  await expect(preview.getByText(sample, { exact: false })).toBeVisible();
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  await input.fill('Summarize this attachment');
  await input.press('Enter');
  await expect(page.locator('.blip-message--assistant').last()).toContainText(sample);
  await page.getByText('Chat tools', { exact: true }).click();
  await page.getByRole('button', { name: 'Pin chat', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Download transcript' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('Summarize-this-attachment.txt');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString('utf8')).toContain(sample);

  const rail = page.getByRole('complementary', { name: 'Saved conversations' });
  await rail.getByRole('button', { name: 'New chat', exact: true }).click();
  await input.fill('Calculate 3 + 5');
  await input.press('Enter');
  await expect(page.getByText('8', { exact: true })).toBeVisible();
  await page.reload();
  const chats = rail.locator('.blip-chat-link');
  await expect(chats.first()).toHaveAccessibleName('Summarize this attachment');
  await chats.first().click();
  await expect(page.locator('.blip-message--assistant').last()).toContainText(sample);
});
