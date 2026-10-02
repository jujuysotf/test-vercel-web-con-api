const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const routes = {
  '/api/health': require('./api/health'),
  '/api/calendar-status': require('./api/calendar-status'),
  '/api/calendar-availability': require('./api/calendar-availability'),
  '/api/auth-config': require('./api/auth-config'),
};

const publicDir = path.join(__dirname, 'public');

function withHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
  };
  return res;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');

  const handler = routes[url.pathname];
  if (handler) {
    Promise.resolve(handler(req, withHelpers(res))).catch((err) => {
      if (res.writableEnded) return;
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err?.message || String(err) }));
    });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const filePath = path.join(publicDir, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('No se pudo leer index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '127.0.0.1', () => {
  console.log(`Local: http://localhost:${port}`);
  console.log(`Salud: http://localhost:${port}/api/health`);
  console.log(`Calendario: http://localhost:${port}/api/calendar-status`);
  console.log(`Auth: http://localhost:${port}/api/auth-config`);
});
