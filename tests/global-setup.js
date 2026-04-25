/**
 * Global setup: starts the static server once for all tests.
 * Playwright calls this before any test runs.
 */

const http = require('http')
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '../dist')
const PORT = 5399

module.exports = async function globalSetup() {
  // Kill any existing server on this port
  await new Promise((resolve) => {
    const req = http.get('http://localhost:' + PORT + '/', () => resolve(true)).on('error', () => resolve(false))
    req.setTimeout(500, () => { req.destroy(); resolve(false) })
  })

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let fp = path.join(distDir, req.url === '/' ? '/index.html' : req.url)
      if (!fs.existsSync(fp)) fp = path.join(distDir, 'index.html')
      const mime = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.ttf': 'font/ttf',
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(fp)] || 'text/plain',
        'Connection': 'keep-alive',
      })
      fs.createReadStream(fp).pipe(res)
    })

    server.maxConnections = 200

    server.listen(PORT, () => {
      console.log('[setup] QA server on http://localhost:' + PORT)
      // Store server reference for teardown
      globalThis.__qaServer = server
      resolve()
    })

    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.log('[setup] Port ' + PORT + ' already in use — assuming server running')
        resolve()
      } else {
        reject(e)
      }
    })
  })
}
