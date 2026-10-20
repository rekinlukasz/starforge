// Zero-dependency static server for playing in a browser: npm start
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../www', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // cordova.js only exists in Cordova builds; serve an empty stub in the browser.
    if (url.pathname === '/cordova.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'] }).end(''); return; }
    if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Starforge: http://localhost:${PORT}`));
