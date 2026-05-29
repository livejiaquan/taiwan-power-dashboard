import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDashboardModel,
  GENERATION_ENDPOINT,
  SUPPLY_ENDPOINT
} from './js/power-data.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname);
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const cacheTtlMs = 2 * 60 * 1000;

let apiCache = null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'taiwan-power-dashboard/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`Taipower responded with HTTP ${response.status}`);
  }

  return response.json();
}

async function handlePowerData(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const bypassCache = requestUrl.searchParams.get('force') === '1';
  const now = Date.now();

  if (!bypassCache && apiCache && now - apiCache.timestamp < cacheTtlMs) {
    sendJson(response, 200, {
      ...apiCache.payload,
      cache: {
        hit: true,
        storedAt: new Date(apiCache.timestamp).toISOString(),
        ttlSeconds: Math.round((cacheTtlMs - (now - apiCache.timestamp)) / 1000)
      }
    });
    return;
  }

  try {
    const [supplyPayload, generationPayload] = await Promise.all([
      fetchJson(SUPPLY_ENDPOINT),
      fetchJson(GENERATION_ENDPOINT)
    ]);

    const model = buildDashboardModel({
      supplyPayload,
      generationPayload,
      fetchedAt: new Date(),
      source: 'taipower-proxy'
    });

    const payload = {
      model,
      rawUpdatedAt: {
        supply: supplyPayload?.records?.[1]?.publish_time || null,
        generation: generationPayload?.DateTime || null
      },
      sources: {
        supply: SUPPLY_ENDPOINT,
        generation: GENERATION_ENDPOINT
      },
      cache: {
        hit: false,
        storedAt: new Date().toISOString(),
        ttlSeconds: Math.round(cacheTtlMs / 1000)
      }
    };

    apiCache = { timestamp: now, payload };
    sendJson(response, 200, payload);
  } catch (error) {
    sendError(response, 502, error.message);
  }
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = requestUrl.pathname === '/' ? '/index.html' : decodeURIComponent(requestUrl.pathname);
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = resolve(join(rootDir, normalizedPath));

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = createServer((request, response) => {
  if (request.url.startsWith('/api/power-data')) {
    handlePowerData(request, response);
    return;
  }

  serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Taiwan power dashboard running at http://${host}:${port}`);
});
