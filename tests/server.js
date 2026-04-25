/**
 * Standalone static server for QA tests.
 * Run separately: node tests/server.js &
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '../dist')
const PORT = 5399

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
  res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'text/plain' })
  fs.createReadStream(fp).pipe(res)
})

server.listen(PORT, () => {
  console.log('QA server listening on http://localhost:' + PORT)
})

process.on('SIGTERM', () => { server.close(); process.exit(0) })
process.on('SIGINT',  () => { server.close(); process.exit(0) })
