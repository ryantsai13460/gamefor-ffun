import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:4178';
const executablePath = process.env.ARCADE_CHROMIUM;
export default defineConfig({
  testDir: 'tests/browser',
  use: {
    baseURL: url,
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
    viewport: { width: 1440, height: 900 }
  },
  webServer: { command: 'npm run dev -- --port 4178', url, reuseExistingServer: false, stderr: 'ignore' },
  reporter: 'list'
});
