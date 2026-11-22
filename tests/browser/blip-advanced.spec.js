import { expect, test } from '@playwright/test';

test('Blip uses the optional Gemma depth only after the visitor opts in', async ({ page }) => {
  const requests = [];
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  await page.addInitScript(() => Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined }));
  await page.route('https://gateway.example/api/**', route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.url().endsWith('/api/capabilities')) {
      return route.fulfill({ headers, json: {
        chat: true, advanced: true, search: false, research: false, youtube: false, chatProvider: 'workers-ai',
        advancedChatModel: 'gemma-4', standardOutputTokens: 512, maxStandardOutputTokens: 768, advancedOutputTokens: 1600,
      } });
    }
    const body = request.postDataJSON();
    requests.push(body);
    const text = body.depth === 'advanced' ? 'Compare the time controls before testing the opening.' : 'Start with an easy opening.';
    return route.fulfill({ headers, contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto('/#blip');
  await page.getByRole('button', { name: 'Set up online chat' }).click();
  await page.getByLabel('Backend URL').fill('https://gateway.example');
  await page.getByLabel('Backend access code').fill('fixture-access');
  await page.getByRole('button', { name: 'Connect backend' }).click();
  await expect(page.getByText(/Advanced replies use Gemma 4/)).toBeVisible();
  const advanced = page.getByRole('checkbox', { name: 'Use Advanced replies' });
  await expect(advanced).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Use the connected model for chats without files' }).check();
  await expect(advanced).toBeEnabled();
  await expect(advanced).not.toBeChecked();
  expect(requests).toHaveLength(0);

  const settings = page.locator('.blip-settings-popover > summary');
  const input = page.getByRole('textbox', { name: 'Message blip.ai' });
  await settings.click();
  await input.fill('Suggest a chess opening');
  await input.press('Enter');
  await expect(page.getByText('Start with an easy opening.', { exact: true })).toBeVisible();
  await settings.click();
  await advanced.check();
  await settings.click();
  await expect(page.getByText('Reply engine · Workers AI · Gemma 4')).toBeVisible();
  await input.fill('How could I test it?');
  await input.press('Enter');
  await expect(page.getByText('Compare the time controls before testing the opening.', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0].depth).toBeUndefined();
  expect(requests[1]).toMatchObject({ depth: 'advanced', messages: [
    { role: 'user', content: 'Suggest a chess opening' },
    { role: 'assistant', content: 'Start with an easy opening.' },
    { role: 'user', content: 'How could I test it?' },
  ] });
});

test('Blip reads replies only with a device voice and stops on escape or navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const synthesis = new EventTarget();
    const remote = { name: 'Remote voice', lang: 'en-US', localService: false, default: true };
    const local = { name: 'Device English', lang: 'en-US', localService: true };
    let voices = [remote];
    let current;
    window.spoken = [];
    window.cancelledSpeech = 0;
    synthesis.getVoices = () => voices;
    synthesis.speak = utterance => {
      current = utterance;
      window.spoken.push({ text: utterance.text, voice: utterance.voice.name });
    };
    synthesis.cancel = () => { window.cancelledSpeech++; current?.onerror?.(); };
    window.useDeviceVoice = () => { voices = [remote, local]; synthesis.dispatchEvent(new Event('voiceschanged')); };
    window.finishChunk = () => current?.onend?.();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {
      constructor(text) { this.text = text; }
    } });
    const now = Date.now();
    localStorage.setItem('gamefor-ffun:blip:v1', JSON.stringify({ version: 1, activeId: 'chat-test', chats: [{
      id: 'chat-test', title: 'English practice', mode: 'study', createdAt: now, updatedAt: now, messages: [{
        id: 'reply-test', role: 'assistant', kind: 'model', createdAt: now,
        text: '# Study plan\n\n' + 'Start with a practical opening and check one common variation. '.repeat(7),
      }],
    }] }));
  });
  await page.goto('/#blip');
  await expect(page.getByRole('heading', { name: 'Study plan' })).toBeVisible();
  const read = page.getByRole('button', { name: 'Read aloud' });
  const stop = page.getByRole('button', { name: 'Stop reading' });
  await expect(read).toHaveCount(0);
  await page.evaluate(() => window.useDeviceVoice());
  await expect(read).toBeVisible();
  expect(await page.evaluate(() => window.spoken)).toHaveLength(0);
  await read.click();
  await expect(stop).toBeVisible();
  await page.evaluate(() => window.finishChunk());
  const audio = await page.evaluate(() => window.spoken);
  expect(audio).toHaveLength(2);
  expect(audio[0].text).toMatch(/^Study plan Start with a practical opening/);
  expect(audio.every(chunk => chunk.voice === 'Device English')).toBe(true);
  await stop.press('Escape');
  await expect(read).toBeVisible();
  expect(await page.evaluate(() => window.cancelledSpeech)).toBe(1);
  await read.click();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/#home$/);
  expect(await page.evaluate(() => window.cancelledSpeech)).toBe(2);
});
