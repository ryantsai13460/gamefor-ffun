import { expect, test } from '@playwright/test';

test('game pages open background settings and remember a real gameplay backdrop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto('/#play/2048');
  const header = page.locator('.player-heading');
  await expect(header).toHaveAttribute('data-game-background', 'clean');
  await page.getByRole('link', { name: 'Customize background' }).click();
  await expect(page.getByRole('region', { name: 'Game backgrounds' })).toBeFocused();
  await page.getByRole('combobox', { name: 'Game background' }).selectOption('race');
  await expect(page.locator('.game-background-preview')).toHaveAttribute('data-game-background', 'race');
  await expect(page.locator('.game-background-preview')).toHaveCSS('background-image', /ffun-circuit-v1\.webp/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.goto('/#play/2048');
  await page.reload();
  await expect(header).toHaveAttribute('data-game-background', 'race');
  await expect(page.locator('.player-stage .game-backdrop')).toHaveAttribute('data-game-background', 'race');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  await expect(page.getByRole('group', { name: '2048 controls' })).toBeVisible();
});

test('a custom image stays local, persists and can be removed', async ({ page }) => {
  await page.goto('/#settings?panel=background');
  const upload = page.getByLabel('Choose a background image');
  const status = page.getByRole('region', { name: 'Game backgrounds' }).getByRole('status');
  await upload.setInputFiles({ name: 'wrong.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(status).toHaveText('Choose a JPEG, PNG, or WebP image.');
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const brush = canvas.getContext('2d');
    brush.fillStyle = '#496d99';
    brush.fillRect(0, 0, 32, 32);
    return canvas.toDataURL().split(',')[1];
  });
  await upload.setInputFiles({ name: 'my-image.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await expect(status).toHaveText('Your background image was saved in this browser.');
  await page.goto('/#play/2048');
  await page.reload();
  const header = page.locator('.player-heading');
  await expect(header).toHaveAttribute('data-game-background', 'custom');
  await expect(header).toHaveCSS('background-image', /data:image\/jpeg;base64,/);
  await page.getByRole('link', { name: 'Customize background' }).click();
  await page.getByRole('button', { name: 'Remove saved image' }).click();
  await expect(status).toHaveText('Saved image removed.');
  await expect(page.getByRole('combobox', { name: 'Game background' })).toHaveValue('clean');
  await page.goto('/#play/2048');
  await expect(header).toHaveAttribute('data-game-background', 'clean');
});

test('the site theme and custom game color persist independently', async ({ page }) => {
  await page.goto('/#settings?panel=background');
  const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
  const gameBackground = page.getByRole('combobox', { name: 'Game background' });
  await expect(theme.getByRole('option')).toHaveCount(6);
  await theme.selectOption('pine');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'pine');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101d19');

  for (const preset of ['ocean', 'pine', 'orchid', 'amber']) {
    await gameBackground.selectOption(preset);
    await expect(page.locator('.game-background-preview')).toHaveAttribute('data-game-background', preset);
  }
  await gameBackground.selectOption('color');
  const color = page.getByLabel('Custom background color', { exact: true });
  await color.fill('#d08330');
  await expect(page.getByText('Game color saved.', { exact: true })).toBeVisible();
  await page.goto('/#play/2048');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'pine');
  const background = page.locator('.player-heading');
  await expect(background).toHaveAttribute('data-game-background', 'color');
  expect(await background.evaluate(node => node.style.getPropertyValue('--game-backdrop-color'))).toBe('#d08330');
});
