import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import arcadeConfig from '../playwright.config.js';

const baseURL = 'http://127.0.0.1:4208';

export default defineConfig({
  ...arcadeConfig,
  testDir: '.',
  testMatch: 'browser.spec.mjs',
  timeout: 90_000,
  use: { ...arcadeConfig.use, baseURL, launchOptions: {
    ...arcadeConfig.use.launchOptions,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  } },
  webServer: { ...arcadeConfig.webServer, cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'npm run dev -- --port 4208', url: baseURL }
});
