import { defineConfig } from '@playwright/test';

const fakeMicrophone = new URL('./test-results/fake-microphone.wav', import.meta.url).pathname;

export default defineConfig({
  testDir: './tests/e2e',
  // Audio capture and service-worker ownership are browser-global enough that
  // a single worker is the stable release gate. Individual claim tests still
  // use fresh browser contexts.
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.mjs',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${fakeMicrophone}`] },
  },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
