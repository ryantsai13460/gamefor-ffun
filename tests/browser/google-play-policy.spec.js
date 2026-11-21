import { expect, test } from '@playwright/test';

test('configured Google results keep games in the arcade and open ordinary sources', async ({ page }) => {
  const knownGame = 'https://poki.com/en/g/retro-bowl';
  const unknownGame = 'https://www.coolmathgames.com/0-unlisted-game-fixture';
  const ordinarySource = 'https://en.wikipedia.org/wiki/Arctic_fox';
  const providerResults = [
    { url: unknownGame, titleNoFormatting: 'Unlisted game' },
    { url: 'https://www.google.com/url?q=' + encodeURIComponent(knownGame), titleNoFormatting: 'Retro Bowl' },
    { url: ordinarySource, titleNoFormatting: 'Arctic fox article' },
  ];
  const outboundGameRequests = [];
  await page.route('https://**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'cse.google.com' && url.pathname === '/cse.js') {
      return route.fulfill({ contentType: 'application/javascript', body: `
        window.google = { search: { cse: { element: {
          render() {},
          getElement() {
            return { execute(query) {
              const container = document.getElementById('google-results');
              window.__gcse.searchCallbacks.web.ready('arcade-results', query, [], ${JSON.stringify(providerResults)}, container);
            } };
          }
        } } } };
        window.__gcse.initializationCallback();
      ` });
    }
    if (['poki.com', 'www.coolmathgames.com', 'www.google.com'].includes(url.hostname)) {
      outboundGameRequests.push(url.href);
    }
    return route.fulfill({ contentType: 'text/html', body: '<title>Web source fixture</title>' });
  });
  await page.addInitScript(() => {
    if (window.top === window) localStorage.setItem('ffun.google-engine', 'public_sample_123');
  });

  const frame = page.locator('iframe[title="Google results"]');
  const results = page.frameLocator('iframe[title="Google results"]');
  async function searchWithGoogle() {
    await page.goto('/#web-search?mode=google');
    await page.getByRole('searchbox', { name: 'Google query' }).fill('arctic fox');
    await page.getByRole('button', { name: 'Use Google engine', exact: true }).click();
    await expect(results.getByRole('button', { name: 'Unlisted game', exact: true })).toBeVisible();
  }

  await searchWithGoogle();
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  const arcadeScript = new URL(await page.locator('script[src*="/arcade.js"]').getAttribute('src'), page.url());
  const frameUrl = new URL(await frame.getAttribute('src'));
  expect(frameUrl.searchParams.get('v')).toBe(arcadeScript.searchParams.get('v'));
  expect(frameUrl.searchParams.get('q')).toBe('arctic fox');
  await expect(results.locator('#google-results a[href]')).toHaveCount(0);

  await results.getByRole('button', { name: 'Unlisted game', exact: true }).click();
  await expect(page.getByText('This result points to a game portal. Browse the in-page games to play here.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Games you can play here' })).toHaveAttribute('href', '#games?option=in-page');
  await expect(frame).toHaveAttribute('src', frameUrl.href);

  await results.getByRole('button', { name: 'Retro Bowl', exact: true }).click();
  await expect(page).toHaveURL(/#play\/retrobowl$/);
  await expect(page.getByRole('heading', { name: 'Retro Bowl', level: 1 })).toBeVisible();

  await searchWithGoogle();
  await results.getByRole('button', { name: 'Arctic fox article', exact: true }).click();
  await expect(page).toHaveURL(url => new URLSearchParams(url.hash.split('?')[1]).get('address') === ordinarySource);
  await expect(page.getByRole('heading', { name: 'Proxy Gemini', level: 1 })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
  expect(outboundGameRequests).toEqual([]);
});
