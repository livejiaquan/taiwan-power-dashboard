import {
  GENERATION_ENDPOINT,
  SUPPLY_ENDPOINT
} from './power-data.js';
import { assessDataFreshness, compareFreshnessState } from './data-freshness.js';

const CACHE_KEY = 'taiwan_power_dashboard_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8 * 1000;
const CURRENT_SCHEMA_VERSION = 2;
const OFFICIAL_MODEL_SOURCES = new Set([
  'taipower-static',
  'taipower-proxy',
  'taipower-direct'
]);

const REQUIRED_METRICS = [
  'currentLoadMw',
  'currentUtilizationPercent',
  'forecastReserveRatePercent',
  'forecastReserveCapacityMw',
  'forecastMaxSupplyCapacityMw',
  'forecastPeakDemandMw',
  'totalGenerationMw',
  'renewableGenerationMw',
  'renewableSharePercent',
  'lowCarbonSharePercent'
];

export function buildSameOriginDataUrls(force = false) {
  const suffix = force ? '?force=1' : '';
  const urls = [`api/power-data.json${suffix}`];
  const hostname = globalThis.location?.hostname || '';

  // GitHub Pages cannot serve a dynamic root-level API. Its scheduled build
  // publishes the validated snapshot above, so probing /api only creates a
  // guaranteed 404 outside the project path.
  if (!hostname.endsWith('.github.io')) {
    urls.push(`/api/power-data${suffix}`);
  }

  return urls;
}

