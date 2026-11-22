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

test('Amazon picks open exact in-site product details and persist saved items', async ({ page }) => {
  const merchantRequests = [];
  page.on('request', request => {
    if (/^https:\/\/(?:[^/]+\.)?amazon\.com\//.test(request.url())) merchantRequests.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#shopping?retailer=amazon');
  await expect(page.getByRole('heading', { name: 'Amazon discovery' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Retailers' }).getByRole('link', { name: 'Amazon', exact: true }))
    .toHaveAttribute('aria-current', 'page');
  const catalog = page.getByRole('region', { name: 'Amazon picks' });
  await catalog.getByRole('link', { name: 'Gaming gear' }).press('Enter');
  await expect(catalog.getByRole('link', { name: 'Gaming gear' })).toHaveAttribute('aria-current', 'true');
  await expect(catalog.getByRole('link', { name: 'Plugable 9-in-1 USB-C Hub' })).toHaveCount(0);
  const itemTitle = '8BitDo Ultimate 2C Bluetooth Controller';
  await catalog.getByRole('link', { name: itemTitle }).press('Enter');
  await expect(page).toHaveURL(/category=gaming&retailer=amazon&product=B0DM1WH5BV$/);
  await expect(page.getByRole('heading', { name: itemTitle, exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Specifications', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Details from 8BitDo' }))
    .toHaveAttribute('href', 'https://www.8bitdo.com/ultimate-2c-bluetooth-controller/');
  const officialLink = page.getByRole('link', { name: 'Open on Amazon' });
  await expect(officialLink).toHaveAttribute('href', 'https://www.amazon.com/dp/B0DM1WH5BV');
  await expect(officialLink).toHaveAttribute('target', '_blank');
  await expect(officialLink).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Saved item', pressed: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Amazon picks' }).click();
  await expect(page).toHaveURL(/#shopping\?category=gaming&retailer=amazon$/);
  const saved = page.getByRole('heading', { name: 'Saved Amazon items' }).locator('..');
  await saved.getByRole('link', { name: itemTitle }).click();
  await page.getByRole('button', { name: 'Saved item' }).click();
  await page.getByRole('link', { name: 'Back to Amazon picks' }).click();
  await expect(page.getByRole('heading', { name: 'Saved Amazon items' })).toBeHidden();
  expect(merchantRequests).toEqual([]);
});

test('Amazon search finds catalog picks and falls back to the full retailer search', async ({ page }) => {
  await page.goto('/#shopping?retailer=amazon');
  const query = page.getByRole('search', { name: 'Shopping' }).getByRole('searchbox', { name: 'Search shopping' });
  await query.fill('USB-C hubs & HDMI');
  await query.press('Enter');
  const catalog = page.getByRole('region', { name: 'Amazon picks' });
  await expect(catalog.getByRole('link', { name: 'Plugable 9-in-1 USB-C Hub' })).toBeVisible();
  await expect(catalog.getByRole('link', { name: /8BitDo/ })).toHaveCount(0);
  await query.fill('portable speakers');
  await query.press('Enter');
  await expect(catalog.getByText('No matches in the Gamffun catalog.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Amazon results' }))
    .toHaveAttribute('href', 'https://www.amazon.com/s?k=portable+speakers');
  await page.goto('/#shopping?retailer=amazon&product=https://outside.example');
  await expect(page.getByText('That item is outside the Gamffun catalog.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open on Amazon' })).toHaveCount(0);
});

test('Amazon sorting deep links preserve catalog order through filters and item details', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#shopping?retailer=amazon');
  const catalog = page.getByRole('region', { name: 'Amazon picks' });
  const sort = catalog.getByRole('combobox', { name: 'Sort Amazon picks' });
  const apply = catalog.getByRole('button', { name: 'Apply sort', exact: true });
  const titles = catalog.locator('.shopping-product-title');
  await expect(sort).toHaveValue('');
  await sort.selectOption('name');
  await apply.click();
  await expect(page).toHaveURL(/#shopping\?retailer=amazon&sort=name$/);
  await expect(titles.first()).toHaveText('Plugable 4-in-1 USB-C Hub');

  await sort.selectOption('brand');
  await apply.click();
  await expect(page).toHaveURL(/#shopping\?retailer=amazon&sort=brand$/);
  await expect(titles.first()).toHaveText('8BitDo Ultimate 2C Bluetooth Controller');
  await catalog.getByRole('link', { name: 'Computers & accessories', exact: true }).click();
  await expect(sort).toHaveValue('brand');
  await expect(titles).toHaveText(['Plugable 4-in-1 USB-C Hub', 'Plugable 9-in-1 USB-C Hub', 'Plugable Triple 4K USB-C Docking Station']);
  await catalog.getByRole('link', { name: 'Plugable 9-in-1 USB-C Hub', exact: true }).click();
  await expect(page).toHaveURL(/category=computers&retailer=amazon&product=B0D9R5SNG1&sort=brand$/);
  await page.getByRole('button', { name: 'Save item', exact: true }).click();
  await page.getByRole('link', { name: 'Back to Amazon picks', exact: true }).click();
  await expect(page).toHaveURL(/category=computers&retailer=amazon&sort=brand$/);
  await page.reload();
  await expect(sort).toHaveValue('brand');
  await expect(page.getByRole('heading', { name: 'Saved Amazon items' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await page.getByRole('navigation', { name: 'Retailers' }).getByRole('link', { name: 'eBay', exact: true }).click();
  await expect(page).toHaveURL(/category=computers&retailer=ebay$/);
  await expect(sort).toHaveCount(0);
});
