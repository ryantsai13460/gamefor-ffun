import { expect, test } from '@playwright/test';

async function startGame(page, id, name, touch = false) {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#play/' + id);
  const launch = page.getByRole('button', { name: 'Play game', exact: true });
  await (touch ? launch.tap() : launch.click());
  const game = page.getByRole('group', { name: name + ' controls' });
  const start = game.getByRole('button', { name: 'Start', exact: true });
  await (touch ? start.tap() : start.click());
  return game;
}

test('Picnic Pack plays and progresses with keyboard controls', async ({ page }) => {
  const game = await startGame(page, 'picnic-pack', 'Picnic Pack');
  const canvas = game.getByLabel('Picnic Pack game');
  const status = game.getByRole('status');
  await expect(canvas).toBeFocused();
  await canvas.press('n');
  await expect(status).toContainText('Sandwiches');
  for (let turn = 0; turn < 3; turn++) await canvas.press('n');
  await canvas.press('Space');
  await expect(status).toContainText('Apples rotated.');
  for (let turn = 0; turn < 3; turn++) await canvas.press('Space');
  await canvas.press('Enter');
  await expect(status).toContainText('1/4 packed');
  await canvas.press('ArrowRight');
  await canvas.press('ArrowRight');
  await canvas.press('Enter');
  await canvas.press('ArrowDown');
  await canvas.press('Enter');
  await canvas.press('ArrowLeft');
  await canvas.press('ArrowLeft');
  await canvas.press('ArrowDown');
  await canvas.press('Enter');
  await expect(status).toContainText('Basket packed!');
  await game.getByRole('button', { name: 'Next basket' }).click();
  await expect(status).toContainText('Lunch for Friends · 0/5 packed');
});

test('Clover Roll supports keyboard tilts, garden descriptions, undo and progression', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const game = await startGame(page, 'clover-roll', 'Clover Roll');
  const canvas = game.getByLabel('Clover Roll game');
  const status = game.getByRole('status');
  await expect(canvas).toBeFocused();
  await canvas.press('h');
  await expect(status).toContainText('Bowl at row 1, column 5');
  await canvas.press('ArrowDown');
  await expect(status).toContainText('1/1 clovers · 1 roll');
  await canvas.press('u');
  await expect(status).toContainText('0/1 clovers · 0 rolls');
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowRight']) await canvas.press(key);
  await expect(status).toContainText('Garden cleared!');
  await game.getByRole('button', { name: 'Next garden' }).click();
  await expect(status).toContainText('Hedge Corner · 0/2 clovers · 0 rolls');
});

test.describe('family games on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('Picnic Pack accepts basket taps and resets', async ({ page }) => {
    const game = await startGame(page, 'picnic-pack', 'Picnic Pack', true);
    const canvas = game.getByLabel('Picnic Pack game');
    const bounds = await canvas.boundingBox();
    await canvas.tap({ position: { x: bounds.width * 137 / 800, y: bounds.height * 119 / 450 } });
    await expect(game.getByRole('status')).toContainText('1/4 packed');
    await game.getByRole('button', { name: 'Empty basket' }).tap();
    await expect(game.getByRole('status')).toContainText('0/4 packed');
    await expect(game.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  });

  test('Kite Breeze responds to a climb tap and can pause or restart', async ({ page }) => {
    const game = await startGame(page, 'kite-breeze', 'Kite Breeze', true);
    const canvas = game.getByLabel('Kite Breeze game');
    const height = () => canvas.evaluate(surface => {
      const pixels = surface.getContext('2d').getImageData(166, 80, 1, 280).data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] === 244 && pixels[index + 1] === 170 && pixels[index + 2] === 149) return 80 + index / 4;
      }
      return 360;
    });
    const originalHeight = await height();
    await game.getByRole('button', { name: 'Climb', exact: true }).tap();
    await expect.poll(height).toBeLessThan(originalHeight - 6);
    await game.getByRole('button', { name: 'Pause', exact: true }).tap();
    await expect(game.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
    await game.getByRole('button', { name: 'Restart breeze' }).tap();
    await expect(game.getByRole('status')).toContainText('Dandelion Field · Ribbons 0/8');
  });

  test('Clover Roll animates a garden tap and runs through touch controls', async ({ page }) => {
    const game = await startGame(page, 'clover-roll', 'Clover Roll', true);
    const canvas = game.getByLabel('Clover Roll game');
    const bounds = await canvas.boundingBox();
    await canvas.tap({ position: { x: bounds.width * 274 / 800, y: bounds.height * 347 / 450 } });
    const status = game.getByRole('status');
    await expect(status).toContainText('1/1 clovers · 1 roll');
    await game.getByRole('button', { name: 'Up', exact: true }).tap();
    await expect(status).toContainText('Marble at row 1, column 3');
    await game.getByRole('button', { name: 'Right', exact: true }).tap();
    await expect(status).toContainText('Garden cleared!');
    await game.getByRole('button', { name: 'Reset garden' }).tap();
    await expect(status).toContainText('Dewdrop Walk · 0/1 clovers · 0 rolls');
  });
});
