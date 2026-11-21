import { expect, test } from '@playwright/test';

async function openGame(page, id, name, touch = false) {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#play/' + id);
  const play = page.getByRole('button', { name: 'Play game', exact: true });
  await (touch ? play.tap() : play.click());
  const game = page.getByRole('group', { name: name + ' controls' });
  const start = game.getByRole('button', { name: 'Start', exact: true });
  await (touch ? start.tap() : start.click());
  return game;
}

async function tapBoard(board, x, y) {
  const bounds = await board.boundingBox();
  await board.tap({ position: { x: x * bounds.width / 800, y: y * bounds.height / 450 } });
}

test('Fraction Kitchen supports keys, corrective feedback and next orders', async ({ page }) => {
  const game = await openGame(page, 'fraction-kitchen', 'Fraction Kitchen');
  const board = game.getByLabel('Fraction Kitchen game');
  const status = game.getByRole('status');
  await expect(board).toBeFocused();
  await board.press('2');
  await board.press('Enter');
  await expect(status).toContainText('Too little.');
  await board.press('3');
  await board.press('Enter');
  await expect(status).toContainText('Order served!');
  await game.getByRole('button', { name: 'Next order' }).click();
  await expect(status).toContainText('Order 2 of 4 · Match 3/4 · Tray 0');
});

test('Clock Courier exposes the clue and changes the analog clock with the arrow keys', async ({ page }) => {
  const game = await openGame(page, 'clock-courier', 'Clock Courier');
  const board = game.getByLabel('Clock Courier game');
  const status = game.getByRole('status');
  await expect(status).toContainText('Set the clock to 4:30.');
  await board.press('ArrowUp');
  for (let step = 0; step < 6; step++) await board.press('ArrowRight');
  await expect(status).toContainText('Clock set to 4:30');
  await board.press('Enter');
  await expect(status).toContainText('Parcel delivered!');
  await game.getByRole('button', { name: 'Next stop' }).click();
  await expect(status).toContainText('Arrive at quarter past nine.');
});

test.describe('learning games on a mobile touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('Fraction Kitchen accepts a slice card tap and a labeled control tap', async ({ page }) => {
    const game = await openGame(page, 'fraction-kitchen', 'Fraction Kitchen', true);
    const board = game.getByLabel('Fraction Kitchen game');
    const status = game.getByRole('status');
    await tapBoard(board, 300, 320);
    await expect(status).toContainText('Tray 1/4');
    await game.getByRole('button', { name: 'Slice 3', exact: true }).tap();
    await game.getByRole('button', { name: 'Serve order' }).tap();
    await expect(status).toContainText('Order served!');
  });

  test('Clock Courier accepts direct taps on the hour number and minute ring', async ({ page }) => {
    const game = await openGame(page, 'clock-courier', 'Clock Courier', true);
    const board = game.getByLabel('Clock Courier game');
    const status = game.getByRole('status');
    await tapBoard(board, 364, 276);
    await expect(status).toContainText('Clock set to 4:00');
    await tapBoard(board, 281, 360);
    await expect(status).toContainText('Clock set to 4:30');
    await game.getByRole('button', { name: 'Deliver parcel' }).tap();
    await expect(status).toContainText('Parcel delivered!');
  });
});
