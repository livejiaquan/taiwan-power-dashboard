import {
  buildDashboardModel,
  GENERATION_ENDPOINT,
  getReserveGuide,
  SUPPLY_ENDPOINT
} from './power-data.js';
import { sampleGenerationPayload, sampleSupplyPayload } from '../data/sample-power-data.js';

const CACHE_KEY = 'taiwan_power_dashboard_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

export function buildSameOriginDataUrls(force = false) {
  const suffix = force ? '?force=1' : '';
  return [`api/power-data.json${suffix}`, `/api/power-data${suffix}`];
}

export function reviveModel(model) {
  if (!model) return null;
  return {
    ...model,
    reserveGuide: model.reserveGuide || getReserveGuide(model.metrics?.forecastReserveRatePercent),
    fetchedAt: model.fetchedAt ? new Date(model.fetchedAt) : new Date(),
    updatedAt: model.updatedAt ? new Date(model.updatedAt) : new Date()
  };
}

function readCache(maxAgeMs = CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    const age = Date.now() - cached.timestamp;
    if (age > maxAgeMs) return null;

    return {
      ...cached,
      age,
      model: reviveModel(cached.model)
    };
  } catch {
    return null;
  }
}

function writeCache(model, metadata) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        model,
        metadata
      })
    );
  } catch {
    // Storage can be unavailable in private browsing or locked-down embeds.
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchSameOriginUrl(url) {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`同源 API 回應 HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.model) {
    throw new Error('同源 API 缺少 model');
  }

  const isStaticSnapshot = payload.model.source === 'taipower-static' || payload.generatedFor === 'github-pages';

  return {
    model: reviveModel(payload.model),
    transport: isStaticSnapshot ? 'static-snapshot' : payload.cache?.hit ? 'proxy-cache' : 'proxy-live',
    metadata: payload
  };
}

async function fetchViaSameOrigin(force) {
  let lastError = null;

  for (const url of buildSameOriginDataUrls(force)) {
    if (window.location.protocol === 'file:' && url.startsWith('/')) {
      continue;
    }

    try {
      return await fetchSameOriginUrl(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('同源資料來源不可用');
}

async function fetchDirectFromTaipower() {
  const [supplyPayload, generationPayload] = await Promise.all([
    fetchJson(SUPPLY_ENDPOINT),
    fetchJson(GENERATION_ENDPOINT)
  ]);

  return {
    model: buildDashboardModel({
      supplyPayload,
      generationPayload,
      fetchedAt: new Date(),
      source: 'taipower-direct'
    }),
    transport: 'direct-live',
    metadata: {
      sources: {
        supply: SUPPLY_ENDPOINT,
        generation: GENERATION_ENDPOINT
      }
    }
  };
}

function buildSampleModel(reason) {
  return {
    model: buildDashboardModel({
      supplyPayload: sampleSupplyPayload,
      generationPayload: sampleGenerationPayload,
      fetchedAt: new Date(),
      source: 'sample'
    }),
    transport: 'sample',
    metadata: {
      degraded: true,
      reason,
      sources: {
        supply: SUPPLY_ENDPOINT,
        generation: GENERATION_ENDPOINT
      }
    }
  };
}

export class PowerAPI extends EventTarget {
  async fetchDashboard({ force = false } = {}) {
    this.dispatchEvent(new CustomEvent('fetchStart'));

    if (!force) {
      const cached = readCache();
      if (cached) {
        const result = {
          model: cached.model,
          transport: 'browser-cache',
          metadata: cached.metadata,
          stale: false
        };
        this.dispatchEvent(new CustomEvent('fetchSuccess', { detail: result }));
        return result;
      }
    }

    try {
      const result = await fetchViaSameOrigin(force);
      writeCache(result.model, result.metadata);
      this.dispatchEvent(new CustomEvent('fetchSuccess', { detail: result }));
      return result;
    } catch (proxyError) {
      try {
        const result = await fetchDirectFromTaipower();
        writeCache(result.model, result.metadata);
        this.dispatchEvent(new CustomEvent('fetchSuccess', { detail: result }));
        return result;
      } catch (directError) {
        const staleCache = readCache(STALE_TTL_MS);
        if (staleCache) {
          const result = {
            model: staleCache.model,
            transport: 'stale-browser-cache',
            metadata: {
              ...staleCache.metadata,
              degraded: true,
              reason: `官方資料暫時無法更新：${directError.message}`
            },
            stale: true
          };
          this.dispatchEvent(new CustomEvent('fetchSuccess', { detail: result }));
          return result;
        }

        const result = buildSampleModel(`官方資料暫時無法載入：${proxyError.message}; ${directError.message}`);
        this.dispatchEvent(new CustomEvent('fetchError', { detail: result }));
        return result;
      }
    }
  }
}

export const powerAPI = new PowerAPI();
