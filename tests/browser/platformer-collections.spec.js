import { expect, test } from '@playwright/test';

test('the mobile OvO collection keeps tag filters, offers a real random pick, and plays in one tab', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/#categories');
  await page.getByRole('link', { name: /^Games Like OvO \d+ games/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Games Like OvO' })).toBeVisible();
  const links = page.getByRole('navigation', { name: 'Platformer collections' });
  await expect(links.getByRole('link', { name: 'Games Like OvO', exact: true })).toHaveAttribute('aria-current', 'page');
  for (const name of ['Platformers', 'Speedrun Games', 'Parkour Games', 'Puzzle Platformers', 'Hard Platformers']) {
    await expect(links.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('combobox', { name: 'Play option' }).selectOption('in-page');
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('newest');
  const global = page.getByRole('searchbox', { name: 'Search the arcade' });
  await global.fill('speedrun beacon');
  await global.press('Enter');
  const beacon = page.getByRole('link', { name: 'Play Beacon Ascent', exact: true });
  await expect(beacon).toHaveAttribute('href', '#play/beacon-ascent?start=1');
  await expect(page.getByRole('combobox', { name: 'Play option' })).toHaveValue('in-page');
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('newest');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Random Platformer' }).click();
  await expect(page).toHaveURL(/#play\/beacon-ascent\?start=1$/);
  await expect(page.getByRole('group', { name: 'Beacon Ascent controls' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(page.context().pages()).toHaveLength(1);
  await page.getByRole('link', { name: 'Back to browsing', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search games' })).toHaveValue('speedrun beacon');
  await expect(beacon).toBeVisible();
});

test('an external platformer keeps its official link and does not acquire an in-page player', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#games?collection=like-ovo&option=external&q=celeste');
  await expect(page.getByRole('button', { name: 'Random Platformer' })).toBeDisabled();
  await page.locator('.card-link').filter({ hasText: 'CELESTE Classic' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'CELESTE Classic' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open game page', exact: true })).toHaveAttribute('href', 'https://maddymakesgamesinc.itch.io/celesteclassic');
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(1);
});
