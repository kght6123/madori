import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd /home/user/madori && npm run dev -w server',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'cd /home/user/madori && npm run dev -w client',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
