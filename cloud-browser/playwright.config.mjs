import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import arcadeConfig from '../playwright.config.js';

const baseURL = 'http://127.0.0.1:4188';

export default defineConfig({
  ...arcadeConfig,
  testDir: '.',
  testMatch: 'viewer.spec.mjs',
  timeout: 45_000,
  use: { ...arcadeConfig.use, baseURL },
  webServer: { ...arcadeConfig.webServer, cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'npm run dev -- --port 4188', url: baseURL }
});
