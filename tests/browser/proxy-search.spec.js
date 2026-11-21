import { expect, test } from '@playwright/test';

const viewerAddress = page => page.getByRole('textbox', { name: 'Address or search query' });

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('Proxy Gemini searches the connected provider and preserves the official fallback', async ({ page }) => {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS'
  };
  let requests = 0;
  await page.route('https://gateway.example/api/search', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(route.request().postDataJSON()).toMatchObject({ q: 'learn about html' });
    requests++;
    if (requests === 2) return route.fulfill({ status: 503, headers });
    return route.fulfill({ headers, json: { results: [
      { title: 'HTML reference', url: 'https://example.com/reference', description: 'Publisher documentation.' },
      { title: 'Duplicate reference', url: 'https://example.com/reference', description: '' },
      { title: 'Local address', url: 'https://127.0.0.1/private', description: '' }
    ] } });
  });
  await page.route('https://example.com/reference', route => route.fulfill({
    contentType: 'text/html',
    headers: { 'content-security-policy': "frame-ancestors 'none'" },
    body: '<h1>The provider blocks this preview</h1>'
  }));

  await page.goto('/#web-search');
  await page.getByText('Connect a web search provider', { exact: true }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await page.getByRole('link', { name: 'Proxy Gemini', exact: true }).click();
  await viewerAddress(page).fill('learn about html');
  await viewerAddress(page).press('Enter');

  const results = page.locator('.proxy-search-results');
  await expect(results.getByRole('heading', { name: 'HTML reference' })).toBeVisible();
  await expect(results.getByRole('listitem')).toHaveCount(1);
  await expect(results.getByText('example.com', { exact: true })).toBeVisible();
  await expect(results.getByText('Publisher documentation.')).toBeVisible();
  const official = results.getByRole('link', { name: 'Open HTML reference in new tab' });
  await expect(official).toHaveAttribute('href', 'https://example.com/reference');
  await expect(official).toHaveAttribute('target', '_blank');
  await results.getByRole('button', { name: 'Preview HTML reference' }).click();
  await expect(page.locator('.proxy-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.getByText(/the site may block embedding/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in new tab', exact: true })).toHaveAttribute('href', 'https://example.com/reference');

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(results.getByRole('heading', { name: 'HTML reference' })).toBeVisible();
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(results.getByText(/provider could not return results/)).toBeVisible();
  expect(requests).toBe(2);
  await expect(page.getByRole('link', { name: 'Search web and YouTube' })).toHaveAttribute('href', '#web-search?q=learn+about+html');
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('Proxy Gemini keeps address errors by tab and updates the recent pages on Home', async ({ page }) => {
  await page.goto('/#browse');
  const address = viewerAddress(page);
  await address.fill('learning games');
  await address.press('Enter');
  await expect(page.getByText('Connect a provider in Web Search to see live results here.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
  await address.fill('javascript:alert(1)');
  await address.press('Enter');
  await expect(address).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'New tab' }).click();
  await expect(address).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Recent pages' })).toBeVisible();
  await page.getByRole('tab', { name: 'learning games', exact: true }).click();
  await expect(address).toHaveValue('javascript:alert(1)');
  await expect(address).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Show browsing history' }).click();
  const history = page.getByRole('dialog', { name: 'Browsing history' });
  await history.getByRole('button', { name: 'Clear browsing history and closed tabs' }).click();
  await history.getByRole('button', { name: 'Close browsing history' }).click();
  await expect(page.getByRole('heading', { name: 'Recent pages' })).toHaveCount(0);
});

test('Google search offers a direct destination and clears the current search', async ({ page }) => {
  await page.goto('/#web-search?mode=google');
  const query = page.getByRole('searchbox', { name: 'Google query' });
  await query.fill('arcade controller');
  const direct = page.getByRole('link', { name: 'Open Google in new tab' });
  await expect(direct).toHaveAttribute('href', 'https://www.google.com/search?q=arcade+controller');
  await expect(direct).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('button', { name: 'Use Google engine' }).click();
  await expect(page.getByText(/Enter a valid public Google Search Engine ID/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(query).toHaveValue('');
  await expect(query).toBeFocused();
  await expect(direct).toHaveCount(0);
  await expect(page.getByText(/Enter a valid public Google Search Engine ID/)).toHaveCount(0);
});
