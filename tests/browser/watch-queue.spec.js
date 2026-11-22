import { expect, test } from '@playwright/test';

const button = (within, name) => within.getByRole('button', { name, exact: typeof name === 'string' });

test('the watch queue combines Shorts and videos, preserves order and continuations, and stays keyboard operable', async ({ page }) => {
  await page.route(/^https:\/\//, route => route.abort());
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('/#youtube?format=shorts&q=80VtSQHvWBo');
  const short = 'Minecraft, But I Shrunk';
  const video = 'I Built 10 Schools Around The World';
  const queueTab = button(page, /^Watch queue/);
  await button(page, `Queue ${short}`).press('Enter');
  await expect(button(page, `Queue ${short}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, `Add to favorites: ${short}`)).toHaveAttribute('aria-pressed', 'false');

  await button(page, 'Scroll Shorts').click();
  const feed = page.getByRole('dialog', { name: 'Shorts feed' });
  await expect(button(feed, `Queue ${short}`)).toHaveAttribute('aria-pressed', 'true');
  await button(feed, `Queue ${short}`).press('Space');
  await expect(button(feed, `Queue ${short}`)).toHaveAttribute('aria-pressed', 'false');
  await button(feed, `Queue ${short}`).press('Enter');
  await button(feed, 'Close').click();
  await expect(queueTab).toHaveText('Watch queue (1)');

  const search = page.getByRole('searchbox', { name: 'Search titles, creators, or topics' });
  await search.fill('5OLs1GWB4OA');
  await button(page, 'Full videos').click();
  await button(page, `Watch ${video}`).click();
  let player = page.getByRole('dialog', { name: video, exact: true });
  await button(player, `Queue ${video}`).press('Enter');
  await button(player, 'Close').click();
  await queueTab.press('Enter');
  await expect(page).toHaveURL(/#youtube\?format=queue/);
  const list = page.getByRole('list', { name: 'Queued videos' });
  await expect(list.locator('strong')).toHaveText([short, video]);
  await expect(list.getByRole('listitem').first()).toContainText('Short');
  await button(list, `Move ${video} earlier`).press('Enter');
  await expect(list.locator('strong')).toHaveText([video, short]);
  await expect(button(list, `Watch ${video} from queue`)).toBeFocused();
  await page.reload();
  await expect(list.locator('strong')).toHaveText([video, short]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await button(page, 'Play queue').press('Enter');
  await expect(player.locator('iframe')).toHaveAttribute('src', /embed\/5OLs1GWB4OA\?/);
  await expect(button(player, 'Previous in queue')).toBeDisabled();
  await button(player, 'Next in queue').press('Enter');
  player = page.getByRole('dialog', { name: short, exact: true });
  await expect(player.locator('iframe')).toHaveAttribute('src', /embed\/80VtSQHvWBo\?/);
  await expect(page.locator('main iframe')).toHaveCount(1);
  await expect(player.getByText('2 of 2 in queue')).toBeVisible();
  await expect(button(player, 'Next in queue')).toBeDisabled();
  await button(player, 'Close').press('Enter');
  await expect(button(list, `Watch ${short} from queue`)).toBeFocused();

  await page.reload();
  await button(page, 'Continue queue').press('Enter');
  await expect(player.locator('iframe')).toHaveAttribute('src', /embed\/80VtSQHvWBo\?/);
  await button(player, 'Previous in queue').press('Enter');
  player = page.getByRole('dialog', { name: video, exact: true });
  await expect(player.locator('iframe')).toHaveAttribute('src', /embed\/5OLs1GWB4OA\?/);
  await button(player, 'Close').press('Enter');
  await button(list, `Remove ${video} from queue`).press('Enter');
  await expect(list.locator('strong')).toHaveText([short]);
  await expect(button(list, `Remove ${short} from queue`)).toBeFocused();
  await button(list, `Remove ${short} from queue`).press('Enter');
  await expect(queueTab).toBeFocused();
  await expect(page.getByText('Add a video or Short to build your watch queue.')).toBeVisible();
});

test('connected results stay queued across tabs without a second search', async ({ context, page }) => {
  const source = { id: 'yi24DPRG0Sg', title: 'Tate McRae - Housewife (Lyric Video)', creator: 'Tate McRae' };
  let requests = 0;
  await context.route(/^https:\/\//, route => route.abort());
  await context.route('https://video-queue.example/search?**', route => {
    requests++;
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { items: [source] } });
  });
  const otherTab = await context.newPage();
  await otherTab.goto('/#youtube?format=queue');
  await expect(otherTab.getByText('Add a video or Short to build your watch queue.')).toBeVisible();

  await page.goto('/#youtube?format=all&q=Housewife');
  await page.getByText('Connected YouTube search', { exact: true }).click();
  await page.getByLabel('YouTube search endpoint').fill('https://video-queue.example/search');
  await button(page, 'Save search endpoint').click();
  await button(page, 'Search connected service').click();
  await button(page, `Queue ${source.title}`).click();
  await expect(button(otherTab, `Watch ${source.title} from queue`)).toBeVisible();
  expect(requests).toBe(1);

  await otherTab.goto(`/#youtube?format=queue&video=${source.id}`);
  const player = otherTab.getByRole('dialog', { name: source.title, exact: true });
  await expect(player.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/yi24DPRG0Sg\?/);
  await expect(player.getByRole('link', { name: 'Watch on YouTube' })).toHaveAttribute('href', `https://www.youtube.com/watch?v=${source.id}`);
  expect(requests).toBe(1);
  await button(page, `Queue ${source.title}`).click();
  await expect(player.getByText('Removed from watch queue.')).toBeVisible();
  await expect(button(player, `Queue ${source.title}`)).toHaveAttribute('aria-pressed', 'false');
  await button(player, 'Close').click();
  await expect(otherTab.getByText('Add a video or Short to build your watch queue.')).toBeVisible();
});
