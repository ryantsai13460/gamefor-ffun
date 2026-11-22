import { expect, test } from '@playwright/test';

test('the editable Gamffun username keeps earlier saved data and follows the visitor on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    const key = 'gamefor-ffun-complete-v2';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ favorites: ['2048'], theme: 'ocean' }));
  });
  await page.goto('/#home');
  const badge = page.locator('#arcade-profile');
  await expect(badge).toHaveAccessibleName('Edit Gamffun profile user_12345');
  await badge.click();
  const profile = page.getByRole('region', { name: 'Gamffun profile', exact: true });
  const name = profile.getByRole('textbox', { name: 'Gamffun username' });
  await expect(name).toHaveValue('user_12345');
  await name.fill('player@example.test');
  await name.press('Enter');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  await expect(badge).toHaveAccessibleName('Edit Gamffun profile user_12345');

  await name.fill('Player-42');
  await name.press('Enter');
  await expect(profile.getByRole('status')).toHaveText('Username saved on this device.');
  await expect(badge).toHaveAccessibleName('Edit Gamffun profile Player-42');
  await page.reload();
  await expect(name).toHaveValue('Player-42');
  expect(await page.evaluate(() => document.body.dataset.theme)).toBe('ocean');

  await page.goto('/#library');
  const summary = page.getByRole('region', { name: 'Your Gamffun profile' });
  await expect(summary.getByRole('heading', { name: 'Player-42' })).toBeVisible();
  await expect(page.locator('.discovery-card[href="#play/2048"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await summary.getByRole('link', { name: 'Edit profile' }).click();
  await profile.getByRole('button', { name: 'Use default username' }).click();
  await expect(name).toHaveValue('user_12345');
  await expect(badge).toHaveAccessibleName('Edit Gamffun profile user_12345');
});

test('Home opens each service inside Gamffun with the same profile', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  const badge = page.locator('#arcade-profile');
  for (const [link, hash, title] of [
    ['Instagram', '#instagram', 'Instagram'],
    ['Discord', '#community?view=discord', 'Discord'],
    ['Amazon picks', '#shopping?retailer=amazon', 'Amazon discovery']
  ]) {
    await page.goto('/#home');
    await page.getByRole('navigation', { name: 'Browse the arcade' }).getByRole('link', { name: link, exact: true }).click();
    await expect(page).toHaveURL(url => url.hash === hash);
    await expect(page.getByRole('main').getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(badge).toHaveAccessibleName('Edit Gamffun profile user_12345');
  }
  expect(page.context().pages()).toHaveLength(1);
});

test('My library keeps the exact Amazon picks saved from their detail pages', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#shopping?retailer=amazon&product=B0DM1WH5BV');
  await page.getByRole('button', { name: 'Save item', exact: true }).click();
  await page.goto('/#library');
  const picks = page.locator('.section-block').filter({ has: page.getByRole('heading', { name: 'Saved Amazon picks', exact: true }) });
  const item = picks.getByRole('link', { name: '8BitDo Ultimate 2C Bluetooth Controller', exact: true });
  await expect(item).toHaveAttribute('href', '#shopping?retailer=amazon&product=B0DM1WH5BV');
  await item.click();
  await expect(page.getByRole('button', { name: 'Saved item', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open on Amazon', exact: true }))
    .toHaveAttribute('href', 'https://www.amazon.com/dp/B0DM1WH5BV');
});
