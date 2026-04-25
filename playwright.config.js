const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 8000 },
  // Run tests serially in one worker to avoid port conflicts
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  reporter: [['list']],
})
