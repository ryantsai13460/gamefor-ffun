import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 320, height: 800 }, hasTouch: true });

test('Terrace Workshop connects the spring and lets players build, undo, and erase', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#play/terrace-workshop?start=1');
  const game = page.getByRole('group', { name: 'Terrace Workshop controls' });
  const board = game.getByRole('group', { name: 'Terrace garden' });
  const status = game.locator('.local-game__status');
  const tile = (row, column) => board.getByRole('button', { name: new RegExp(`^Row ${row}, column ${column}, `) });
  await expect(status).toContainText('Connect the gate to the spring');
  await expect(tile(3, 4)).toBeDisabled();

  await game.press('ArrowDown');
  await expect(tile(1, 1)).toBeFocused();
  await tile(1, 1).press('ArrowDown');
  await tile(2, 1).press('ArrowDown');
  await tile(3, 1).press('ArrowRight');
  await tile(3, 2).press('Enter');
  await expect(tile(3, 2)).toHaveAttribute('data-material', 'path');

  for (const [row, column] of [[3, 3], [4, 3], [4, 4], [4, 5], [3, 5], [3, 6]]) await tile(row, column).tap();
  await expect(status).toContainText('Spring connected');
  await game.getByRole('button', { name: 'Flower bed', exact: true }).tap();
  for (const [row, column] of [[2, 2], [4, 2], [5, 3], [5, 5]]) await tile(row, column).tap();
  await expect(status).toContainText('Garden complete!');

  await game.getByRole('button', { name: 'Undo edit' }).tap();
  await expect(status).toContainText('3 of 4 flower beds');
  await game.getByRole('button', { name: 'Eraser' }).tap();
  await tile(4, 4).tap();
  await expect(status).toContainText('Connect the gate to the spring');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: 'Restart', exact: true }).tap();
  await expect(status).toContainText('0 of 4 flower beds');
  expect(page.context().pages()).toHaveLength(1);
});
