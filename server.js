/**
 * Tiny static + proxy server so `npm start` can refresh OpenSky / CelesTrak
 * (those two feeds do not send CORS headers to random origins).
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const port = Number(process.env.PORT || 4177)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(body)
}

async function proxy(res, url) {
  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'zenith-earth/1.0' },
    })
    const buf = Buffer.from(await upstream.arrayBuffer())
    send(res, upstream.status, buf, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
  } catch (err) {
    send(res, 502, JSON.stringify({ error: String(err) }), {
      'Content-Type': 'application/json',
    })
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/api/opensky') {
    return proxy(res, 'https://opensky-network.org/api/states/all')
  }
  if (url.pathname.startsWith('/api/celestrak')) {
    const group = url.pathname.replace('/api/celestrak/', '') || 'stations'
    return proxy(
      res,
      `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`,
    )
  }

  let file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!file.startsWith(dist)) return send(res, 403, 'forbidden')
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(dist, 'index.html')
  }
  const ext = path.extname(file)
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found')
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`ZENITH on http://localhost:${port}`)
})
