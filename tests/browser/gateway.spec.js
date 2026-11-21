import { test, expect } from '@playwright/test';

test('the gateway connects without browser storage and fits Unicode history within the server request limit', async ({ page }) => {
  const prompt = '問'.repeat(3000);
  const history = Array.from({ length: 8 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: String(index) + '\u0001'.repeat(949),
  }));
  let sent;
  let authorization;
  await page.route('https://gateway.example/api/chat', async route => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    sent = route.request().postData();
    authorization = route.request().headers().authorization;
    await route.fulfill({ status: 200, headers, contentType: 'text/event-stream',
      body: ': heartbeat\r\n\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"Fixture reply"}}]}\r\n\r\ndata: [DONE]\r\n\r\n' });
  });
  await page.goto('/#blip');
  const reply = await page.evaluate(async ({ text, messages }) => {
    const gateway = await import('/assets/service-gateway.js?regression');
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ffun.gateway.url') throw new DOMException('Blocked storage', 'SecurityError');
      return originalSetItem.call(this, key, value);
    };
    const target = document.createElement('div');
    document.body.append(target);
    gateway.renderGatewaySettings(target);
    const form = target.querySelector('form');
    form.elements.endpoint.value = 'https://gateway.example';
    form.elements.access.value = 'fixture-access';
    form.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    const result = await gateway.hostedBlipReply({ text, history: messages, mode: 'quick' });
    return { result, cleared: form.elements.access.value === '', savedUrl: localStorage.getItem('ffun.gateway.url') };
  }, { text: prompt, messages: history });

  expect(reply).toEqual({ result: 'Fixture reply', cleared: true, savedUrl: null });
  expect(authorization).toBe('Bearer fixture-access');
  expect(Buffer.byteLength(sent)).toBeLessThanOrEqual(32_768);
  const messages = JSON.parse(sent).messages;
  expect(messages.at(-1)).toEqual({ role: 'user', content: prompt });
  const trimmedHistory = messages.slice(0, -1);
  expect(trimmedHistory.length).toBeGreaterThan(0);
  expect(trimmedHistory.length).toBeLessThan(history.length);
  expect(trimmedHistory).toEqual(history.slice(-trimmedHistory.length).map(({ role, text }) => ({ role, content: text })));
});
