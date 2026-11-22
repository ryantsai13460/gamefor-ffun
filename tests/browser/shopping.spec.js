import { expect, test } from '@playwright/test';

test('shopping compares official sources and saves searches and interests on the device', async ({ page }) => {
  const merchantRequests = [];
  page.on('request', request => {
    if (/^https:\/\/(?:[^/]+\.)?(?:amazon|ebay)\.com\//.test(request.url())) merchantRequests.push(request.url());
  });
  await page.goto('/#shopping');
  const searchForm = page.getByRole('search', { name: 'Shopping', exact: true });
  await expect(page.getByRole('heading', { name: 'Shopping', exact: true })).toBeVisible();
  await expect(page.getByText('Loading Shopping…')).toHaveCount(0);
  await searchForm.getByRole('searchbox', { name: 'Search shopping' }).fill('USB-C hub & HDMI');
  await searchForm.getByRole('combobox', { name: 'Category' }).selectOption('computers');
  await searchForm.getByRole('combobox', { name: 'Retailer' }).selectOption('ebay');
  await searchForm.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/#shopping\?q=USB-C\+hub\+%26\+HDMI&category=computers&retailer=ebay$/);
  await expect(page.getByRole('heading', { name: 'USB-C hub & HDMI' })).toBeFocused();
  const ebay = page.getByRole('link', { name: 'Open eBay results' });
  await expect(ebay).toHaveAttribute('href', 'https://www.ebay.com/sch/i.html?_nkw=USB-C+hub+%26+HDMI&_sacat=58058');
  await expect(ebay).toHaveAttribute('target', '_blank');
  await expect(ebay).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByRole('link', { name: 'Open Amazon results' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save search', exact: true }).click();
  await page.getByRole('button', { name: 'Save Computers & accessories interest' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Saved search', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Computers & accessories interest', pressed: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent searches' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your interests' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove saved search USB-C hub & HDMI' }).click();
  await page.getByRole('button', { name: 'Clear recent searches' }).click();
  await expect(page.getByRole('heading', { name: 'Saved searches' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Recent searches' })).toBeHidden();
  expect(merchantRequests).toEqual([]);
});

test('shopping category suggestions fit a narrow screen and open distinct merchant destinations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#shopping');
  await page.getByRole('link', { name: 'Game controllers', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Game controllers', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Amazon results' }))
    .toHaveAttribute('href', 'https://www.amazon.com/s?k=Game+controllers&i=videogames');
  await expect(page.getByRole('link', { name: 'Open eBay results' }))
    .toHaveAttribute('href', 'https://www.ebay.com/sch/i.html?_nkw=Game+controllers&_sacat=1249');
  const widths = await page.evaluate(() => {
    const root = document.querySelector('.shopping');
    return [root.scrollWidth, root.clientWidth, document.documentElement.clientWidth, document.documentElement.scrollWidth];
  });
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  expect(widths[3]).toBeLessThanOrEqual(widths[2]);
});

test('shopping rejects excluded destination queries submitted or followed as a link', async ({ page }) => {
  await page.goto('/#shopping');
  const searchForm = page.getByRole('search', { name: 'Shopping', exact: true });
  const queryInput = searchForm.getByRole('searchbox', { name: 'Search shopping' });
  await queryInput.fill('handgun ammo');
  await queryInput.press('Enter');
  await expect(queryInput).toBeFocused();
  await expect(queryInput).toHaveAttribute('aria-invalid', 'true');
  await expect(searchForm.getByRole('status')).toContainText('Try a search for gaming gear');
  await expect(page.getByRole('link', { name: 'Open Amazon results' })).toHaveCount(0);
  await page.goto('/#shopping?q=handgun+ammo&category=gaming');
  await expect(queryInput).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('link', { name: 'Open Amazon results' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open eBay results' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Recent searches' })).toBeHidden();
});

test('shopping respects the shared search-history preference and keeps explicit saves', async ({ page }) => {
  await page.goto('/#settings');
  await page.getByRole('checkbox', { name: 'Remember searches' }).uncheck();
  await page.goto('/#shopping?q=portable+speakers');
  await expect(page.getByRole('link', { name: 'Open Amazon results' })).toBeVisible();
  await page.getByRole('button', { name: 'Save search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved searches' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent searches' })).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    return JSON.parse(localStorage.getItem('gamefor-ffun-shopping-v1'))?.recent;
  })).toEqual([]);
});

test('shopping keeps changes for this visit if browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'gamefor-ffun-shopping-v1') throw new DOMException('Limit reached', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/#shopping?q=chess+sets');
  await page.getByRole('button', { name: 'Save search', exact: true }).click();
  await expect(page.getByText('Search saved. This change will last for this visit.')).toBeVisible();
  await page.getByRole('link', { name: 'Game controllers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Game controllers', exact: true })).toBeVisible();
  const saved = page.getByRole('heading', { name: 'Saved searches' }).locator('..');
  await expect(saved.getByRole('link', { name: 'chess sets' })).toBeVisible();
});
