import assert from 'node:assert/strict';
import test from 'node:test';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const next = force === undefined ? !this.values.has(name) : Boolean(force);
    if (next) this.values.add(name);
    else this.values.delete(name);
    return next;
  }
}

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.className = '';
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.innerHTML = '';
    this.listeners = new Map();
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      }
    };
    this.textContent = '';
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

test('visibility, focus, and pageshow events immediately re-age rendered freshness', async (t) => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originals = {
    CustomEvent: globalThis.CustomEvent,
    Date: globalThis.Date,
    document: globalThis.document,
    fetch: globalThis.fetch,
    location: globalThis.location,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    window: globalThis.window
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

  if (typeof globalThis.CustomEvent !== 'function') {
    globalThis.CustomEvent = class CustomEvent extends Event {
      constructor(type, init = {}) {
        super(type);
        this.detail = init.detail;
      }
    };
  }

  const idElements = new Map();
  const selectorElements = new Map();
  const dashboardContents = [new FakeElement(), new FakeElement(), new FakeElement()];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const intervals = [];

  function elementFor(map, key) {
    if (!map.has(key)) map.set(key, new FakeElement());
    return map.get(key);
  }

  const fakeDocument = {
    visibilityState: 'visible',
    addEventListener(type, callback) {
      documentListeners.set(type, callback);
    },
    createElement() {
      return new FakeElement();
    },
    createTextNode(text) {
      return { textContent: String(text) };
    },
    getElementById(id) {
      return elementFor(idElements, id);
    },
    querySelector(selector) {
      return elementFor(selectorElements, selector);
    },
    querySelectorAll(selector) {
      if (selector === '[data-dashboard-content]') return dashboardContents;
      return [];
    }
  };

  function fakeSetInterval(callback, delay) {
    const id = intervals.length + 1;
    intervals.push({ id, callback, delay });
    return id;
  }

  function fakeClearInterval() {}

  const fakeWindow = {
    Chart: undefined,
    addEventListener(type, callback) {
      windowListeners.set(type, callback);
    },
    clearInterval: fakeClearInterval,
    scrollTo() {},
    scrollY: 0,
    setInterval: fakeSetInterval,
    setTimeout(callback) {
      callback();
      return 1;
    }
  };

  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;
  globalThis.location = { hostname: 'livejiaquan.github.io', protocol: 'https:' };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem() { return null; },
      setItem() {}
    },
    writable: true
  });
  globalThis.setInterval = fakeSetInterval;
  globalThis.clearInterval = fakeClearInterval;

  const [{ sampleGenerationPayload, sampleSupplyPayload }, { buildStaticDataPayload }] = await Promise.all([
    import('../data/sample-power-data.js'),
    import('../scripts/static-data.js')
  ]);
  const payload = JSON.parse(JSON.stringify(buildStaticDataPayload({
    supplyPayload: sampleSupplyPayload,
    generationPayload: sampleGenerationPayload,
    generatedAt: new FakeDate(sourceTime.getTime() + 5 * MINUTE_MS)
  })));

  const fetchedUrls = [];
  globalThis.fetch = async (url) => {
    fetchedUrls.push(String(url));
    if (String(url).startsWith('api/power-data.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => structuredClone(payload)
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({})
    };
  };

  await import(`../js/main.js?visibility-integration=${sourceTime.getTime()}`);
  for (let turn = 0; turn < 20; turn += 1) {
    await new Promise((resolveTurn) => setImmediate(resolveTurn));
  }

  const noticeTitle = idElements.get('notice-title');
  const noticeMessage = idElements.get('notice-message');
  const unavailableState = idElements.get('unavailable-state');
  assert.equal(noticeTitle.textContent, '官方資料已確認');
  assert.match(noticeMessage.textContent, /官方燈號：G · 供電充裕/);
  assert.deepEqual(intervals.map(({ delay }) => delay).sort((a, b) => a - b), [15_000, 600_000]);
  assert.equal(typeof documentListeners.get('visibilitychange'), 'function');
  assert.equal(typeof windowListeners.get('focus'), 'function');
  assert.equal(typeof windowListeners.get('pageshow'), 'function');
  assert.equal(windowListeners.has('beforeunload'), false);
  assert.deepEqual(fetchedUrls, ['api/power-data.json']);

  currentNowMs = sourceTime.getTime() + 20 * MINUTE_MS + 1;
  fakeDocument.visibilityState = 'hidden';
  documentListeners.get('visibilitychange')();
  assert.equal(noticeTitle.textContent, '官方資料已確認');

  fakeDocument.visibilityState = 'visible';
  documentListeners.get('visibilitychange')();
  assert.equal(noticeTitle.textContent, '資料延遲 21 分鐘');
  assert.match(noticeMessage.textContent, /最後成功快照的官方燈號：G · 供電充裕/);

  intervals.find(({ delay }) => delay === 600_000).callback();
  for (let turn = 0; turn < 20; turn += 1) {
    await new Promise((resolveTurn) => setImmediate(resolveTurn));
  }
  assert.deepEqual(fetchedUrls, ['api/power-data.json', 'api/power-data.json?force=1']);

  currentNowMs = sourceTime.getTime() + 60 * MINUTE_MS + 1;
  windowListeners.get('focus')();
  assert.equal(noticeTitle.textContent, '非即時快照 · 61 分鐘前');
  assert.match(noticeMessage.textContent, /最後成功快照的官方燈號：G · 供電充裕/);

  currentNowMs = sourceTime.getTime() + 24 * HOUR_MS + 1;
  windowListeners.get('pageshow')();
  assert.equal(noticeTitle.textContent, '目前無法確認供電狀態');
  assert.doesNotMatch(noticeMessage.textContent, /官方燈號/);
  assert.equal(unavailableState.hidden, false);
  assert.ok(dashboardContents.every((element) => element.hidden));

});
