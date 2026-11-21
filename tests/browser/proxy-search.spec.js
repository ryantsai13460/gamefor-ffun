import { expect, test } from '@playwright/test';

const viewerAddress = page => page.getByRole('textbox', { name: 'Address or search query' });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('Proxy Gemini searches the connected provider and preserves the official fallback', async ({ page }) => {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  let requests = 0;
  await page.route('https://gateway.example/api/search', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(route.request().postDataJSON()).toMatchObject({ q: 'learn about html' });
    requests++;
    if (requests === 2) return route.fulfill({ status: 503, headers });
    return route.fulfill({ headers, json: { results: [
      { title: 'HTML reference', url: 'https://example.com/reference', description: 'Publisher documentation.' },
      { title: 'Duplicate reference', url: 'https://example.com/reference', description: '' },
      { title: 'Eggy Car on Coolmath', url: 'https://www.coolmathgames.com/0-eggy-car', description: 'Portal result.' },
      { title: 'Local address', url: 'https://127.0.0.1/private', description: '' }
    ] } });
  });
  await page.route('https://example.com/reference', route => route.fulfill({
    contentType: 'text/html',
    headers: { 'content-security-policy': "frame-ancestors 'none'" },
    body: '<h1>The provider blocks this preview</h1>'
  }));

  await page.goto('/#web-search');
  await page.getByText('Connect a web search provider', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await page.getByRole('link', { name: 'Proxy Gemini', exact: true }).click();
  await viewerAddress(page).fill('learn about html');
  await viewerAddress(page).press('Enter');

  const results = page.locator('.proxy-search-results');
  await expect(results.getByRole('heading', { name: 'HTML reference' })).toBeVisible();
  await expect(results.getByRole('listitem')).toHaveCount(2);
  await expect(results.getByText('example.com', { exact: true })).toBeVisible();
  await expect(results.getByText('Publisher documentation.')).toBeVisible();
  const portal = results.getByRole('listitem').filter({ hasText: 'Eggy Car on Coolmath' });
  await expect(portal.getByRole('link')).toHaveCount(0);
  await portal.getByRole('button', { name: 'See in-page options for Eggy Car on Coolmath' }).click();
  await expect(page.getByRole('heading', { name: 'Eggy Car isn’t available in-page' })).toBeVisible();
  await expect(page.locator('.proxy-frame')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const official = results.getByRole('link', { name: 'Open HTML reference in new tab' });
  await expect(official).toHaveAttribute('href', 'https://example.com/reference');
  await expect(official).toHaveAttribute('target', '_blank');
  await results.getByRole('button', { name: 'New viewer tab for HTML reference', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'example.com' })).toHaveAttribute('aria-selected', 'true');
  await expect(viewerAddress(page)).toHaveValue('https://example.com/reference');
  await expect(page.getByRole('link', { name: 'Open in new tab', exact: true })).toHaveAttribute('href', 'https://example.com/reference');
  await page.getByRole('button', { name: 'Close example.com tab' }).click();
  await expect(results.getByRole('heading', { name: 'HTML reference' })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
  expect(requests).toBe(1);

  await results.getByRole('button', { name: 'Preview HTML reference' }).click();
  await expect(page.locator('.proxy-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.getByText(/the site may block embedding/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in new tab', exact: true })).toHaveAttribute('href', 'https://example.com/reference');

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(results.getByRole('heading', { name: 'HTML reference' })).toBeVisible();
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(results.getByText(/provider could not return results/)).toBeVisible();
  expect(requests).toBe(2);
  await expect(page.getByRole('link', { name: 'Search web and YouTube' })).toHaveAttribute('href', '#web-search?q=learn+about+html');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.evaluate(() => { location.hash = '#web-search'; });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByText('Connect a web search provider', { exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('link', { name: 'Proxy Gemini', exact: true }).click();
  await expect(viewerAddress(page)).toHaveValue('learn about html');
  await expect(page.getByText('Connect a provider in Web Search to see live results here.')).toBeVisible();
  await expect(results.getByRole('heading', { name: 'HTML reference' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Connect a provider in Web Search' }).click();
  await expect(page).toHaveURL(/#web-search$/);
  await page.getByText('Connect a web search provider', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect backend' })).toBeVisible();
  expect(requests).toBe(2);
});

test('Proxy Gemini shares committed addresses and preserves YouTube timestamps', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      async writeText(value) {
        if (window.copiedViewerLink) throw new DOMException('Clipboard unavailable', 'NotAllowedError');
        window.copiedViewerLink = value;
      }
    } });
  });
  await page.route('https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?*', route => route.fulfill({
    contentType: 'text/html', body: '<p>Official player fixture</p>'
  }));
  await page.goto('/?site-option=not-shared#browse');
  const share = page.getByRole('button', { name: 'Share current page' });
  await expect(share).toBeDisabled();
  const address = viewerAddress(page);
  const shortLink = 'https://youtu.be/M7lc1UVf-VE?t=1m30s';
  await address.fill(shortLink);
  await address.press('Enter');
  const frame = page.locator('.proxy-frame');
  await expect(frame).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE\?start=90&/);
  await expect(page.getByRole('link', { name: 'Open in new tab', exact: true }))
    .toHaveAttribute('href', 'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=90s');
  await address.fill('javascript:alert(1)');
  await address.press('Enter');
  await share.click();
  const dialog = page.getByRole('dialog', { name: 'Share page' });
  const shareField = dialog.getByRole('textbox', { name: 'Viewer link' });
  await expect(shareField).toBeFocused();
  const sharedUrl = new URL(await shareField.inputValue());
  expect(sharedUrl.origin).toBe(new URL(page.url()).origin);
  expect(sharedUrl.search).toBe('');
  expect(sharedUrl.hash).toBe(`#browse?${new URLSearchParams({ address: shortLink })}`);
  const copy = dialog.getByRole('button', { name: 'Copy link' });
  await copy.click();
  await expect(dialog.getByRole('status')).toHaveText('Link copied.');
  expect(await page.evaluate(() => window.copiedViewerLink)).toBe(sharedUrl.href);
  await copy.click();
  await expect(dialog.getByRole('status')).toContainText('The link is selected');
  expect(await shareField.evaluate(input => input.selectionEnd - input.selectionStart)).toBe(sharedUrl.href.length);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(share).toBeFocused();
  await page.goto(sharedUrl.href);
  await expect(address).toHaveValue(shortLink);
  await expect(frame).toHaveAttribute('src', /start=90&/);
});

