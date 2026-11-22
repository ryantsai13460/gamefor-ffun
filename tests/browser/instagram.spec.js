import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503, body: 'Provider unavailable' }));
});

test('Instagram filters verified posts and keeps one explicit player with an original link', async ({ page }) => {
  await page.goto('/#instagram?post=DeTUk4sDSp-');
  const viewer = page.locator('.instagram-viewer');
  await expect(page.getByRole('heading', { name: 'Instagram', level: 1 })).toBeVisible();
  await expect(viewer).toContainText('POV: you’re watching the Earth set');
  await expect(viewer.locator('iframe')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search Instagram posts' }).fill('sea ice');
  const catalog = page.getByRole('region', { name: 'Browse posts' });
  await expect(catalog.getByRole('status')).toHaveText('1 public post');
  await page.getByRole('combobox', { name: 'Topic', exact: true }).selectOption('Music');
  await expect(catalog.getByRole('status')).toHaveText('No posts match these filters.');
  await page.getByRole('combobox', { name: 'Topic', exact: true }).selectOption('Nature');
  await catalog.getByRole('button', { name: /see that ice/i }).click();
  await expect(viewer.getByRole('heading', { name: 'See that ice? That’s sea ice.' })).toBeVisible();
  await expect(viewer.locator('iframe')).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Load Instagram player', exact: true }).click();
  await expect(viewer.locator('iframe')).toHaveAttribute('src', 'https://www.instagram.com/reel/DUa5b_BDmmD/embed/');
  await expect(viewer.getByRole('link', { name: 'Open on Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/reel/DUa5b_BDmmD/');
  await expect(viewer.getByRole('status')).toContainText('open it on Instagram');
  await viewer.getByRole('button', { name: 'Close player', exact: true }).click();
  await expect(viewer.locator('iframe')).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Load Instagram player', exact: true })).toBeFocused();
});

test('Instagram paste validates provider and path and replaces the single player on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 730 });
  await page.goto('/#instagram');
  const input = page.getByRole('textbox', { name: 'Public Instagram URL' });
  const submit = page.getByRole('button', { name: 'Load link', exact: true });
  const viewer = page.locator('.instagram-viewer');
  for (const url of ['https://instagram.com.example.org/p/AbCdEf_123/', 'https://www.instagram.com/accounts/login/', 'http://www.instagram.com/p/AbCdEf_123/']) {
    await input.fill(url);
    await submit.click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(viewer.locator('iframe')).toHaveCount(0);
  }
  await input.fill('https://instagram.com/p/AbCdEf_123/?igsh=sample#test');
  await input.press('Enter');
  await expect(viewer.locator('iframe')).toHaveAttribute('src', 'https://www.instagram.com/p/AbCdEf_123/embed/');
  await expect(viewer.getByRole('link', { name: 'Open on Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/p/AbCdEf_123/');
  await input.fill('https://www.instagram.com/reels/Other_4dEf/?igsh=example');
  await submit.click();
  await expect(viewer.locator('iframe')).toHaveCount(1);
  await expect(viewer.locator('iframe')).toHaveAttribute('src', 'https://www.instagram.com/reel/Other_4dEf/embed/');
  await expect(viewer.getByRole('heading', { name: 'Instagram Reel', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#instagram$/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
