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

  assert.equal(trust().title, '官方資料已確認');
  assert.match(trust().message, /官方燈號：G · 供電充裕/);
  assert.equal(controller.getSnapshot().ready, true);
  assert.ok(controller.getSnapshot().result.model);
  assert.deepEqual(intervals.map(({ delay }) => delay).sort((a, b) => a - b), [15_000, 600_000]);
  assert.equal(typeof documentListeners.get('visibilitychange'), 'function');
  assert.equal(typeof windowListeners.get('focus'), 'function');
  assert.equal(typeof windowListeners.get('pageshow'), 'function');
  assert.equal(windowListeners.has('beforeunload'), false);
  assert.deepEqual(fetchedUrls, ['api/power-data.json']);

  currentNowMs = sourceTime.getTime() + 20 * MINUTE_MS + 1;
  fakeDocument.visibilityState = 'hidden';
  documentListeners.get('visibilitychange')();
  assert.equal(trust().title, '官方資料已確認');

  fakeDocument.visibilityState = 'visible';
  documentListeners.get('visibilitychange')();
  assert.equal(trust().title, '資料延遲 21 分鐘');
  assert.match(trust().message, /最後成功快照的官方燈號：G · 供電充裕/);

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

  currentNowMs = sourceTime.getTime() + 60 * MINUTE_MS + 1;
  windowListeners.get('focus')();
  assert.equal(trust().title, '非即時快照 · 61 分鐘前');
  assert.match(trust().message, /最後成功快照的官方燈號：G · 供電充裕/);

  currentNowMs = sourceTime.getTime() + 24 * HOUR_MS + 1;
  windowListeners.get('pageshow')();
  assert.equal(trust().title, '目前無法確認供電狀態');
  assert.doesNotMatch(trust().message, /官方燈號/);
  assert.equal(controller.getSnapshot().result.model, null);
});

test('reserve headline is qualified by freshness and greys out stale snapshots', async () => {
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
  assert.equal(describeReserveStatus(model, { state: 'delayed' }).headline, '延遲資料：供電充裕');
  const stale = describeReserveStatus(model, { state: 'stale' });
  assert.equal(stale.headline, '最後快照：供電充裕');
  assert.equal(stale.color, '#64748b');
  assert.match(stale.ariaValueText, /^最後快照，非即時，21\.3%，官方 G 燈/);
  assert.equal(describeReserveStatus(model, { state: 'live' }).marginText, '+11.3pp');
});
