import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.fulfill({ status: 503 }));
});

test('Shorts search, keyboard navigation, scroll and share use the filtered feed', async ({ page }) => {
  await page.goto('/#shorts');
  const feed = page.getByRole('region', { name: 'Shorts feed', exact: true });
  const rail = feed.getByRole('region', { name: 'Vertical video feed' });
  await expect(page.getByRole('heading', { name: 'Shorts', exact: true, level: 1 })).toBeVisible();
  await expect(feed.locator('iframe')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Minecraft');
  await expect(feed.getByRole('heading', { name: 'Minecraft, But I Shrunk', exact: true })).toBeVisible();
  await rail.focus();
  await rail.press('ArrowDown');
  await expect(feed.locator('.shorts-position')).toHaveText(/^2 of /);
  await rail.evaluate(node => { node.scrollTop -= node.clientHeight; });
  await expect(feed.locator('.shorts-position')).toHaveText(/^1 of /);

  const result = page.locator('.shorts-results-list');
  await expect(result.locator('li')).toHaveCount(10);
  await page.getByRole('button', { name: 'Load more shorts', exact: true }).click();
  await expect(result.locator('li')).toHaveCount(20);
  await page.getByRole('searchbox', { name: 'Search shorts', exact: true }).fill('camman18 shrunk');
  await expect(feed.getByRole('heading', { name: 'Minecraft, But I Shrunk', exact: true })).toBeVisible();
  await feed.getByRole('button', { name: 'Share', exact: true }).click();
  const share = feed.getByRole('textbox', { name: 'Link to this short', exact: true });
  await expect(share).toHaveValue(/#shorts\?source=youtube&video=youtube-80VtSQHvWBo$/);
  await page.goto(await share.inputValue());
  await expect(feed.getByRole('heading', { name: 'Minecraft, But I Shrunk', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'YouTube', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Shorts share YouTube favorites and only add to watched after playback begins', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(frame, { events }) {
        this.events = events;
        this.muted = false;
        queueMicrotask(() => events.onReady({ target: this }));
      }
      mute() { this.muted = true; }
      unMute() { this.muted = false; }
      isMuted() { return this.muted; }
      playVideo() { this.events.onStateChange({ data: 1 }); }
      destroy() {}
    } };
  });
  await page.goto('/#shorts?video=youtube-80VtSQHvWBo');
  const feed = page.getByRole('region', { name: 'Shorts feed' });
  const library = page.getByRole('group', { name: 'Shorts library' });
  await library.getByRole('button', { name: 'Recently watched', exact: true }).click();
  await expect(feed.getByRole('heading', { name: 'No watched shorts here' })).toBeVisible();
  await library.getByRole('button', { name: 'Browse', exact: true }).click();
  await feed.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(feed.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await feed.getByRole('button', { name: 'Play short', exact: true }).click();
  await expect(feed.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/80VtSQHvWBo\?/);
  await expect(feed.getByRole('status')).toHaveText('Playing on YouTube.');
  await feed.getByRole('button', { name: 'Unmute', exact: true }).click();
  await expect(feed.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();
  await feed.getByRole('button', { name: 'Next short', exact: true }).click();
  await expect(feed.locator('iframe')).toHaveCount(0);

  await library.getByRole('button', { name: 'Recently watched', exact: true }).click();
  await expect(feed.getByRole('heading', { name: 'Minecraft, But I Shrunk', exact: true })).toBeVisible();
  await expect(feed.locator('.shorts-position')).toHaveText('1 of 1');
  await page.reload();
  await library.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(feed.getByRole('heading', { name: 'Minecraft, But I Shrunk', exact: true })).toBeVisible();
  await expect(feed.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.goto('/#youtube?format=favorites');
  await expect(page.getByRole('button', { name: 'Watch Minecraft, But I Shrunk', exact: true })).toBeVisible();
});

test('Shorts use official TikTok and Instagram destinations on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 745 });
  await page.goto('/#shorts?source=tiktok');
  const platforms = page.getByRole('group', { name: 'Short video platforms' });
  const feed = page.getByRole('region', { name: 'Shorts feed' });
  await expect(platforms.getByRole('button', { name: 'TikTok', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(feed).toContainText('Scout, Suki & Stella');
  await expect(feed.getByRole('link', { name: 'Open on TikTok', exact: true })).toHaveAttribute('href',
    'https://www.tiktok.com/@scout2015/video/6718335390845095173');
  await expect(feed.locator('iframe')).toHaveCount(0);
  await feed.getByRole('button', { name: 'Play short', exact: true }).click();
  await expect(feed.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.tiktok\.com\/player\/v1\/6718335390845095173\?/);
  await platforms.getByRole('button', { name: 'Instagram', exact: true }).click();
  await expect(feed.locator('iframe')).toHaveCount(0);
  await expect(feed).toContainText('NASA Earth');
  await expect(feed.getByRole('link', { name: 'Open on Instagram', exact: true })).toHaveAttribute('href',
    'https://www.instagram.com/reel/DUa5b_BDmmD/');
  await feed.getByRole('button', { name: 'Play short', exact: true }).click();
  await expect(feed.locator('iframe')).toHaveAttribute('src', 'https://www.instagram.com/reel/DUa5b_BDmmD/embed/');
  await expect(feed.getByRole('status')).toContainText('Open on Instagram');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await feed.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/#shorts?source=instagram&view=favorites');
  await expect(feed).toContainText('NASA Earth');
  await expect(feed.locator('.shorts-position')).toHaveText('1 of 1');
  await expect(feed.locator('iframe')).toHaveCount(0);
});
