import { assessDataFreshness } from './data-freshness.js';

const DEFAULT_TICK_MS = 15 * 1000;

function freshnessFingerprint(freshness) {
  if (!freshness) return 'none';
  return [
    freshness.state,
    freshness.sources?.supply?.state,
    freshness.sources?.supply?.ageMinutes,
    freshness.sources?.generation?.state,
    freshness.sources?.generation?.ageMinutes
  ].join('|');
}

export function createFreshnessClock({
  getResult,
  onFreshnessChange,
  now = () => new Date(),
  intervalMs = DEFAULT_TICK_MS,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval
}) {
  if (typeof getResult !== 'function' || typeof onFreshnessChange !== 'function') {
    throw new TypeError('Freshness clock requires result and change callbacks');
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('Freshness clock interval must be positive');
  }

  let intervalId = null;

  function tick() {
    const result = getResult();
    if (!result?.model) return null;

    const freshness = assessDataFreshness(result.model, { now: now() });
    if (freshnessFingerprint(freshness) !== freshnessFingerprint(result.freshness)) {
      onFreshnessChange(freshness, result);
    }
    return freshness;
  }

  function start() {
    if (intervalId !== null) clearIntervalImpl(intervalId);
    intervalId = setIntervalImpl(tick, intervalMs);
    return intervalId;
  }

  function stop() {
    if (intervalId === null) return;
    clearIntervalImpl(intervalId);
    intervalId = null;
  }

  return { start, stop, tick };
}

export { DEFAULT_TICK_MS };
