import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('Blip downloads private conversations and restores copies after validating the file on-device', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
  });
  await page.goto('/#blip');
  const message = page.getByRole('textbox', { name: 'Message blip.ai' });
  const tools = page.getByText('Chat tools', { exact: true });
  const fileContents = 'Cellos have four strings. Bows pull the strings to make a sound.';
  await page.locator('input[type=file]').setInputFiles({
    name: 'music-notes.txt', mimeType: 'text/plain', buffer: Buffer.from(fileContents),
  });
  await expect(page.getByRole('button', { name: 'Preview music-notes.txt' })).toBeVisible();
  await message.fill('Summarize this attachment.');
  await message.press('Enter');
  await expect(page.locator('.blip-message--assistant')).toContainText('Cellos have four strings.');
  await tools.click();
  await page.getByRole('button', { name: 'Pin chat', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Back up conversations' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^blip-chats-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = await readFile(await download.path());
  const [source] = JSON.parse(backup.toString('utf8')).chats;
  expect(source.localOnly).toBe(true);
  expect(source.pinned).toBe(true);
  expect(source.messages[0].attachments[0].text).toBe(fileContents);

  await tools.click();
  await page.getByRole('button', { name: 'Restore from backup' }).click();
  const dialog = page.getByRole('dialog', { name: 'Restore conversations' });
  const picker = dialog.getByLabel('Blip backup file');
  const restore = dialog.getByRole('button', { name: 'Add conversations' });
  await expect(picker).toBeFocused();
  await expect(restore).toBeDisabled();
  await picker.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await restore.click();
  await expect(dialog.getByRole('status')).toContainText('Choose a supported Blip conversation backup.');
  const chats = page.getByRole('complementary', { name: 'Saved conversations' }).getByRole('listitem');
  await expect(chats).toHaveCount(1);

  await picker.setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: backup });
  await restore.click();
  await expect(dialog).toBeHidden();
  await expect(message).toBeFocused();
  await expect(page.getByText('Added 1 conversation.', { exact: true })).toBeVisible();
  await expect(chats).toHaveCount(2);
  await expect(page.locator('input[type=file]')).toHaveCount(1);

  await page.reload();
  await expect(chats).toHaveCount(2);
  await expect(page.locator('.blip-message--assistant')).toContainText('Cellos have four strings.');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gamefor-ffun:blip:v1')));
  expect(saved.activeId).not.toBe(source.id);
  expect(saved.chats.find(chat => chat.id === saved.activeId)).toMatchObject({ localOnly: true, pinned: true });
});
