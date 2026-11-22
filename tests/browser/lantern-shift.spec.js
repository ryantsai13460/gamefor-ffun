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

test('Lantern Shift keeps the best completed score across retries and reloads', async ({ page }) => {
  await page.clock.install();
  const game = await startLanternShift(page);
  const status = game.getByRole('status');
  await page.clock.runFor(2500);
  await expect(status).toContainText('Lanterns 1/8');
  await game.getByRole('button', { name: 'Restart course' }).click();
  await expect(status).not.toContainText('Course best');

  await game.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.runFor(17_500);
  await expect(status).toContainText('Course best 4/8 · New best');
  await expect(status).toContainText('Try this course again');

  await page.reload();
  await page.getByRole('button', { name: 'Play game', exact: true }).click();
  await expect(status).toContainText('Lanterns 0/8');
  await expect(status).toContainText('Course best 4/8');
  await expect(status).not.toContainText('New best');

  const canvas = game.getByLabel('Lantern Shift game');
  await game.getByRole('button', { name: 'Start', exact: true }).click();
  await canvas.press('ArrowRight');
  await page.clock.runFor(2500);
  await canvas.press('ArrowLeft');
  await page.clock.runFor(15_000);
  await expect(status).toContainText('Lanterns 3/8');
  await expect(status).toContainText('Course best 4/8');
  await expect(status).not.toContainText('New best');
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
