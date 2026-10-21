import { SECTION_ENDPOINTS } from './power-curves.js';

const REQUEST_TIMEOUT_MS = 8 * 1000;

function isPointList(value, field) {
  return Array.isArray(value?.points)
    && value.points.length > 0
    && value.points.every((point) => typeof point.time === 'string'
      && typeof point.at === 'string'
      && !Number.isNaN(new Date(point.at).getTime())
      && point[field] && typeof point[field] === 'object');
}

// Curves are supplementary context. Anything that does not match the schema
// or the official endpoint provenance is dropped section by section.
export function validateCurvesPayload(payload) {
  if (!payload || payload.schemaVersion !== 1 || payload.unit !== 'MW') return null;
  if (!payload.sources || Object.entries(SECTION_ENDPOINTS).some(([key, url]) => payload.sources[key] !== url)) {
    return null;
  }

  const days = (list, fields) => (Array.isArray(list)
    && list.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && fields.every((field) => Number.isFinite(day[field] ?? NaN) || day[field] === null))
    ? list
    : null);

  return {
    generatedAt: new Date(payload.generatedAt),
    todayKey: payload.todayKey,
    today: isPointList(payload.today, 'fuels') ? payload.today : null,
    yesterday: isPointList(payload.yesterday, 'fuels') ? payload.yesterday : null,
    areas: isPointList(payload.areas, 'areas') ? payload.areas : null,
    recentDays: days(payload.recentDays, ['reserveMw', 'reserveRatePercent']),
    forecast: days(payload.forecast, ['supplyCapacityMw', 'peakLoadMw', 'reserveRatePercent', 'reserveMw']),
    errors: payload.errors || {}
  };
}

export function buildCurvesUrls() {
  const hostname = globalThis.location?.hostname || '';
  return hostname.endsWith('.github.io') ? ['api/curves.json'] : ['api/curves.json', '/api/curves'];
}

export async function fetchCurves({ fetchImpl = globalThis.fetch } = {}) {
  for (const url of buildCurvesUrls()) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) continue;
      const curves = validateCurvesPayload(await response.json());
      if (curves) return curves;
    } catch {
      // Try the next transport; curves are optional.
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
  return null;
}
