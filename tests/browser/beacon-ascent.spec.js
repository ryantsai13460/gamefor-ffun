import { expect, test } from '@playwright/test';

async function startGame(page, touch = false) {
  await page.route('https://**/*', route => route.abort());
  await page.clock.install();
  await page.goto('/#play/beacon-ascent?start=1');
  const game = page.getByRole('group', { name: 'Beacon Ascent controls' });
  const start = game.getByRole('button', { name: 'Start', exact: true });
  if (touch) await start.tap();
  else await start.click();
  return game;
}

test('Beacon Ascent starts locally and responds to jump, dash and pause', async ({ page }) => {
  const game = await startGame(page);
  const canvas = game.getByLabel('Beacon Ascent game');
  const status = game.getByRole('status');
  await expect(canvas).toBeFocused();
  await expect(status).toHaveText('Pine Ridge · Checkpoint ahead · Air dash ready · Falls 0');
  await page.keyboard.down('ArrowRight');
  await canvas.press('Space');
  await page.clock.runFor(170);
  await canvas.press('x');
  await page.clock.runFor(45);
  await expect(status).toContainText('Air dash used');
  await canvas.press('p');
  await page.keyboard.up('ArrowRight');
  await expect(game.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await game.getByRole('button', { name: 'Restart course', exact: true }).click();
  await expect(status).toContainText('Air dash ready');
});

test.describe('Beacon Ascent touch controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 740 } });

  test('touch jump and dash work in the same stage at 320 pixels', async ({ page }) => {
    const game = await startGame(page, true);
    const status = game.getByRole('status');
    await game.getByRole('button', { name: 'Jump', exact: true }).tap();
    await page.clock.runFor(135);
    await game.getByRole('button', { name: 'Dash', exact: true }).tap();
    await page.clock.runFor(45);
    await expect(status).toContainText('Air dash used');
    await expect(game.getByLabel('Beacon Ascent game')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
});
