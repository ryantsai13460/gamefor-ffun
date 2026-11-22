import { expect, test } from '@playwright/test';

const serverId = '81384788765712384';
const inviteCode = 'arcade-test';
const widget = `https://discord.com/api/guilds/${serverId}/widget.png?style=banner2`;
const invite = `https://discord.com/api/v10/invites/${inviteCode}`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+xE7YAAAAASUVORK5CYII=', 'base64');

test('Community has real project links, reporting paths and a playable recommendation', async ({ page }) => {
  await page.goto('/#community');
  await expect(page.getByRole('heading', { name: 'Community', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gaming discussions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gamffun 5.0' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse source' })).toHaveAttribute('href', 'https://github.com/ryantsai13460/gamefor-ffun');
  await expect(page.getByRole('link', { name: 'Open Gamefor Ffun Issues' })).toHaveAttribute('href', 'https://github.com/ryantsai13460/gamefor-ffun/issues');
  await expect(page.getByRole('link', { name: 'Discord reporting guide' })).toHaveAttribute('href', /support\.discord\.com\/.*Reporting-Abusive/);
  await page.getByRole('link', { name: 'Play Lantern Shift' }).click();
  await expect(page).toHaveURL(/#play\/lantern-shift\?start=1$/);
  await expect(page.getByRole('group', { name: 'Lantern Shift controls' })).toBeVisible();
});

test('Discord settings remain local until the separate widget and invite actions', async ({ page }) => {
  const calls = [];
  await page.route('https://discord.com/**', async route => {
    const request = route.request();
    calls.push({ url: request.url(), headers: await request.allHeaders() });
    if (request.url() === widget) {
      return route.fulfill({ contentType: 'image/png', body: png, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    return route.fulfill({
      json: { type: 0, code: inviteCode, guild: { id: serverId, name: 'Arcade Test', nsfw_level: 2 },
        channel: { nsfw: false }, inviter: { username: 'Do not display me' } },
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  });

  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/#community');
  await page.getByRole('button', { name: 'Discord settings', exact: true }).click();
  const idField = page.getByLabel('Server ID', { exact: true });
  await expect(idField).toBeFocused();
  await idField.fill(serverId);
  await page.getByLabel('Public invite URL (optional)', { exact: true }).fill(`https://discord.gg/${inviteCode}`);
  await page.getByRole('button', { name: 'Save on this device' }).click();
  await expect(page.getByText('Discord settings saved on this device.', { exact: true })).toBeVisible();
  expect(calls).toEqual([]);

  await page.reload();
  const load = page.getByRole('button', { name: 'Load server widget' });
  const check = page.getByRole('button', { name: 'Check public invite' });
  await expect(load).toBeVisible();
  await expect(check).toBeVisible();
  expect(calls).toEqual([]);
  await expect(page.getByRole('link', { name: 'Open Discord invite' })).toHaveCount(0);

  await load.click();
  await expect(page.getByRole('img', { name: 'Discord server status and number of people online' })).toBeVisible();
  expect(calls.map(item => item.url)).toEqual([widget]);
  await check.click();
  await expect(page.getByText(/Discord verified the invite for Arcade Test/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Discord invite' })).toHaveAttribute('href', `https://discord.com/invite/${inviteCode}`);
  await expect(page.getByText('Do not display me')).toHaveCount(0);
  expect(calls.map(item => item.url)).toEqual([widget, invite]);
  expect(calls.every(item => !item.headers.cookie && !item.headers.referer)).toBe(true);

  await page.getByRole('button', { name: 'Discord settings', exact: true }).click();
  await page.getByRole('button', { name: 'Clear settings' }).click();
  await expect(idField).toHaveValue('');
  await expect(check).toHaveCount(0);
  await page.reload();
  await expect(load).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Discord server status and number of people online' })).toHaveCount(0);
  expect(calls.map(item => item.url)).toEqual([widget, invite]);
});

test('Discord rejects invalid URLs, mismatched invites and age-restricted content with a direct fallback', async ({ page }) => {
  let calls = 0;
  await page.route(widget, route => {
    calls++;
    return route.fulfill({ status: 404 });
  });
  await page.route(invite, route => route.fulfill({
    json: { type: 0, code: inviteCode, guild: { id: ++calls === 2 ? '120000000000000000' : serverId, nsfw_level: 3 } },
    headers: { 'Access-Control-Allow-Origin': '*' }
  }));
  await page.goto('/#community');
  await page.getByRole('button', { name: 'Discord settings', exact: true }).click();
  await page.getByLabel('Server ID', { exact: true }).fill(serverId);
  const inviteField = page.getByLabel('Public invite URL (optional)', { exact: true });
  const save = page.getByRole('button', { name: 'Save on this device' });
  await inviteField.fill('https://discord.gg.invalid/arcade-test');
  await save.click();
  await expect(inviteField).toBeFocused();
  await expect(inviteField).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toBe(0);

  await inviteField.fill(`https://discord.gg/${inviteCode}`);
  await save.click();
  await page.getByRole('button', { name: 'Load server widget' }).click();
  await expect(page.getByText(/The widget is unavailable/)).toBeVisible();
  const check = page.getByRole('button', { name: 'Check public invite' });
  await check.click();
  await expect(page.getByText('This invite does not match the configured Discord server.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Discord invite' })).toHaveCount(0);
  await check.click();
  await expect(page.getByText('Discord marks this server or invite channel as age-restricted.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Discord invite' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open server in Discord' })).toHaveAttribute('href', `https://discord.com/channels/${serverId}`);
});

const widgetData = `https://discord.com/api/v10/guilds/${serverId}/widget.json`;

test('Discord browsing loads public channels on demand and filters them in the arcade', async ({ page }) => {
  const calls = [];
  await page.route('https://discord.com/**', async route => {
    const request = route.request();
    calls.push({ url: request.url(), headers: await request.allHeaders() });
    await route.fulfill({
      json: {
        id: serverId, name: 'Arcade Guild',
        members: [{ username: 'Private Fixture', avatar_url: 'https://example.com/member.png' }],
        instant_invite: 'https://discord.gg/widget-invite',
        channels: [
          { id: '120000000000000011', name: 'Talk about games', position: 1, type: 2 },
          { id: '120000000000000012', name: 'Community Stage', position: 2, type: 13 },
          { id: '120000000000000013', name: 'Restricted fixture', type: 2, nsfw: true },
          ...Array.from({ length: 36 }, (_, index) => ({
            id: String(120000000000001010n + BigInt(index)), name: `Extra channel ${index + 1}`, position: index + 3
          }))
        ]
      },
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  });

  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto('/#community');
  await page.getByRole('link', { name: 'Browse Discord', exact: true }).click();
  await expect(page).toHaveURL(/#community\?view=discord$/);
  await expect(page.getByRole('heading', { name: 'Discord', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Discord settings' }).click();
  await page.getByLabel('Server ID', { exact: true }).fill(serverId);
  await page.getByRole('button', { name: 'Save on this device' }).click();
  expect(calls).toEqual([]);

  await page.reload();
  const load = page.getByRole('button', { name: 'Load public channels', exact: true });
  await expect(load).toBeVisible();
  expect(calls).toEqual([]);
  await load.click();
  const list = page.getByRole('list', { name: 'Public Discord channels' });
  await expect(list.getByRole('link')).toHaveCount(36);
  const more = page.getByRole('button', { name: 'Show more channels' });
  await more.click();
  await expect(list.getByRole('link')).toHaveCount(38);
  await expect(list.getByRole('link', { name: 'Extra channel 35', exact: true })).toBeFocused();

  const filter = page.getByRole('searchbox', { name: 'Filter public channels' });
  await filter.fill('stage');
  await expect(list.getByRole('link')).toHaveCount(1);
  await expect(list.getByRole('link', { name: 'Community Stage' })).toHaveAttribute('href', `https://discord.com/channels/${serverId}/120000000000000012`);
  await expect(list.getByRole('link', { name: 'Talk about games' })).toHaveCount(0);
  await expect(page.getByText('Private Fixture')).toHaveCount(0);
  await expect(page.getByText('Restricted fixture')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Discord invite' })).toHaveCount(0);
  expect(calls.map(call => call.url)).toEqual([widgetData]);
  expect(calls.every(item => !item.headers.cookie && !item.headers.referer)).toBe(true);
  await expect(page).toHaveURL(/#community\?view=discord$/);

  await page.getByRole('link', { name: 'Community overview' }).click();
  await expect(page.getByRole('heading', { name: 'Community', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(load).toBeVisible();
  await expect(list).toBeHidden();
  expect(calls.map(call => call.url)).toEqual([widgetData]);
});

test('Discord channel lookup handles disabled and empty widgets while preserving the official server link', async ({ page }) => {
  let runs = 0;
  await page.route(widgetData, route => route.fulfill(++runs === 1
    ? { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
    : { json: { id: serverId, name: 'Arcade Guild', channels: [] }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/#community?view=discord');
  await page.getByRole('button', { name: 'Discord settings' }).click();
  await page.getByLabel('Server ID', { exact: true }).fill(serverId);
  await page.getByRole('button', { name: 'Save on this device' }).click();
  const load = page.getByRole('button', { name: 'Load public channels', exact: true });
  await load.click();
  await expect(page.getByText(/Discord’s public widget is unavailable/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open server in Discord' })).toHaveAttribute('href', `https://discord.com/channels/${serverId}`);
  await load.click();
  await expect(page.getByText(/Arcade Guild does not publish any voice or stage channels/)).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Filter public channels' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Load server widget' })).toBeVisible();
});
