import { expect, test } from '@playwright/test';

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
  expect(calls[1].initialPrompts[0].content).toContain('Explain the key factors or steps');
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
  await page.route('https://gateway.example/api/chat', async route => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests++;
    expect(route.request().headers().authorization).toBe('Bearer fixture-access');
    expect(route.request().postDataJSON()).toEqual({
      messages: [{ role: 'user', content: 'Show a JavaScript example' }], mode: 'quick', stream: true
    });
    const text = requests === 1 ? '**First example**\n\n```js\nconst score = 1;\n```' : '**Updated example**';
    const event = JSON.stringify({ choices: [{ delta: { content: text } }] });
    await route.fulfill({ status: 200, headers, contentType: 'text/event-stream',
      body: `data: ${event}\n\ndata: [DONE]\n\n` });
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
  await expect(page.getByRole('button', { name: 'Copy response', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await expect(page.locator('.blip-message strong')).toHaveText('Updated example');
  expect(requests).toBe(2);
});
