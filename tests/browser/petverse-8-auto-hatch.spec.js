import { expect, test } from '@playwright/test';
import { createProgress, EGGS } from '../../assets/petverse/model.js';
import { preferencesKey, soloKey } from '../../assets/petverse/preferences.js';

test.use({ launchOptions: {
  executablePath: process.env.ARCADE_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
} });

test('Auto Hatch caps the final multi-hatch and keeps the same budget through pause and resume', async ({ page }) => {
  const seed = createProgress();
  const egg = EGGS[0];
  seed.xp = 72;
  seed.wallet.sunbeams = 500;
  seed.upgrades.autoHatch = 1;
  seed.upgrades.multiHatch = 1;
  seed.upgrades.hatchSpeed = 2;
  seed.settings.multiHatch = true;
  seed.farming.enabled = false;
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(({ seed, preferencesKey, soloKey }) => {
    if (!location.pathname.endsWith('/petverse/index.html')) return;
    Math.random = () => .1;
    if (!localStorage.getItem(soloKey)) {
      localStorage.setItem(soloKey, JSON.stringify(seed));
      localStorage.setItem(preferencesKey, JSON.stringify({ graphics: { quality: 'low' } }));
    }
  }, { seed, preferencesKey, soloKey });

  await page.goto('/#play/petverse-online?start=1');
  const frame = page.frameLocator('iframe[title="Petverse Online"]');
  const limit = frame.getByRole('combobox', { name: 'Auto-hatch session limit' });
  const session = frame.locator('.pv-auto-status');
  await limit.selectOption('10');
  await expect(frame.locator('[data-egg-id="' + egg.id + '"]')).toContainText('Auto hatch up to 10 eggs · ' + (10 * egg.cost) + ' Gold max');
  await frame.getByRole('button', { name: 'Auto hatch ' + egg.name, exact: true }).click();
  await frame.getByRole('button', { name: 'Pause auto hatch' }).click();
  await expect(session).toContainText('Paused');

  await limit.selectOption('50');
  await expect(session).toContainText('Session limit · 10 eggs');
  await frame.getByRole('button', { name: 'Resume auto hatch' }).click();
  await expect(session).toContainText('Stopped · Reached the 10-egg limit', { timeout: 12_000 });
  await expect(session).toContainText('10 hatched · ' + (10 * egg.cost) + ' Gold spent');
  const saved = await frame.locator('#petverse').evaluate((_, key) => JSON.parse(localStorage.getItem(key)), soloKey);
  expect(saved.wallet.sunbeams).toBe(seed.wallet.sunbeams - 10 * egg.cost);
  expect(saved.stats.eggsHatched).toBe(10);
  expect(saved.hatchHistory.map(result => result.pets.length)).toEqual([1, 3, 3, 3]);

  await page.reload();
  await expect(limit).toHaveValue('50');
  await expect(session).toHaveCount(0);
});
