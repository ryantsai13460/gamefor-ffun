import { expect, test } from '@playwright/test';

const modeButtons = page => page.getByRole('group', { name: 'Arcade modes' });
const schoolSearch = page => page.getByRole('searchbox', { name: 'Search a school topic' });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('School mode looks up a topic with local references and survives reload and Back', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#home');
  await modeButtons(page).getByRole('button', { name: 'School', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'School mode', exact: true })).toBeVisible();
  await expect(modeButtons(page).getByRole('button', { name: 'School', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Random Game', exact: true })).toBeHidden();
  await expect(page.getByRole('link', { name: /^Fraction Kitchen/ })).toHaveAttribute('href', '#play/fraction-kitchen');
  await expect(page.getByRole('link', { name: /^Clock Courier/ })).toHaveAttribute('href', '#play/clock-courier');
  await schoolSearch(page).fill('Why is the sky blue?');
  await schoolSearch(page).press('Enter');
  await expect(page.getByRole('heading', { name: 'Web Search', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Why Is the Sky Blue/ })).toBeVisible();
  await page.goBack();
  await expect(schoolSearch(page)).toBeVisible();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'school');
  await expect(modeButtons(page).getByRole('button', { name: 'School', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
    return document.documentElement.scrollWidth;
  })).toBe(320);
  await page.getByRole('link', { name: /^Learning videos/ }).click();
  await expect(page.getByRole('heading', { name: 'YouTube', level: 1 })).toBeVisible();
  expect(page.url()).toContain('topic=Education');
});

test('mode, site palette, and game background save independently', async ({ page }) => {
  await page.goto('/#settings?panel=appearance');
  const palettes = page.getByRole('group', { name: 'Color previews' });
  await expect(palettes.getByRole('button')).toHaveCount(10);
  const topOffsets = await palettes.getByRole('button').evaluateAll(buttons => buttons.slice(0, 2).map(button => button.offsetTop));
  expect(topOffsets[0]).toBe(topOffsets[1]);
  await palettes.getByRole('button', { name: 'Berry', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('berry');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'berry');
  await modeButtons(page).getByRole('button', { name: /^Gaming/ }).click();
  await page.getByRole('combobox', { name: 'Game background', exact: true }).selectOption('cobalt');
  await page.reload();
  await expect(palettes.getByRole('button', { name: 'Berry', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(modeButtons(page).getByRole('button', { name: /^Gaming/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Game background', exact: true })).toHaveValue('cobalt');
  await page.getByRole('link', { name: 'Go to Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gaming mode', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Random Game', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search the arcade', exact: true });
  await search.fill('Clock Courier');
  await search.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Play option' })).toHaveValue('in-page');
  await page.getByRole('link', { name: /^Clock Courier/ }).click();
  await expect(page.locator('.player-heading')).toHaveAttribute('data-game-background', 'cobalt');
});

test('Watching leads to the media shelves and Library keeps saved games visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#play/2048');
  await page.getByRole('button', { name: 'Add 2048 to favorites' }).click();
  await page.goto('/#home');
  await modeButtons(page).getByRole('button', { name: 'Watching', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Watching mode', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Watch and listen', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New to the library', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New videos', exact: true })).toHaveAttribute('href', '#youtube?format=new');
  await expect(page.getByRole('link', { name: 'Recently added films', exact: true })).toHaveAttribute('href', '#movies?collection=additions');
  await expect(page.getByRole('link', { name: /^Family films/ }).first()).toHaveAttribute('href', '#movies?collection=family');
  await modeButtons(page).getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Library mode', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /^2048/ })).toHaveAttribute('href', '#play/2048');
  await modeButtons(page).getByRole('button', { name: 'Arcade', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pocket Circuit', level: 1 })).toBeVisible();
});
