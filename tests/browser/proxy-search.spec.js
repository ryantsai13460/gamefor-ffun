import { expect, test } from '@playwright/test';

const viewerAddress = page => page.getByRole('textbox', { name: 'Address or search query' });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('the start page launches websites with inline validation and keeps the viewer tab', async ({ page }) => {
  await page.route('https://example.com/', route => route.fulfill({ contentType: 'text/html', body: '<h1>Example website</h1>' }));
  await page.goto('/#browse');

  const launcher = page.getByRole('region', { name: 'Start browsing' });
  const website = launcher.getByRole('textbox', { name: 'Website or search' });
  await expect(launcher.getByRole('radio', { name: 'Web' })).toBeChecked();
  await website.fill('http://example.com');
  await website.press('Enter');
  await expect(launcher.getByRole('alert')).toHaveText('Enter a public HTTPS address or a search term.');
  await expect(website).toBeFocused();
  await expect(viewerAddress(page)).toHaveValue('');

  await website.fill('example.com');
  await expect(launcher.getByRole('alert')).toHaveCount(0);
  await launcher.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('tab', { name: 'example.com' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.proxy-frame')).toHaveAttribute('src', 'https://example.com/');
  await expect(page.locator('.proxy-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  expect(page.context().pages()).toHaveLength(1);
});

test('the start page accepts YouTube links and filters in-page games on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route('https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?*', route => route.fulfill({
    contentType: 'text/html', body: '<h1>Example player</h1>'
  }));
  await page.goto('/#browse');

  const launcher = page.getByRole('region', { name: 'Start browsing' });
  await launcher.getByRole('radio', { name: 'Web' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(launcher.getByRole('radio', { name: 'YouTube' })).toBeChecked();
  const video = launcher.getByRole('textbox', { name: 'YouTube video link' });
  await video.fill('example.com');
  await video.press('Enter');
  await expect(launcher.getByRole('alert')).toContainText('Enter a link to a YouTube video');
  await video.fill('https://youtu.be/M7lc1UVf-VE?t=90');
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await expect(launcher.getByRole('radio', { name: 'Web' })).toBeChecked();
  const tabs = page.getByRole('tablist', { name: 'Browser tabs' });
  await tabs.getByRole('tab').first().click();
  await expect(launcher.getByRole('radio', { name: 'YouTube' })).toBeChecked();
  await expect(video).toHaveValue('https://youtu.be/M7lc1UVf-VE?t=90');
  await launcher.getByRole('button', { name: 'Watch' }).click();
  await expect(page.locator('.proxy-frame')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/M7lc1UVf-VE\?start=90&/);

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Play inside the arcade' });
  const category = picker.getByRole('combobox', { name: 'Category' });
  await category.selectOption('Puzzle');
  await launcher.getByRole('radio', { name: 'Games' }).check();
  await launcher.getByRole('textbox', { name: 'Game title (optional)' }).fill('Pocket Circuit');
  await launcher.getByRole('button', { name: 'Find games' }).click();
  const filter = picker.getByRole('searchbox', { name: 'Find an in-page game' });
  await expect(filter).toBeFocused();
  await expect(filter).toHaveValue('Pocket Circuit');
  await expect(category).toHaveValue('');
  await expect(picker.getByRole('button', { name: 'Play Pocket Circuit', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(page.context().pages()).toHaveLength(1);
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
      { title: requests === 3 ? 'Updated HTML reference' : 'HTML reference', url: 'https://example.com/reference', description: 'Publisher documentation.' },
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
  await expect(results.getByText(/Showing results from the last successful search/)).toBeVisible();
  await expect(results.getByRole('heading', { name: 'HTML reference', exact: true })).toBeVisible();
  expect(requests).toBe(2);
  await expect(page.getByRole('link', { name: 'Search web and YouTube' })).toHaveAttribute('href', '#web-search?q=learn+about+html');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await results.getByRole('button', { name: 'Retry web search' }).click();
  await expect(results.getByRole('heading', { name: 'Updated HTML reference', exact: true })).toBeVisible();
  await expect(results.getByRole('heading', { name: 'HTML reference', exact: true })).toHaveCount(0);
  await expect(results.getByRole('listitem')).toHaveCount(2);
  expect(requests).toBe(3);

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
  expect(requests).toBe(3);
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
  const historyFilter = history.getByRole('searchbox', { name: 'Search history' });
  await historyFilter.fill('missing');
  await expect(history.getByText('No pages match your search.')).toBeVisible();
  await historyFilter.fill('LEARNING');
  await expect(history.getByRole('button', { name: 'Open learning games' })).toBeVisible();
  await history.getByRole('button', { name: 'Clear browsing history and closed tabs' }).click();
  await history.getByRole('button', { name: 'Close browsing history' }).click();
  await expect(page.getByRole('heading', { name: 'Recent pages' })).toHaveCount(0);
});

test('Proxy Gemini opens a catalog source only when the visitor follows its link', async ({ page }) => {
  const source = 'https://eggycarofficial.com/';
  const arcadeUrl = new URLSearchParams({ address: 'https://www.coolmathgames.com/0-eggy-car/?redirect=https://example.com/unrelated' });
  const portalRequests = [];
  page.context().on('request', request => {
    if (['eggycarofficial.com', 'www.coolmathgames.com'].includes(new URL(request.url()).hostname)) portalRequests.push(request.url());
  });
  await page.context().route(source, route => route.fulfill({ contentType: 'text/html', body: '<h1>Publisher page</h1>' }));
  await page.goto(`/#browse?${arcadeUrl}`);
  const viewer = page.locator('.proxy-viewer');
  await expect(viewer.getByRole('heading', { name: 'Eggy Car isn’t available in-page' })).toBeVisible();
  await expect(viewer.locator('iframe')).toHaveCount(0);
  const official = viewer.getByRole('link', { name: 'Open game page', exact: true });
  await expect(official).toHaveAttribute('href', source);
  await expect(official).toHaveAttribute('target', '_blank');
  await expect(official).toHaveAttribute('rel', 'noopener noreferrer');
  await viewer.getByRole('button', { name: 'Play Pocket Circuit', exact: true }).click();
  await expect(viewerAddress(page)).toHaveValue('arcade:ffun-circuit-v1');
  await expect(viewer.locator('.local-game')).toBeVisible();
  await viewer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(viewer.getByRole('heading', { name: 'Eggy Car isn’t available in-page' })).toBeVisible();
  expect(portalRequests).toEqual([]);
  expect(page.context().pages()).toHaveLength(1);
  const opened = page.waitForEvent('popup');
  await official.click();
  const publisher = await opened;
  await expect(publisher.getByRole('heading', { name: 'Publisher page' })).toBeVisible();
  expect(portalRequests).toEqual([source]);
  await publisher.close();

  const address = viewerAddress(page);
  await address.fill('https://www.coolmathgames.com/unknown-unverified-game');
  await address.press('Enter');
  await expect(official).toHaveCount(0);
  await expect(viewer.locator('iframe')).toHaveCount(0);

  await address.fill('https://poki.com/en/g/monkey-mart?ref=bookmark');
  await address.press('Enter');
  await expect(viewer.getByRole('heading', { name: 'Monkey Mart isn’t available in-page' })).toBeVisible();
  await expect(official).toHaveAttribute('href', 'https://poki.com/en/g/monkey-mart');
  await expect(viewer.locator('iframe')).toHaveCount(0);

  await address.fill('https://spinz.io/?ref=bookmark');
  await address.press('Enter');
  await expect(viewer.getByRole('heading', { name: 'Spinz.io isn’t available in-page' })).toBeVisible();
  await expect(viewer.getByRole('link', { name: "Read the publisher's closure notice" })).toHaveAttribute('href', 'https://spinz.io/');
  await expect(official).toHaveCount(0);
  await expect(viewer.locator('iframe')).toHaveCount(0);
});

test('Proxy Gemini offers a publisher link when an approved game preview is hidden', async ({ page }) => {
  const original = 'https://play.fancade.com/5BEC8352E4E078B1';
  await page.route(original, route => route.fulfill({ contentType: 'text/html', body: '<h1>Publisher player</h1>' }));
  await page.goto(`/#browse?${new URLSearchParams({ address: original })}`);
  const frame = page.locator('.proxy-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-presentation');
  await expect(page.frameLocator('.proxy-frame').getByRole('heading', { name: 'Publisher player' })).toBeVisible();
  const official = page.getByRole('link', { name: 'Open game page', exact: true });
  await expect(official).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide preview' }).click();
  await expect(frame).toHaveCount(0);
  await expect(official).toHaveAttribute('href', original);
  await expect(official).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: 'Retry preview' }).click();
  await expect(frame).toHaveAttribute('src', original);
  await expect(official).toHaveCount(0);
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
  await expect(page.getByText('No in-page games match these filters.')).toBeVisible();
  const address = viewerAddress(page);
  await address.fill(original);
  await address.press('Enter');
  const frame = page.locator('.proxy-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(frame).toHaveAttribute('src', original);
  const hide = page.getByRole('button', { name: 'Hide preview' });
  await expect.poll(() => requests).toBe(1);
  await hide.click();
  await expect(frame).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open in new tab', exact: true })).toHaveAttribute('href', original);
  await page.getByRole('button', { name: 'Retry preview' }).click();
  await expect.poll(() => requests).toBe(2);
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

test('Proxy Gemini leaves a slow official game running while its resources finish loading', async ({ page }) => {
  const game = 'https://www.crazygames.com/embed/ovo';
  const resource = 'https://www.crazygames.com/slow-game-image.png';
  let release;
  const imageReady = new Promise(resolve => { release = resolve; });
  await page.clock.install();
  await page.route(resource, async route => {
    await imageReady;
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route(game, route => route.fulfill({
    contentType: 'text/html', body: `<button>Publisher start control</button><img src="${resource}" alt="">`
  }));

  try {
    await page.goto(`/#browse?${new URLSearchParams({ address: game })}`, { waitUntil: 'domcontentloaded' });
    const gameControl = page.frameLocator('.proxy-frame').getByRole('button', { name: 'Publisher start control' });
    await expect(gameControl).toBeVisible();
    await page.clock.fastForward(11_000);
    await expect(page.getByText('The official player is still loading. Use its controls as soon as they appear.', { exact: true })).toBeVisible();
    await expect(gameControl).toBeVisible();
    release();
    await expect(page.getByText('Official game player preview. Playback depends on the publisher and your connection.', { exact: true })).toBeVisible();
  } finally {
    release();
  }
});

test('Proxy Gemini cancels a loading preview and restores the hidden state through navigation', async ({ page }) => {
  const original = 'https://example.com/slow-reference';
  let release;
  const firstResponse = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route(original, async route => {
    if (++requests === 1) await firstResponse;
    await route.fulfill({ contentType: 'text/html', body: '<h1>Allowed publisher preview</h1>' }).catch(() => {});
  });
  await page.goto('/#browse');
  const address = viewerAddress(page);
  await address.fill(original);
  await address.press('Enter');
  const progress = page.getByRole('progressbar', { name: 'Loading preview' });
  const panel = page.getByRole('tabpanel');
  const hidden = panel.getByRole('heading', { name: 'Preview hidden', exact: true });
  try {
    await expect.poll(() => requests).toBe(1);
    await expect(progress).toBeVisible();
    await page.getByRole('button', { name: 'Hide preview', exact: true }).click();
    await expect(progress).toHaveCount(0);
    await expect(panel.locator('iframe')).toHaveCount(0);
    const originalLink = panel.getByRole('link', { name: 'Open original site', exact: true });
    await expect(originalLink).toHaveAttribute('href', original);
    await expect(originalLink).toHaveAttribute('target', '_blank');
    await expect(originalLink).toBeFocused();
  } finally {
    release();
  }

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Start browsing' })).toBeVisible();
  await page.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(hidden).toBeVisible();
  await page.goto('/#home');
  await expect(page.locator('.proxy-viewer')).toHaveCount(0);
  await page.goto('/#browse');
  await expect(hidden).toBeVisible();
  await page.getByRole('button', { name: 'Close example.com tab', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Reopen closed tab', exact: true }).click();
  await expect(hidden).toBeVisible();
  await expect(panel.locator('iframe')).toHaveCount(0);
  expect(requests).toBe(1);

  await panel.getByRole('button', { name: 'Retry preview', exact: true }).click();
  const frame = page.locator('.proxy-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.frameLocator('.proxy-frame').getByRole('heading', { name: 'Allowed publisher preview' })).toBeVisible();
  expect(requests).toBe(2);
});

test('Proxy Gemini names older saved pages and exposes their titles to the shared bookmark library', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const original = 'https://example.com/library/reference';
  await page.addInitScript(({ original }) => {
    const key = 'gamefor-ffun-proxy-v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ favorites: [original], history: [original] }));
  }, { original });
  await page.goto('/#browse?panel=favorites');
  const dialog = page.getByRole('dialog', { name: 'Favorite pages' });
  await dialog.getByRole('button', { name: 'Rename example.com', exact: true }).click();
  const name = dialog.getByRole('textbox', { name: 'Bookmark name', exact: true });
  await expect(name).toBeFocused();
  await name.fill('  Astronomy   reference  ');
  await name.press('Enter');
  await expect(dialog.getByRole('button', { name: 'Rename Astronomy reference', exact: true })).toBeFocused();
  await dialog.getByRole('searchbox', { name: 'Search saved pages' }).fill('ASTRONOMY');
  await expect(dialog.getByRole('button', { name: /^Open Astronomy reference/ })).toBeVisible();
  await page.reload();
  await expect(dialog.getByRole('button', { name: /^Open Astronomy reference/ })).toBeVisible();
  const library = await page.evaluate(async () => (await import('./assets/browser.js')).getBrowserLibraryState());
  expect(library).toEqual({ favorites: [{ address: original, title: 'Astronomy reference' }], history: [{ address: original, title: 'example.com' }] });
  await dialog.getByRole('button', { name: 'Close favorite pages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open saved page Astronomy reference', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('Proxy Gemini keeps game filters and expanded results with their viewer tab', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#browse');
  const picker = page.getByRole('region', { name: 'Play inside the arcade' });
  const filter = picker.getByRole('searchbox', { name: 'Find an in-page game' });
  const category = picker.getByRole('combobox', { name: 'Category' });
  const player = picker.getByRole('combobox', { name: 'Play option' });
  const tabs = page.getByRole('tablist', { name: 'Browser tabs' });

  await category.selectOption('Puzzle');
  await player.selectOption('local');
  await expect(picker.getByRole('button', { name: 'Play 2048', exact: true })).toBeVisible();
  await expect(picker.getByRole('button', { name: 'Play Snake', exact: true })).toHaveCount(0);
  await expect(picker.getByRole('heading', { name: 'Official in-page players' })).toHaveCount(0);
  await filter.fill('2048');
  await filter.press('Enter');
  await expect(viewerAddress(page)).toHaveValue('arcade:2048');
  await expect(page.getByRole('group', { name: '2048 controls' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(filter).toHaveValue('2048');
  await expect(category).toHaveValue('Puzzle');
  await expect(player).toHaveValue('local');

  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await expect(filter).toHaveValue('');
  await expect(category).toHaveValue('');
  await expect(player).toHaveValue('');
  await tabs.getByRole('tab').first().click();
  await expect(filter).toHaveValue('2048');
  await picker.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(filter).toBeFocused();
  await expect(category).toHaveValue('');
  await expect(player).toHaveValue('');

  await player.selectOption('embed');
  const hosted = picker.locator('.proxy-playable-group:visible li');
  await expect(hosted).toHaveCount(24);
  await picker.getByRole('button', { name: 'Show more in-page games' }).click();
  await expect(hosted).toHaveCount(48);
  await expect(hosted.nth(24).getByRole('button')).toBeFocused();
  await tabs.getByRole('tab').last().click();
  await expect(player).toHaveValue('');
  await tabs.getByRole('tab').first().click();
  await expect(player).toHaveValue('embed');
  await expect(hosted).toHaveCount(48);
  await page.getByRole('button', { name: 'Duplicate current tab', exact: true }).click();
  await expect(player).toHaveValue('embed');
  await expect(hosted).toHaveCount(48);
  await picker.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await tabs.getByRole('tab').first().click();
  await expect(player).toHaveValue('embed');
  await expect(hosted).toHaveCount(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
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
