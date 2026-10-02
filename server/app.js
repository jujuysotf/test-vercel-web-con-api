const express = require('express');
const { getCalendarStatus, getAvailability, todayInArgentina } = require('../lib/calendar');

function toApiPath(url) {
  const queryIndex = url.indexOf('?');
  const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : url.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  const forwarded = params.get('__path');

  if (forwarded) {
    params.delete('__path');
    const clean = forwarded.replace(/^\/+/, '').replace(/^api\//, '').split('?')[0];
    const rest = params.toString();
    return `/api/${clean}${rest ? `?${rest}` : ''}`;
  }

  if (path === '/api' || path.startsWith('/api/')) {
    return url;
  }

  const withSlash = path.startsWith('/') ? path : `/${path}`;
  const rest = params.toString();
  return `/api${withSlash}${rest ? `?${rest}` : ''}`;
}

function createApiApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  app.get('/api/auth-config', (_req, res) => {
    const clientId = (process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
    res.status(200).json({
      clientId: clientId || null,
      message: clientId ? 'Client ID de Google listo' : 'Falta VITE_GOOGLE_CLIENT_ID',
    });
  });

  app.get('/api/calendar-status', async (_req, res) => {
    try {
      res.status(200).json(await getCalendarStatus());
    } catch (err) {
      res.status(200).json({
        connected: false,
        calendarId: 'jujuysotf@gmail.com',
        error: err?.message || String(err),
      });
    }
  });

  app.get('/api/calendar-availability', async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const date = url.searchParams.get('date') || todayInArgentina();
      const duration = parseInt(url.searchParams.get('duration') || '60', 10);
      const result = await getAvailability(date, Number.isFinite(duration) ? duration : 60);
      res.status(200).json(result);
    } catch (err) {
      res.status(200).json({
        error: err?.message || String(err),
        text: err?.message || String(err),
      });
    }
  });

  return app;
}

function createHandler() {
  const api = createApiApp();
  const handler = express();
  handler.use((req, _res, next) => {
    req.url = toApiPath(req.url || '/');
    next();
  });
  handler.use(api);
  return handler;
}

module.exports = { createHandler };
