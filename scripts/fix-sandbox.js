/**
 * fix-sandbox.js
 * Runs after npm install on Linux to fix Electron's chrome-sandbox permissions.
 * Required for Electron to run without --no-sandbox.
 * Safe no-op on macOS and Windows.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.platform !== 'linux') {
  process.exit(0)
}

const sandboxPath = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist', 'chrome-sandbox'
)

if (!fs.existsSync(sandboxPath)) {
  console.log('[fix-sandbox] chrome-sandbox not found, skipping.')
  process.exit(0)
}

try {
  // Check if already correctly owned/permissioned
  const stat = fs.statSync(sandboxPath)
  const isRoot = stat.uid === 0
  const isSUID = !!(stat.mode & 0o4000)
  if (isRoot && isSUID) {
    console.log('[fix-sandbox] chrome-sandbox already correctly configured.')
    process.exit(0)
  }
} catch (_) {}

console.log('[fix-sandbox] Fixing chrome-sandbox permissions (requires sudo)...')
console.log('[fix-sandbox] Run manually if this fails:')
console.log('[fix-sandbox]   sudo chown root:root ' + sandboxPath)
console.log('[fix-sandbox]   sudo chmod 4755 ' + sandboxPath)

try {
  execSync(`sudo chown root:root "${sandboxPath}" && sudo chmod 4755 "${sandboxPath}"`, {
    stdio: 'inherit'
  })
  console.log('[fix-sandbox] Done.')
} catch (e) {
  console.log('[fix-sandbox] Could not fix automatically (no sudo). App will use --no-sandbox flag instead.')
}
