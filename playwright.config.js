const { defineConfig } = require('@playwright/test')
const path = require('path')
const http = require('http')
const fs = require('fs')

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 8000 },
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    // Restart browser context between tests to avoid state leakage
    // but keep the same browser instance for speed
  },
  reporter: [['list']],
  // Global setup: ensure dist exists
  globalSetup: './tests/global-setup.js',
})
