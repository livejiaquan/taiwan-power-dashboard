import { powerAPI } from './api.js';
import { classifyRefreshOutcome } from './dashboard-presenter.js';
import { createFreshnessClock } from './freshness-clock.js';

export const AUTO_REFRESH_MS = 10 * 60 * 1000;

function unavailableResult(reason) {
  return {
    model: null,
    transport: 'unavailable',
    freshness: { state: 'unavailable', usable: false, sources: {} },
    metadata: { reason }
  };
}

// Owns loading, auto-refresh, and freshness re-aging for the dashboard. The UI
// layer only subscribes to snapshots; it never decides data trust itself.
export function createDashboardController({
  api = powerAPI,
  autoRefreshMs = AUTO_REFRESH_MS,
  documentRef = globalThis.document,
  windowRef = globalThis.window
} = {}) {
  let snapshot = { result: null, loading: false, ready: false, autoRefresh: true };
  let autoRefreshId = null;
  const listeners = new Set();
  const cleanups = [];

  function setSnapshot(patch) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener(snapshot));
  }

  function setResult(result) {
    // A result whose freshness is no longer usable must never keep its model on
    // screen, even if a stale copy is still attached.
    const visible = result?.model && result.freshness?.usable
      ? result
      : { ...result, model: null };
    setSnapshot({ result: visible, rawResult: result });
  }

  const freshnessClock = createFreshnessClock({
    getResult: () => snapshot.rawResult || null,
    onFreshnessChange: (freshness, result) => {
      setResult({
        ...result,
        freshness,
        metadata: freshness.usable
          ? result.metadata
          : {
              ...result.metadata,
              reason: freshness.reasons.join('；') || '最後成功資料已無法安全呈現。'
            }
      });
    }
  });

  async function load(force = false) {
    if (snapshot.loading) return;

    const previous = snapshot.rawResult;
    setSnapshot({ loading: true });
    try {
      const result = await api.fetchDashboard({ force });
      if (force && result.model) {
        const outcome = classifyRefreshOutcome(previous, result);
        if (outcome) result.refreshOutcome = outcome;
      }
      setResult(result);
    } catch (error) {
      console.error('Dashboard render failed', error);
      setResult(unavailableResult('頁面無法安全呈現資料，請稍後再試。'));
    } finally {
      setSnapshot({ loading: false, ready: true });
    }
  }

  function listen(target, type, handler) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener?.(type, handler));
  }

  function start() {
    listen(documentRef, 'visibilitychange', () => {
      if (documentRef.visibilityState === 'visible') freshnessClock.tick();
    });
    listen(windowRef, 'focus', freshnessClock.tick);
    listen(windowRef, 'pageshow', freshnessClock.tick);

    load();
    if (snapshot.autoRefresh) startAutoRefresh();
    freshnessClock.start();
  }

  function startAutoRefresh() {
    globalThis.clearInterval(autoRefreshId);
    autoRefreshId = globalThis.setInterval(() => load(true), autoRefreshMs);
  }

  // Viewers may pause network refresh (WCAG 2.2.2). Freshness keeps re-aging
  // either way, so a paused page still turns delayed/stale on time.
  function setAutoRefresh(enabled) {
    if (enabled === snapshot.autoRefresh) return;
    if (enabled) {
      startAutoRefresh();
      load(true);
    } else {
      globalThis.clearInterval(autoRefreshId);
      autoRefreshId = null;
    }
    setSnapshot({ autoRefresh: enabled });
  }

  function stop() {
    globalThis.clearInterval(autoRefreshId);
    autoRefreshId = null;
    freshnessClock.stop();
    cleanups.splice(0).forEach((cleanup) => cleanup());
  }

  return {
    start,
    stop,
    refresh: () => load(true),
    setAutoRefresh,
    tick: freshnessClock.tick,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