function reviveDate(value, label) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${label} must be a valid timestamp`);
  return parsed;
}

export function reviveModel(model) {
  if (!model || typeof model !== 'object') return null;
  if (model.source === 'sample' || model.source === 'sample-static') {
    throw new TypeError('Sample data is not accepted by the production client');
  }
  if (!OFFICIAL_MODEL_SOURCES.has(model.source)) {
    throw new TypeError('Dashboard model source is not an approved Taipower transport');
  }

  const supplyObservedAt = reviveDate(model.feeds?.supply?.observedAt, 'feeds.supply.observedAt');
  const generationObservedAt = reviveDate(model.feeds?.generation?.observedAt, 'feeds.generation.observedAt');
  const supplyFetchedAt = reviveDate(model.feeds?.supply?.fetchedAt, 'feeds.supply.fetchedAt');
  const generationFetchedAt = reviveDate(model.feeds?.generation?.fetchedAt, 'feeds.generation.fetchedAt');
  const fetchedAt = reviveDate(model.fetchedAt, 'fetchedAt');
  const updatedAt = model.updatedAt
    ? reviveDate(model.updatedAt, 'updatedAt')
    : new Date(Math.min(supplyObservedAt.getTime(), generationObservedAt.getTime()));

  for (const metric of REQUIRED_METRICS) {
    if (!Number.isFinite(model.metrics?.[metric])) {
      throw new TypeError(`metrics.${metric} must be a finite number`);
    }
  }

  if (!model.health?.level || !Array.isArray(model.categories) || !Array.isArray(model.topUnits)) {
    throw new TypeError('Dashboard model is incomplete');
  }

  return {
    ...model,
    fetchedAt,
    updatedAt,
    feeds: {
      ...model.feeds,
      supply: {
        ...model.feeds.supply,
        observedAt: supplyObservedAt,
        fetchedAt: supplyFetchedAt
      },
      generation: {
        ...model.feeds.generation,
        observedAt: generationObservedAt,
        fetchedAt: generationFetchedAt
      }
    },
    supply: {
      ...model.supply,
      observedAt: supplyObservedAt
    },
    generation: {
      ...model.generation,
      observedAt: generationObservedAt
    }
  };
}

function hasOfficialEndpoints(sources) {
  return sources?.supply === SUPPLY_ENDPOINT && sources?.generation === GENERATION_ENDPOINT;
}

function validateCachedProvenance(model, metadata) {
  if (!hasOfficialEndpoints(metadata?.sources)) {
    throw new TypeError('Cached model is missing official Taipower endpoint provenance');
  }
  if (model.source === 'taipower-static'
      && (metadata.schemaVersion !== CURRENT_SCHEMA_VERSION || metadata.generatedFor !== 'github-pages')) {
    throw new TypeError('Cached static snapshot provenance is invalid');
  }
  if (model.source === 'taipower-proxy'
      && (metadata.schemaVersion !== CURRENT_SCHEMA_VERSION || metadata.generatedFor !== undefined)) {
    throw new TypeError('Cached proxy snapshot schema is invalid');
  }
  if (model.source === 'taipower-direct'
      && (metadata.schemaVersion !== undefined || metadata.generatedFor !== undefined)) {
    throw new TypeError('Cached direct snapshot transport provenance is invalid');
  }
}

export function evaluateCachedModel(cached, {
  now = new Date(),
  maxReceiptAgeMs = STALE_TTL_MS
} = {}) {
  if (!cached || typeof cached !== 'object' || !Number.isFinite(cached.timestamp)) return null;

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new TypeError('now must be a valid timestamp');

  const receiptAgeMs = nowDate.getTime() - cached.timestamp;
  if (receiptAgeMs < -2 * 60 * 1000 || receiptAgeMs > maxReceiptAgeMs) return null;

  try {
    const model = reviveModel(cached.model);
    if (!model) return null;
    validateCachedProvenance(model, cached.metadata);
    const freshness = assessDataFreshness(model, { now: nowDate });
    if (!freshness.usable) return null;

    return {
      ...cached,
      receiptAgeMs: Math.max(0, receiptAgeMs),
      model,
      freshness
    };
  } catch {
    return null;
  }
}

function readCache(maxReceiptAgeMs = STALE_TTL_MS) {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    if (!raw) return null;
    return evaluateCachedModel(JSON.parse(raw), { maxReceiptAgeMs });
  } catch {
    return null;
  }
}

function writeCache(model, metadata) {
  try {
    globalThis.localStorage?.setItem(
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

export async function fetchJsonWithTimeout(url, init = {}, {
  fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS
} = {}) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`同源 API 回應 HTTP ${response.status}`);
    return await response.json();
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function decorateResult(result, now = new Date()) {
  const model = reviveModel(result.model);
  if (!model) throw new TypeError('資料回應缺少 model');

  const freshness = assessDataFreshness(model, { now });
  if (!freshness.usable) {
    throw new TypeError(freshness.reasons.join('；') || '資料來源時間無法驗證');
  }

  return { ...result, model, freshness };
}

export function validateSameOriginPayload(payload, { now = new Date() } = {}) {
  if (!payload || typeof payload !== 'object' || !payload.model) {
    throw new TypeError('同源 API 缺少 model');
  }

  if (payload.degraded || payload.metadata?.degraded) {
    throw new TypeError('同源 API 回傳降級資料');
  }

  if (payload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new TypeError('同源 API schemaVersion 不相容');
  }
  if (!hasOfficialEndpoints(payload.sources)) {
    throw new TypeError('同源 API 缺少台電官方 endpoint provenance');
  }
  if (payload.model.source === 'sample' || payload.model.source === 'sample-static') {
    throw new TypeError('Sample data is not accepted by the production client');
  }

  const isStaticSnapshot = payload.model.source === 'taipower-static'
    && payload.generatedFor === 'github-pages';
  const isProxySnapshot = payload.model.source === 'taipower-proxy'
    && payload.generatedFor === undefined;
  if (!isStaticSnapshot && !isProxySnapshot) {
    throw new TypeError('同源 API model source 與 transport provenance 不一致');
  }

  const { model, ...metadata } = payload;

  return decorateResult({
    model,
    transport: isStaticSnapshot ? 'static-snapshot' : payload.cache?.hit ? 'proxy-cache' : 'proxy-live',
    metadata
  }, now);
}

async function fetchSameOriginUrl(url) {
  const payload = await fetchJsonWithTimeout(url, { cache: 'no-store' });
  return validateSameOriginPayload(payload);
}

async function fetchViaSameOrigin(force) {
  let lastError = null;

  for (const url of buildSameOriginDataUrls(force)) {
    if (globalThis.location?.protocol === 'file:' && url.startsWith('/')) continue;

    try {
      return await fetchSameOriginUrl(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('同源資料來源不可用');
}

function browserCacheResult(cached) {
  return {
    model: cached.model,
    transport: 'browser-cache',
    metadata: cached.metadata || {},
    freshness: cached.freshness
  };
}

function chooseBestCandidate(candidates) {
  return [...candidates].sort((left, right) => {
    const stateDifference = compareFreshnessState(left.freshness.state, right.freshness.state);
    if (stateDifference !== 0) return stateDifference;
    const observedAtDifference = right.freshness.oldestObservedAt - left.freshness.oldestObservedAt;
    if (observedAtDifference !== 0) return observedAtDifference;
    if (left.transport === 'browser-cache') return 1;
    if (right.transport === 'browser-cache') return -1;
    return 0;
  })[0] || null;
}

function candidateDoesNotRegress(candidate, reference) {
  return ['supply', 'generation'].every((feed) => (
    candidate.model.feeds[feed].observedAt.getTime()
      >= reference.model.feeds[feed].observedAt.getTime()
  ));
}

export function selectBestCandidate({ cachedResult = null, fetchedCandidates = [] } = {}) {
  const eligibleFetched = cachedResult
    ? fetchedCandidates.filter((candidate) => candidateDoesNotRegress(candidate, cachedResult))
    : fetchedCandidates;
  const candidate = chooseBestCandidate([
    ...eligibleFetched,
    ...(cachedResult ? [cachedResult] : [])
  ]);
  const preventedRegression = Boolean(
    cachedResult
    && candidate?.transport === 'browser-cache'
    && fetchedCandidates.some((fetched) => !candidateDoesNotRegress(fetched, cachedResult))
  );

  return { candidate, preventedRegression };
}

export class PowerAPI extends EventTarget {
  async fetchDashboard({ force = false } = {}) {
    this.dispatchEvent(new CustomEvent('fetchStart'));
    const fetchedCandidates = [];

    const cached = readCache();
    let cachedResult = null;
    if (cached) {
      cachedResult = browserCacheResult(cached);
      if (!force && cached.receiptAgeMs <= CACHE_TTL_MS && cached.freshness.state === 'live') {
        this.dispatchEvent(new CustomEvent('fetchSuccess', { detail: cachedResult }));
        return cachedResult;
      }
    }

    const errors = [];
    try {
      fetchedCandidates.push(await fetchViaSameOrigin(force));
    } catch (error) {
      errors.push(error);
    }

    const { candidate, preventedRegression } = selectBestCandidate({
      cachedResult,
      fetchedCandidates
    });
    if (candidate) {
      if (candidate.transport !== 'browser-cache') {
        writeCache(candidate.model, candidate.metadata);
      }
      const needsFallbackExplanation = candidate.freshness.state !== 'live'
        || (candidate.transport === 'browser-cache' && errors.length > 0);
      const result = {
        ...candidate,
        metadata: {
          ...candidate.metadata,
          ...(preventedRegression ? {
            preventedRegression: true,
            reason: '本次取得的來源時間較舊，已保留較新的最後成功資料。'
          } : needsFallbackExplanation ? {
            reason: '官方資料暫時無法取得更新，以下為最後成功資料。'
          } : {})
        }
      };
      this.dispatchEvent(new CustomEvent('fetchSuccess', { detail: result }));
      return result;
    }

    const result = {
      model: null,
      transport: 'unavailable',
      freshness: { state: 'unavailable', usable: false, reasons: ['無可驗證的官方資料'] },
      metadata: {
        reason: '目前無法取得可驗證的台電資料，請稍後再試。',
        diagnostics: errors.map((error) => error?.message || String(error))
      }
    };
    this.dispatchEvent(new CustomEvent('fetchError', { detail: result }));
    return result;
  }
}

export const powerAPI = new PowerAPI();
