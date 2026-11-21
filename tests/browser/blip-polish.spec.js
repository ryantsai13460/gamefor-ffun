import { test, expect } from '@playwright/test';

test('Blip streams a browser model in Code mode and renders safe tables and equations', async ({ page }) => {
  const body = [
    String.raw`A fraction is \(\frac{3}{4}\).`,
    '',
    String.raw`$$x_i^2 = \sqrt{81}$$`,
    '',
    '| Item | Count |',
    '| --- | ---: |',
    '| **Samples** | 3 |',
    '',
    '[Documentation](https://example.com/docs)',
    '[Unsafe link](javascript:alert%281%29)',
    '<img src=x onerror="window.modelExecutedHtml=true">',
  ].join('\n');
  await page.addInitScript(text => {
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => 'available',
        async create({ initialPrompts }) {
          window.blipModelInstruction = initialPrompts[0].content;
          return {
            async *promptStreaming() {
              yield 'Streaming ';
              await new Promise(resolve => { window.finishBlipModelFixture = resolve; });
              yield text;
            },
            destroy() {},
          };
        },
      },
    });
  }, body);
  await page.goto('/#blip');
  await page.getByText('Code', { exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('Give an example of formatting a math result in a coding lesson.');
  await input.press('Enter');
  await expect(page.locator('.blip-reply-stream')).toContainText('Streaming');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.evaluate(() => window.finishBlipModelFixture());
  const reply = page.locator('.blip-message--assistant .blip-message-text');
  await expect(reply.getByRole('columnheader', { name: 'Count' })).toBeVisible();
  await expect(reply.getByRole('cell', { name: 'Samples' })).toBeVisible();
  await expect(reply.locator('math mfrac')).toHaveCount(1);
  await expect(reply.locator('math[display="block"] msubsup')).toHaveCount(1);
  await expect(reply.locator('math[display="block"] msqrt')).toHaveCount(1);
  await expect(reply.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', 'https://example.com/docs');
  await expect(reply.getByText(/\[Unsafe link\]\(javascript:/)).toBeVisible();
  await expect(reply.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.modelExecutedHtml)).toBeUndefined();
  expect(await page.evaluate(() => window.blipModelInstruction)).toContain('runnable example');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Code', exact: true })).toBeChecked();
  await expect(reply.locator('math mfrac')).toHaveCount(1);
});

test('Blip toggles its desktop rail with keyboard shortcuts and remembers the chat theme', async ({ page }) => {
  await page.goto('/#blip');
  const chat = page.locator('.blip');
  const rail = page.getByRole('complementary', { name: 'Saved conversations' });
  const toggle = page.getByRole('button', { name: 'Chats', exact: true });
  await expect(rail).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(rail).toBeHidden();
  await toggle.press('Alt+Shift+h');
  await expect(rail).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search chats' })).toBeFocused();
  await page.keyboard.press('Alt+Shift+m');
  await expect(page.getByRole('textbox', { name: 'Message blip.ai' })).toBeFocused();
  await page.keyboard.press('Alt+Shift+n');
  await expect(rail.getByRole('listitem')).toHaveCount(2);
  await page.getByText('Chat tools', { exact: true }).click();
  await page.getByLabel('Chat theme').selectOption('light');
  await expect(chat).toHaveCSS('color-scheme', 'light');
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(chat).toHaveAttribute('data-theme', 'light');
});

test('search links prefill a fresh Blip chat without submitting the draft', async ({ page }) => {
  await page.goto('/#blip');
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('hi');
  await input.press('Enter');
  await expect(page.getByText(/Want to plan something/)).toBeVisible();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('gamefor-ffun:blip:v1')).activeId);
  const draft = 'Explain this game guide and include the original link.';
  await page.goto('/#blip?draft=' + encodeURIComponent(draft));
  await expect(input).toHaveValue(draft);
  await expect(page.locator('.blip-message--user')).toHaveCount(0);
  await page.goto('/#blip?chat=' + encodeURIComponent(id));
  await expect(page.locator('.blip-message--user')).toContainText('hi');
  await expect(input).toBeEmpty();
});

test('the WebGPU worker streams replies and recovers from a stalled generation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => ({}) } });
  });
  await page.route('**/assets/vendor/webllm-0.2.89/index.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      export class MLCEngine {
        async reload() {}
        chat = { completions: { create: async function* ({stream}) {
          if (!stream) throw new Error('This test expects real streaming requests.');
          yield { choices: [{ delta: { content: 'WebGPU first fragment.' } }] };
          const live = await new Promise(resolve => { self.resumeWebGPUFixture = resolve; });
          if (live) yield { choices: [{ delta: { content: ' Reply complete.' } }] };
        } } };
        interruptGenerate() { self.resumeWebGPUFixture?.(false); }
      }
    `,
  }));
  await page.goto('/#blip');
  await page.locator('.blip-settings-popover > summary').click();
  await page.getByRole('button', { name: 'Start local AI', exact: true }).click();
  await expect(page.getByText('WebGPU AI ready.', { exact: true })).toBeVisible();
  await page.locator('.blip-settings-popover > summary').click();
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await input.fill('Give me an example of arcade history.');
  await input.press('Enter');
  await expect(page.locator('.blip-reply-stream')).toContainText('WebGPU first fragment.');
  const worker = page.workers().find(item => item.url().includes('blip-model-worker.js'));
  await worker.evaluate(() => self.resumeWebGPUFixture(true));
  await expect(page.getByText('WebGPU first fragment. Reply complete.', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout = ms => timeout(ms === 80_000 ? 200 : ms);
  });
  await input.fill('Now describe a classic puzzle game.');
  await input.press('Enter');
  await expect(page.getByText(/WebGPU AI took too long to reply/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use CPU AI instead', exact: true })).toBeVisible();
});
