import { expect, test } from '@playwright/test';

async function startLanternShift(page, touch = false) {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#play/lantern-shift');
  const play = page.getByRole('button', { name: 'Play game', exact: true });
  await (touch ? play.tap() : play.click());
  const game = page.getByRole('group', { name: 'Lantern Shift controls' });
  const start = game.getByRole('button', { name: 'Start', exact: true });
  await (touch ? start.tap() : start.click());
  return game;
}

test('Lantern Shift plays offline with keyboard lane commands, live scoring and pause', async ({ page }) => {
  const game = await startLanternShift(page);
  const canvas = game.getByLabel('Lantern Shift game');
  const status = game.getByRole('status');
  await expect(canvas).toBeFocused();
  await canvas.press('Space');
  await expect(status).toContainText('Lane outer');
  await canvas.press('ArrowLeft');
  await expect(status).toContainText('Lane inner');
  await expect(status).toContainText('Lanterns 1/8 · Goal 6 · Lane inner · Next lantern 2 in outer lane');
  await canvas.press('p');
  await expect(game.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
});

test.describe('Lantern Shift on a narrow phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 740 } });

  test('direct ring taps, relaxed pace and restart work at 320 pixels', async ({ page }) => {
    const game = await startLanternShift(page, true);
    const canvas = game.getByLabel('Lantern Shift game');
    const status = game.getByRole('status');
    const bounds = await canvas.boundingBox();
    await canvas.tap({ position: { x: bounds.width * 426 / 800, y: bounds.height * 236 / 450 } });
    await expect(status).toContainText('Lane outer');
    await game.getByRole('button', { name: 'Change pace' }).tap();
    await expect(status).toContainText('Relaxed pace');
    await game.getByRole('button', { name: 'Restart course' }).tap();
    await expect(status).toContainText('Lanterns 0/8 · Goal 6 · Lane inner · Next lantern 1 in inner lane · Relaxed pace');
    await expect(game.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
});
