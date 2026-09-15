const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const DEFAULT_FRESHNESS_POLICY = Object.freeze({
  liveMaxAgeMs: 20 * MINUTE_MS,
  delayedMaxAgeMs: 60 * MINUTE_MS,
  maxSnapshotAgeMs: 24 * HOUR_MS,
  futureToleranceMs: 2 * MINUTE_MS
});

const STATE_PRIORITY = Object.freeze({
  live: 0,
  delayed: 1,
  stale: 2,
  unavailable: 3
});

function parseDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function classifySource(name, value, nowMs, policy) {
  const observedAt = parseDate(value);

  if (!observedAt) {
    return {
      name,
      state: 'unavailable',
      observedAt: null,
      ageMs: null,
      ageMinutes: null,
      reason: '缺少可驗證的官方來源時間'
    };
  }

  const ageMs = nowMs - observedAt.getTime();
  const ageMinutes = Math.max(0, Math.ceil(ageMs / MINUTE_MS));

  if (ageMs < -policy.futureToleranceMs) {
    return {
      name,
      state: 'unavailable',
      observedAt,
      ageMs,
      ageMinutes: 0,
      reason: '官方來源時間位於未來，無法確認資料有效性'
    };
  }

  if (ageMs > policy.maxSnapshotAgeMs) {
    return {
      name,
      state: 'unavailable',
      observedAt,
      ageMs,
      ageMinutes,
      reason: '最後成功資料已超過 24 小時'
    };
  }

  if (ageMs > policy.delayedMaxAgeMs) {
    return { name, state: 'stale', observedAt, ageMs, ageMinutes, reason: '官方來源資料已過期' };
  }

  if (ageMs > policy.liveMaxAgeMs) {
    return { name, state: 'delayed', observedAt, ageMs, ageMinutes, reason: '官方來源資料延遲' };
  }

  return { name, state: 'live', observedAt, ageMs, ageMinutes, reason: null };
}

export function assessDataFreshness(model, {
  now = new Date(),
  policy = DEFAULT_FRESHNESS_POLICY
} = {}) {
  const nowDate = parseDate(now);
  if (!nowDate) throw new TypeError('now must be a valid Date or ISO timestamp');

  const observedAt = {
    supply: model?.feeds?.supply?.observedAt ?? model?.observedAt?.supply,
    generation: model?.feeds?.generation?.observedAt ?? model?.observedAt?.generation
  };

  const sources = {
    supply: classifySource('supply', observedAt.supply, nowDate.getTime(), policy),
    generation: classifySource('generation', observedAt.generation, nowDate.getTime(), policy)
  };

  const sourceStates = Object.values(sources);
  const state = sourceStates.reduce(
    (worst, source) => STATE_PRIORITY[source.state] > STATE_PRIORITY[worst] ? source.state : worst,
    'live'
  );
  const datedSources = sourceStates.filter((source) => source.observedAt);
  const oldestSource = datedSources.reduce(
    (oldest, source) => !oldest || source.observedAt < oldest.observedAt ? source : oldest,
    null
  );

  return {
    state,
    usable: state !== 'unavailable',
    checkedAt: nowDate,
    observedAt: {
      supply: sources.supply.observedAt,
      generation: sources.generation.observedAt
    },
    sources,
    oldestObservedAt: oldestSource?.observedAt || null,
    ageMinutes: oldestSource?.ageMinutes ?? null,
    reasons: sourceStates.filter((source) => source.reason).map((source) => source.reason)
  };
}

export function compareFreshnessState(left, right) {
  return STATE_PRIORITY[left] - STATE_PRIORITY[right];
}
