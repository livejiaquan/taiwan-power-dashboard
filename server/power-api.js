import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fetchJsonWithTimeout } from '../js/fetch-json.js';
import { runCurveBuild } from '../scripts/build-curve-data.js';
import {
  buildDashboardModel,
  GENERATION_ENDPOINT,
  SUPPLY_ENDPOINT
} from '../js/power-data.js';

const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;
const devCurvesPath = join(tmpdir(), 'taiwan-power-dashboard-dev-curves.json');

function fetchOfficialJson(url) {
  return fetchJsonWithTimeout(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'taiwan-power-dashboard/0.1'
    }
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

// Same-origin development proxy so the browser never depends on Taipower CORS.
// Production (GitHub Pages) serves the validated static snapshot instead.
export function createPowerDataHandler({
  fetchJson = fetchOfficialJson,
  now = () => Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS
} = {}) {
  let apiCache = null;

  return async function handlePowerData(request, response) {
    const requestUrl = new URL(request.url, 'http://localhost');
    const bypassCache = requestUrl.searchParams.get('force') === '1';
    const nowMs = now();

    if (!bypassCache && apiCache && nowMs - apiCache.timestamp < cacheTtlMs) {
      sendJson(response, 200, {
        ...apiCache.payload,
        cache: {
          hit: true,
          storedAt: new Date(apiCache.timestamp).toISOString(),
          ttlSeconds: Math.round((cacheTtlMs - (nowMs - apiCache.timestamp)) / 1000)
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
        fetchedAt: new Date(nowMs),
        source: 'taipower-proxy'
      });
      const payload = {
        schemaVersion: 2,
        model,
        rawUpdatedAt: {
          supply: model.supply.publishTimeText,
          generation: model.generation.updatedAt
        },
        observedAt: {
          supply: model.feeds.supply.observedAt,
          generation: model.feeds.generation.observedAt
        },
        sources: {
          supply: SUPPLY_ENDPOINT,
          generation: GENERATION_ENDPOINT
        },
        cache: {
          hit: false,
          storedAt: new Date(nowMs).toISOString(),
          ttlSeconds: Math.round(cacheTtlMs / 1000)
        }
      };

      apiCache = { timestamp: nowMs, payload };
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 502, { error: error.message });
    }
  };
}

export function createCurvesHandler({
  buildCurves = runCurveBuild,
  now = () => Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS
} = {}) {
  let cache = null;

  return async function handleCurves(request, response) {
    const nowMs = now();
    if (cache && nowMs - cache.timestamp < cacheTtlMs && !request.url.includes('force=1')) {
      sendJson(response, 200, cache.payload);
      return;
    }
    try {
      const { payload } = await buildCurves({ outputPath: devCurvesPath, now: () => new Date(nowMs) });
      cache = { timestamp: nowMs, payload };
      sendJson(response, 200, payload);
    } catch (error) {
      sendJson(response, 502, { error: error.message });
    }
  };
}

export function powerApiPlugin(options = {}) {
  const handler = createPowerDataHandler(options);
  const curvesHandler = createCurvesHandler(options.curves);
  const mount = (server) => {
    server.middlewares.use((request, response, next) => {
      const path = request.url.split('?')[0];
      if (path === '/api/power-data' || path === '/api/power-data.json') {
        handler(request, response);
        return;
      }
      if (path === '/api/curves' || path === '/api/curves.json') {
        curvesHandler(request, response);
        return;
      }
      next();
    });
  };

  return {
    name: 'taiwan-power-api',
    configureServer: mount,
    configurePreviewServer: mount
  };
}
