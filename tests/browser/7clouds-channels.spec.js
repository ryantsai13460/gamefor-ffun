import { expect, test } from '@playwright/test';
import { sevenCloudsChannels, sevenCloudsUploads } from '../../assets/seven-clouds-channels.js';

test('Music offers all 43 official 7clouds channels and loads the selected uploads playlist', async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 200, body: '' }));
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto('/#music');
  await page.getByRole('link', { name: '7clouds channels', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Choose a 7clouds channel' });
  await expect(picker.getByRole('option')).toHaveCount(43);
  expect(new Set(Object.values(sevenCloudsUploads)).size).toBe(43);
  expect(sevenCloudsChannels.every(([handle]) => /^UC[\w-]{22}$/.test(sevenCloudsUploads[handle]))).toBe(true);
  const play = page.getByRole('button', { name: 'Play channel uploads' });
  await play.click();
  await expect(page.getByTitle('7clouds uploads')).toHaveAttribute('src', /embed\/videoseries\?list=UUNqFDjYTexJDET3rPDrmJKg$/);
  await picker.selectOption('7cloudsRock');
  await expect(page.locator('main iframe')).toHaveCount(0);
  await page.reload();
  await expect(picker).toHaveValue('7cloudsRock');
  await play.click();
  await expect(page.getByTitle('7clouds Rock uploads')).toHaveAttribute('src', /list=UUQqEC0LPfvgFCP8ixrCqADA$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
