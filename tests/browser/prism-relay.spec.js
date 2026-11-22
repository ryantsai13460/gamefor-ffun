import { expect, test } from '@playwright/test';

async function openPuzzle(page) {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#play/prism-relay?start=1');
  const game = page.getByRole('group', { name: 'Prism Relay controls' });
  await expect(game.getByLabel('Prism Relay game')).toBeVisible();
  return game;
}

test('Prism Relay completes all three local puzzles by keyboard and plays in fullscreen', async ({ page }) => {
  const game = await openPuzzle(page);
  const status = game.getByRole('status');
  const canvas = game.getByLabel('Prism Relay game');
  const start = game.getByRole('button', { name: 'Start', exact: true });
  const next = game.getByRole('button', { name: 'Next stage' });
  await start.click();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  await expect(canvas).toBeFocused();
  for (const key of ['Space', 'ArrowUp', 'ArrowUp', 'Space']) await canvas.press(key);
  await expect(status).toContainText('Receivers 1 of 1');
  await expect(status).toContainText('All receivers lit');
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toHaveCount(0);

  await next.click();
  await expect(status).toContainText('Relay Junction');
  await start.click();
  for (const key of ['Enter', 'ArrowUp', 'ArrowUp', 'Enter', 'ArrowLeft', 'ArrowLeft', 'Enter']) await canvas.press(key);
  await expect(status).toContainText('Receivers 2 of 2');

  await next.click();
  await expect(status).toContainText('Night Observatory');
  await start.click();
  for (const key of ['Space', 'ArrowUp', 'ArrowUp', 'Space', 'ArrowDown', 'ArrowDown',
    'ArrowRight', 'ArrowRight', 'Space', 'ArrowDown', 'Space']) await canvas.press(key);
  await expect(status).toContainText('Receivers 3 of 3');
  await expect(status).toContainText('Prism Relay complete');
  await expect(next).toBeHidden();
  await game.getByRole('button', { name: 'Restart stage' }).click();
  await expect(status).toContainText('Receivers 1 of 3');
});

test.describe('Prism Relay touchscreen play', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 740 } });

  test('tapping mirrors powers the first receiver without horizontal overflow', async ({ page }) => {
    const game = await openPuzzle(page);
    const canvas = game.getByLabel('Prism Relay game');
    await game.getByRole('button', { name: 'Start', exact: true }).tap();
    const bounds = await canvas.boundingBox();
    for (const y of [244, 116]) {
      await canvas.tap({ position: { x: 204 * bounds.width / 800, y: y * bounds.height / 450 } });
    }
    await expect(game.getByRole('status')).toContainText('Receivers 1 of 1');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBe(320);
  });
});
