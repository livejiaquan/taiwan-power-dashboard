import assert from 'node:assert/strict';
import test from 'node:test';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function flushTurns() {
  return (async () => {
    for (let turn = 0; turn < 20; turn += 1) {
      await new Promise((resolveTurn) => setImmediate(resolveTurn));
    }
  })();
}

test('visibility, focus, and pageshow events immediately re-age rendered freshness', async (t) => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originals = {
    Date: globalThis.Date,
    fetch: globalThis.fetch,
    location: globalThis.location,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval
  };
  t.after(() => {
    Object.assign(globalThis, originals);
    if (localStorageDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  });

  const RealDate = originals.Date;
  const sourceTime = new RealDate('2026-05-29T16:10:00.000Z');
  let currentNowMs = sourceTime.getTime() + 20 * MINUTE_MS;

  class FakeDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [currentNowMs] : args));
    }

    static now() {
      return currentNowMs;
    }
  }
  globalThis.Date = FakeDate;

  const intervals = [];
  globalThis.setInterval = (callback, delay) => {
    intervals.push({ callback, delay });
    return intervals.length;
  };
  globalThis.clearInterval = () => {};
  globalThis.location = { hostname: 'livejiaquan.github.io', protocol: 'https:' };
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); }
    },
    writable: true
  });

  const documentListeners = new Map();
  const windowListeners = new Map();
  const fakeDocument = {
    visibilityState: 'visible',
    addEventListener(type, callback) { documentListeners.set(type, callback); }
  };
  const fakeWindow = {
    addEventListener(type, callback) { windowListeners.set(type, callback); }
  };

  const [
    { sampleGenerationPayload, sampleSupplyPayload },
    { buildStaticDataPayload },
    { createDashboardController },
    { describeTrustState }
  ] = await Promise.all([
    import('../data/sample-power-data.js'),
    import('../scripts/static-data.js'),
    import('../js/dashboard-controller.js'),
    import('../js/dashboard-presenter.js')
  ]);
  const payload = JSON.parse(JSON.stringify(buildStaticDataPayload({
    supplyPayload: sampleSupplyPayload,
    generationPayload: sampleGenerationPayload,
    generatedAt: new FakeDate(sourceTime.getTime() + 5 * MINUTE_MS)
  })));

  const fetchedUrls = [];
  let failRefresh = false;
  globalThis.fetch = async (url) => {
    fetchedUrls.push(String(url));
    if (failRefresh) throw new Error('upstream unavailable');
    if (String(url).startsWith('api/power-data.json')) {
      return { ok: true, status: 200, json: async () => structuredClone(payload) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const controller = createDashboardController({ documentRef: fakeDocument, windowRef: fakeWindow });
  const trust = () => describeTrustState(controller.getSnapshot().result);
  controller.start();
  await flushTurns();

  assert.equal(trust().title, '資料即時');
  assert.match(trust().message, /官方燈號：G · 供電充裕/);
  assert.equal(controller.getSnapshot().ready, true);
  assert.ok(controller.getSnapshot().result.model);
  assert.deepEqual(intervals.map(({ delay }) => delay).sort((a, b) => a - b), [15_000, 600_000]);
  assert.equal(typeof documentListeners.get('visibilitychange'), 'function');
  assert.equal(typeof windowListeners.get('focus'), 'function');
  assert.equal(typeof windowListeners.get('pageshow'), 'function');
  assert.equal(windowListeners.has('beforeunload'), false);
  assert.deepEqual(fetchedUrls, ['api/power-data.json']);

  currentNowMs = sourceTime.getTime() + 90 * MINUTE_MS + 1;
  fakeDocument.visibilityState = 'hidden';
  documentListeners.get('visibilitychange')();
  assert.equal(trust().title, '資料即時');

  fakeDocument.visibilityState = 'visible';
  documentListeners.get('visibilitychange')();
  assert.equal(trust().title, '資料稍舊 · 1 小時前');
  assert.match(trust().message, /最後更新時的官方燈號：G · 供電充裕/);

  const autoRefresh = intervals.find(({ delay }) => delay === 600_000).callback;
  autoRefresh();
  await flushTurns();
  assert.deepEqual(fetchedUrls, ['api/power-data.json', 'api/power-data.json?force=1']);
  assert.match(trust().message, /已重新檢查，官方來源時間尚未更新/);

  // Generation advances while supply remains the older feed: the summary's
  // oldest timestamp does not move, but the refresh must still count as updated.
  const newerGeneration = new RealDate(sourceTime.getTime() + MINUTE_MS).toISOString();
  payload.model.feeds.generation.observedAt = newerGeneration;
  payload.model.generation.observedAt = newerGeneration;
  autoRefresh();
  await flushTurns();
  assert.match(trust().message, /已取得較新的官方來源時間/);
  assert.doesNotMatch(trust().message, /官方來源時間尚未更新/);

  failRefresh = true;
  autoRefresh();
  await flushTurns();
  assert.match(trust().message, /本次重新檢查失敗/);
  assert.doesNotMatch(trust().message, /已重新檢查，官方來源時間尚未更新/);
  assert.ok(controller.getSnapshot().result.model);

  currentNowMs = sourceTime.getTime() + 6 * HOUR_MS + 1;
  windowListeners.get('focus')();
  assert.equal(trust().title, '資料過舊 · 6 小時前');
  assert.match(trust().message, /最後更新時的官方燈號：G · 供電充裕/);

  // Past a day the last official data stays on screen, labelled by its age.
  currentNowMs = sourceTime.getTime() + 24 * HOUR_MS + 1;
  windowListeners.get('pageshow')();
  assert.equal(trust().title, '超過 24 小時的資料 · 24 小時前');
  assert.match(trust().message, /最後更新時的官方燈號：G · 供電充裕/);
  assert.ok(controller.getSnapshot().result.model);
});

test('pausing auto refresh stops network polling but not freshness re-aging', async (t) => {
  const originals = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  t.after(() => Object.assign(globalThis, originals));
  const active = new Map();
  let nextId = 0;
  globalThis.setInterval = (callback, delay) => {
    nextId += 1;
    active.set(nextId, delay);
    return nextId;
  };
  globalThis.clearInterval = (id) => active.delete(id);

  const { createDashboardController } = await import('../js/dashboard-controller.js');
  let fetches = 0;
  const api = { fetchDashboard: async () => { fetches += 1; return { model: null, freshness: { state: 'unavailable', usable: false } }; } };
  const controller = createDashboardController({ api, documentRef: null, windowRef: null });
  controller.start();
  await flushTurns();
  assert.deepEqual([...active.values()].sort((a, b) => a - b), [15_000, 600_000]);

  controller.setAutoRefresh(false);
  assert.equal(controller.getSnapshot().autoRefresh, false);
  assert.deepEqual([...active.values()], [15_000]);

  controller.setAutoRefresh(true);
  await flushTurns();
  assert.deepEqual([...active.values()].sort((a, b) => a - b), [15_000, 600_000]);
  assert.equal(fetches, 2);
  controller.stop();
});

test('reserve headline keeps its colour up to six hours and turns neutral after', async () => {
  const { describeReserveStatus } = await import('../js/dashboard-presenter.js');
  const model = {
    health: { level: 'stable', labelZh: '供電充裕', color: '#059669' },
    supply: { forecastReserveIndicator: 'G' },
    reserveGuide: {
      displayRatePercent: 21.3,
      displayPrecision: 1,
      displayDistanceFromStableLinePercent: 11.3,
      summary: '高於供電充裕門檻 11.3 個百分點',
      description: '備轉容量率 10% 以上'
    }
  };

  assert.equal(describeReserveStatus(model, { state: 'live' }).headline, '供電充裕');
  const delayed = describeReserveStatus(model, { state: 'delayed' });
  assert.equal(delayed.headline, '供電充裕');
  assert.equal(delayed.muted, false);
  for (const state of ['stale', 'expired']) {
    const old = describeReserveStatus(model, { state });
    assert.equal(old.headline, '最後更新時：供電充裕', state);
    assert.equal(old.color, '#64748b', state);
    assert.equal(old.muted, true, state);
    assert.match(old.ariaValueText, /^最後更新時，21\.3%，官方 G 燈/, state);
  }
  assert.equal(describeReserveStatus(model, { state: 'live' }).marginText, '+11.3pp');
});

test('data time label merges both feeds and follows the three-tier wording', async () => {
  const { describeDataTime, formatDataAge } = await import('../js/dashboard-presenter.js');
  const at = new Date('2026-10-22T10:30:00.000Z'); // 18:30 Asia/Taipei
  const label = (state, ageMinutes) => describeDataTime({ state, oldestObservedAt: at, ageMinutes });

  assert.deepEqual(
    { ...label('live', 30), label: label('live', 30).label },
    { tier: 'live', tierLabel: '即時', tone: 'live', label: '資料時間 18:30 · 30 分鐘前', note: null, showOfficialLink: false }
  );
  assert.equal(label('delayed', 180).label, '資料時間 18:30 · 3 小時前');
  assert.equal(label('delayed', 180).tone, 'amber');
  assert.equal(label('delayed', 180).note, null);
  assert.match(label('stale', 480).note, /^GitHub 排程延遲，最後成功更新 18:30。本站每 3–4 小時更新一次/);
  assert.equal(label('stale', 480).showOfficialLink, true);
  assert.equal(label('expired', 1800).label, '資料時間 10/22 18:30 · 30 小時前');
  assert.match(label('expired', 1800).note, /^這是 24 小時前的資料。/);
  assert.equal(describeDataTime({ state: 'unavailable', oldestObservedAt: at, ageMinutes: 5 }), null);

  assert.equal(formatDataAge(59), '59 分鐘前');
  assert.equal(formatDataAge(60), '1 小時前');
  assert.equal(formatDataAge(48 * 60 - 1), '47 小時前');
  assert.equal(formatDataAge(48 * 60), '2 天前');
});
