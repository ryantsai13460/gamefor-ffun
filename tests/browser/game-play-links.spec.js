import { expect, test } from '@playwright/test';

test('Play Here keeps searches playable and opens OvO in the arcade and Proxy Gemini', async ({ page }) => {
  const embed = 'https://www.crazygames.com/embed/ovo';
  await page.route('https://**/*', route => route.abort());
  await page.route(embed, route => route.fulfill({ contentType: 'text/html', body: '<button>Publisher start control</button>' }));

  await page.goto('/#home');
  const navigation = page.getByRole('navigation', { name: 'Arcade navigation' });
  const playHere = navigation.getByRole('link', { name: 'Play Here', exact: true });
  await playHere.click();
  const option = page.getByRole('combobox', { name: 'Play option' });
  await expect(playHere).toHaveAttribute('aria-current', 'page');
  await expect(option).toHaveValue('in-page');

  const search = page.getByRole('searchbox', { name: 'Search the arcade' });
  await search.fill('OvO');
  await search.press('Enter');
  await expect(option).toHaveValue('in-page');
  const card = page.locator('.game-card').filter({ has: page.getByRole('heading', { name: 'OvO', exact: true }) });
  await card.getByRole('link').click();
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  const stage = page.getByRole('region', { name: 'OvO player' });
  const frame = stage.locator('iframe');
  await expect(frame).toHaveAttribute('src', embed);
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-presentation');
  await expect(frame).toHaveAttribute('allow', /gamepad https:\/\/games\.crazygames\.com https:\/\/ovo\.game-files\.crazygames\.com$/);
  await expect(stage.frameLocator('iframe').getByRole('button', { name: 'Publisher start control' })).toBeVisible();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.locator('.player-stage:fullscreen')).toBeVisible();
  await expect.poll(() => frame.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.left >= 0 && bounds.right <= innerWidth;
  })).toBe(true);
  await stage.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect(page.locator('.player-stage:fullscreen')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to browsing', exact: true }).click();
  await expect(option).toHaveValue('in-page');
  await option.selectOption('');
  await expect(navigation.getByRole('link', { name: 'All Games', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.goto(`/#browse?${new URLSearchParams({ address: 'https://www.coolmathgames.com/0-ovo?ref=bookmark' })}`);
  await expect(page.locator('.proxy-frame')).toHaveAttribute('src', embed);
  await expect(page.locator('.proxy-frame')).toHaveAttribute('allow', /gamepad https:\/\/games\.crazygames\.com https:\/\/ovo\.game-files\.crazygames\.com$/);
  await expect(page.frameLocator('.proxy-frame').getByRole('button', { name: 'Publisher start control' })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

test('blocked catalog titles lead to related in-page games and the official Geometry Dash demo', async ({ page }) => {
  const demo = 'https://www.geometrydash.com/game/';
  const frames = [];
  await page.route('https://**/*', route => {
    if (route.request().isNavigationRequest()) frames.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<p>Publisher player fixture</p>' });
  });

  await page.goto('/#browse?address=' + encodeURIComponent('https://bloxd.io/'));
  await expect(page.getByRole('heading', { name: 'Bloxd.io isn’t available in-page' })).toBeVisible();
  await page.getByRole('button', { name: 'Play Terrace Workshop', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Terrace Workshop controls' })).toBeVisible();
  expect(frames).toEqual([]);

  await page.goto('/#browse?address=' + encodeURIComponent(demo));
  await expect(page.getByRole('heading', { name: 'Geometry Dash isn’t available in-page' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play Dash (Tapamine)', exact: true })).toBeVisible();

  await page.goto('/#play/geometry-dash');
  await expect(page.getByRole('link', { name: 'Official web demo', exact: true })).toHaveAttribute('href', demo);
  await expect(page.getByRole('link', { name: 'Official web demo', exact: true })).toHaveAttribute('target', '_blank');
  await page.getByRole('link', { name: /^Dash \(Tapamine\)/ }).click();
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  await expect(page.getByTitle('Dash (Tapamine)', { exact: true }))
    .toHaveAttribute('src', 'https://tapamine.com/embed/dash/');
  await expect(page).toHaveURL(/#play\/tapamine-dash$/);
  expect(frames).not.toContain(demo);
  expect(page.context().pages()).toHaveLength(1);
});

test('an external game listing is available explicitly without navigating on Play', async ({ page }) => {
  const visits = [];
  await page.route('https://**/*', route => {
    if (route.request().isNavigationRequest()) visits.push(route.request().url());
    return route.abort();
  });
  await page.goto('/#play/bloxd-io?start=1');
  const stage = page.getByRole('region', { name: 'Bloxd.io player' });
  await expect(stage.getByRole('heading', { name: 'In-page play unavailable' })).toBeVisible();
  const source = stage.getByRole('link', { name: 'Open game page', exact: true });
  await expect(source).toHaveAttribute('href', 'https://bloxd.io/');
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  await page.goto('/#play/spinz-io?start=1');
  await expect(page.getByText('The publisher closed the browser game.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: "Read the publisher's closure notice" })).toHaveAttribute('href', 'https://spinz.io/');
  await expect(page.getByRole('link', { name: 'Open game page', exact: true })).toHaveCount(0);
  expect(visits).toEqual([]);
  expect(page.context().pages()).toHaveLength(1);
});

test('Territorial.io shares a direct game link, keeps the player in-page, and offers recovery', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async () => { throw new Error('Clipboard unavailable'); }
  } }));
  await page.route('https://**/*', route => route.abort());
  let loads = 0;
  await page.route('https://territorial.io/', route => {
    loads++;
    return route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/?release=previous#play/territorial');
  await expect(page.getByRole('heading', { name: 'Territorial.io', level: 1 })).toBeVisible();
  await expect(page.locator('main iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Copy play link' }).click();
  const copy = page.getByRole('textbox', { name: 'Shareable play link' });
  await expect(copy).toBeFocused();
  const address = new URL(await copy.inputValue());
  expect(address.search).toBe('');
  expect(address.hash).toBe('#play/territorial?start=1');
  await page.goto(address.href);
  await expect(page.getByTitle('Territorial.io', { exact: true })).toHaveAttribute('src', 'https://territorial.io/');
  await expect(page.getByRole('region', { name: 'Territorial.io player' })).toBeFocused();
  await expect(page.locator('.player-status')).toHaveText('If the official player appears, use its controls to start.');
  await expect(page.getByRole('link', { name: 'Browse in-page games' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect.poll(() => loads).toBe(2);
  expect(page.context().pages()).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('a play link auto-opens a built-in game and never launches a catalog-only game', async ({ page }) => {
  const portalRequests = [];
  await page.route('https://**/*', route => {
    if (route.request().isNavigationRequest()) portalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/#play/2048?start=1');
  await expect(page.getByRole('group', { name: '2048 controls' })).toBeVisible();
  await page.goto('/#play/retrobowl?start=1');
  await expect(page.getByRole('heading', { name: 'In-page play unavailable' })).toBeVisible();
  await expect(page.locator('main iframe')).toHaveCount(0);
  expect(portalRequests).toEqual([]);
});

test('the platformer player shows actual controls and links back to playable games', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/#play/ffun-skyline-v1');
  const stage = page.getByRole('region', { name: 'Skyline Sprint player' });
  await expect(page.getByRole('heading', { name: 'Controls', exact: true })).toBeVisible();
  await expect(stage).toHaveAccessibleDescription(/jump/i);
  await expect(page.getByRole('link', { name: 'More games like OvO' }))
    .toHaveAttribute('href', '#games?collection=like-ovo');
  await stage.getByRole('button', { name: 'Play game', exact: true }).click();
  await expect(stage.getByRole('group', { name: 'Skyline Sprint controls' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('link', { name: 'Back to Games', exact: true }).click();
  await expect(page).toHaveURL(/#games\?option=in-page$/);
});

test('a missing built-in game file focuses a working retry button', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.route('**/catch-the-star.html', route => route.fulfill({ contentType: 'text/html',
    status: 404, body: '<title>File not found</title>' }), { times: 1 });
  await page.goto('/#play/catch-the-star');
  const stage = page.getByRole('region', { name: 'Catch the Star player' });
  await stage.getByRole('button', { name: 'Play game', exact: true }).click();
  await expect(stage.getByRole('heading', { name: 'Game could not load' })).toBeVisible();
  const retry = stage.getByRole('button', { name: 'Retry game', exact: true });
  await expect(retry).toBeFocused();
  await retry.press('Enter');
  await expect(page.locator('.player-status')).toHaveText('Built-in game ready.');
  await expect(stage.frameLocator('iframe').locator('#star')).toBeVisible();
});

test('a slow publisher resource does not interrupt the in-page player', async ({ page }) => {
  const player = 'https://s7gs.com/Play/bat-hunt.html';
  const slowImage = 'https://s7gs.com/test-delayed-player-image.png';
  let finishImage;
  const imageReady = new Promise(resolve => { finishImage = resolve; });
  await page.clock.install();
  await page.route('https://**/*', route => route.abort());
  await page.route(player, route => route.fulfill({
    contentType: 'text/html',
    body: `<button>Publisher start control</button><img src="${slowImage}" alt="">`
  }));
  await page.route(slowImage, async route => {
    await imageReady;
    await route.fulfill({ status: 204, body: '' });
  });

  try {
    await page.goto('/#play/s7gs-bat-hunt');
    const pending = page.waitForRequest(slowImage);
    await page.getByRole('button', { name: 'Play game', exact: true }).click();
    await pending;
    const frame = page.frameLocator('iframe[title="Bat Hunt"]');
    await expect(frame.getByRole('button', { name: 'Publisher start control' })).toBeVisible();
    const status = page.locator('.player-status');
    await expect(status).toHaveText('Opening game…');
    expect(await status.evaluate(node => getComputedStyle(node, '::before').content)).toBe('""');
    await page.clock.fastForward(11_000);

    await expect(status).toHaveText('The official player is still loading. Use its controls as soon as they appear.');
    await expect(frame.getByRole('button', { name: 'Publisher start control' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Open game page', exact: true })).toHaveAttribute('href', 'https://s7gs.com/Arcade/bat-hunt.html');
    await expect(page).toHaveURL(/#play\/s7gs-bat-hunt$/);
    finishImage();
    await expect(page.locator('.player-status')).toHaveText('If the official player appears, use its controls to start.');
  } finally {
    finishImage();
  }
});
