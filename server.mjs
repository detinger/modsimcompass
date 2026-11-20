// Production static server for Railway (and any Node host). No dependencies.
// - Serves the Vite build in ./dist
// - SPA fallback: unknown app routes → index.html (deep links survive refresh)
// - Real 404 for missing static assets (paths with a file extension or under /assets/)
// - GET /healthz → 200 "ok"
// - Binds 0.0.0.0:$PORT (default 8080); graceful shutdown on SIGTERM/SIGINT
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.env.STATIC_DIR || 'dist');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
};
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`[modsim-essentials] ${ROOT}/index.html not found. Run "npm run build" first.`);
  process.exit(1);
}

function send(res, status, file, extraHeaders = {}) {
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...SECURITY,
    ...extraHeaders,
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('Bad request'); return; }
  const target = normalize(join(ROOT, pathname));
  if (!target.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (existsSync(target) && statSync(target).isFile()) { send(res, 200, target); return; }
  const looksLikeAsset = extname(pathname) !== '' || pathname.startsWith('/assets/');
  if (looksLikeAsset) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY }); res.end('Not found'); return; }
  send(res, 200, join(ROOT, 'index.html'));
});

server.listen(PORT, HOST, () => console.log(`[modsim-essentials] serving ${ROOT} on http://${HOST}:${PORT}`));

function shutdown(signal) {
  console.log(`[modsim-essentials] ${signal} received, closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