test('Proxy Gemini keeps address errors by tab and updates the recent pages on Home', async ({ page }) => {
  await page.goto('/#browse');
  const address = viewerAddress(page);
  await address.fill('learning games');
  await address.press('Enter');
  await expect(page.getByText('Connect a provider in Web Search to see live results here.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
  await address.fill('javascript:alert(1)');
  await address.press('Enter');
  await expect(address).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'New tab' }).click();
  await expect(address).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Recent pages' })).toBeVisible();
  await page.getByRole('tab', { name: 'learning games', exact: true }).click();
  await expect(address).toHaveValue('javascript:alert(1)');
  await expect(address).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Show browsing history' }).click();
  const history = page.getByRole('dialog', { name: 'Browsing history' });
  await history.getByRole('button', { name: 'Clear browsing history and closed tabs' }).click();
  await history.getByRole('button', { name: 'Close browsing history' }).click();
  await expect(page.getByRole('heading', { name: 'Recent pages' })).toHaveCount(0);
});

test('Proxy Gemini offers an in-page alternative without requesting the game portal', async ({ page }) => {
  const arcadeUrl = new URLSearchParams({ address: 'https://www.coolmathgames.com/0-eggy-car/?fixture=1' });
  const portalRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).hostname.endsWith('coolmathgames.com')) portalRequests.push(request.url());
  });
  await page.goto(`/#browse?${arcadeUrl}`);
  const viewer = page.locator('.proxy-viewer');
  await expect(viewer.getByRole('heading', { name: 'Eggy Car isn’t available in-page' })).toBeVisible();
  await expect(viewer.locator('iframe')).toHaveCount(0);
  await expect(viewer.getByRole('link')).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Play Pocket Circuit', exact: true }).click();
  await expect(viewerAddress(page)).toHaveValue('arcade:ffun-circuit-v1');
  await expect(viewer.locator('.local-game')).toBeVisible();
  await viewer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(viewer.getByRole('heading', { name: 'Eggy Car isn’t available in-page' })).toBeVisible();
  expect(portalRequests).toEqual([]);
  expect(page.context().pages()).toHaveLength(1);
});

test('Proxy Gemini recovers from a blocked preview and finds in-page games on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const original = 'https://example.com/publisher-blocked-game';
  let requests = 0;
  await page.route(original, route => {
    requests++;
    return route.fulfill({ contentType: 'text/html', headers: { 'content-security-policy': "frame-ancestors 'none'" },
      body: '<h1>Publisher blocked this game</h1>' });
  });
  await page.goto('/#browse');
  const filter = page.getByRole('searchbox', { name: 'Find an in-page game' });
  await expect(page.getByRole('button', { name: 'Play Snake' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await filter.fill('publisher blocked game');
  await expect(page.getByText('No in-page games match this search.')).toBeVisible();
  const address = viewerAddress(page);
  await address.fill(original);
  await address.press('Enter');
  const frame = page.locator('.proxy-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(frame).toHaveAttribute('src', original);
  const hide = page.getByRole('button', { name: 'Hide preview' });
  await hide.click();
  await expect(frame).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open in new tab', exact: true })).toHaveAttribute('href', original);
  await page.getByRole('button', { name: 'Retry preview' }).click();
  await hide.click();
  expect(requests).toBe(2);
  await page.getByRole('button', { name: 'Choose an in-page game' }).click();
  await expect(page.getByRole('heading', { name: 'Play inside the arcade' })).toBeFocused();
  await expect(filter).toHaveValue('');
  await filter.fill('2048');
  await expect(page.getByText('1 game found.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Snake' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Play 2048', exact: true }).click();
  await expect(page.getByRole('group', { name: '2048 controls' })).toBeVisible();
  await expect(address).toHaveValue('arcade:2048');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(filter).toHaveValue('2048');
  expect(requests).toBe(2);
});

test('Google search offers a direct destination and clears the current search', async ({ page }) => {
  await page.goto('/#web-search?mode=google');
  const query = page.getByRole('searchbox', { name: 'Google query' });
  await query.fill('arcade controller');
  const direct = page.getByRole('link', { name: 'Open Google in new tab' });
  await expect(direct).toHaveAttribute('href', 'https://www.google.com/search?q=arcade+controller');
  await expect(direct).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('button', { name: 'Use Google engine' }).click();
  await expect(page.getByText(/Enter a valid public Google Search Engine ID/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(query).toHaveValue('');
  await expect(query).toBeFocused();
  await expect(direct).toHaveCount(0);
  await expect(page.getByText(/Enter a valid public Google Search Engine ID/)).toHaveCount(0);
});
