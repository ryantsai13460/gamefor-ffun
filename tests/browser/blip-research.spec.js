import { expect, test } from '@playwright/test';

test('Blip Search keeps the full question, preserves its phrase for retry, and honors gateway limits', async ({ page }) => {
  const question = 'Compare ways to learn violin. '.repeat(9).trim();
  const phrase = 'violin practice techniques';
  const messages = [{ role: 'user', content: question }];
  const gatewayCalls = [];
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-expose-headers': 'retry-after',
  };
  await page.addInitScript(() => Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined }));
  await page.route('https://**/*', route => route.abort());
  await page.route('https://gateway.example/api/**', route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.url().endsWith('/api/capabilities')) {
      return route.fulfill({ headers, json: {
        chat: true, advanced: true, search: true, research: true, youtube: false,
        customResearchQuery: true, standardOutputTokens: 700, advancedOutputTokens: 1800,
      } });
    }
    gatewayCalls.push(request.postDataJSON());
    if (gatewayCalls.length === 1) return route.fulfill({ status: 429, headers: { ...headers, 'retry-after': '4' }, json: {
      error: 'Too many requests. Try again in a minute.',
    } });
    const sources = [{ title: 'Violin study source', url: 'https://example.com/violin', description: 'Start with open strings.' }];
    const reply = { choices: [{ delta: { content: 'Practice with open strings. [1]' } }] };
    return route.fulfill({ headers, contentType: 'text/event-stream', body: [
      `data: ${JSON.stringify({ sources })}\n\n`, `data: ${JSON.stringify(reply)}\n\n`, 'data: [DONE]\n\n',
    ].join('') });
  });
  await page.goto('/#web-search');
  const search = page.getByRole('combobox', { name: 'Search the web' });
  await search.fill(phrase);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Research with Blip' }).click();
  await expect(page.getByRole('checkbox', { name: 'Research current question with Brave Search' })).toBeChecked();
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  const lookup = page.getByRole('searchbox', { name: 'Web lookup phrase' });
  await expect(input).toHaveValue(phrase);
  await expect(lookup).toHaveValue(phrase);
  expect(gatewayCalls).toHaveLength(0);
  await input.fill(question);
  await input.press('Enter');
  await expect(page.getByText('Set up online research before sending this question.', { exact: true })).toBeVisible();
  await expect(page.locator('.blip-message--user')).toHaveCount(0);

  await page.getByRole('button', { name: 'Set up online research' }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await page.getByRole('checkbox', { name: 'Use the connected model for chats without files' }).check();
  await expect(page.getByText('Online replies use up to 700 tokens, or 1,800 with Advanced replies.')).toBeVisible();
  await page.locator('.blip-settings-popover > summary').click();
  await expect(input).toHaveValue(question);
  await expect(lookup).toHaveValue(phrase);
  await lookup.fill('');
  await input.press('Enter');
  await expect(page.getByText('Enter a web lookup phrase of up to 200 characters.', { exact: true })).toBeVisible();
  expect(gatewayCalls).toHaveLength(0);
  await lookup.fill(phrase);
  await input.press('Enter');
  const thread = page.getByRole('region', { name: 'Conversation messages' });
  await expect(thread).toContainText('Too many requests.');
  await expect(page.getByText(/Online AI is waiting before another try/)).toBeVisible();
  const regenerate = page.getByRole('button', { name: 'Regenerate', exact: true });
  await regenerate.click();
  expect(gatewayCalls).toHaveLength(1);
  await expect(page.getByText(/Online AI is waiting before another try/)).toBeHidden({ timeout: 6500 });
  await regenerate.click();
  await expect(thread.getByRole('link', { name: 'Violin study source' })).toHaveAttribute('href', 'https://example.com/violin');
  await expect(page.getByRole('link', { name: 'Source 1', exact: true })).toHaveAttribute('href', 'https://example.com/violin');
  expect(gatewayCalls).toEqual(Array(2).fill({ messages, mode: 'quick', stream: true, research: true, researchQuery: phrase }));
  await expect(page).toHaveURL(/#blip\?chat=[a-z0-9_-]+$/i);
  await page.reload();
  await expect(thread).toContainText(`Web lookup phrase · ${phrase}`);
  await expect(thread.getByRole('link', { name: 'Violin study source' })).toBeVisible();
});
