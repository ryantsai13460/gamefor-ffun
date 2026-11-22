import { expect, test } from '@playwright/test';

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
