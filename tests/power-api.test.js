import assert from 'node:assert/strict';
import test from 'node:test';

import { sampleGenerationPayload, sampleSupplyPayload } from '../data/sample-power-data.js';
import { GENERATION_ENDPOINT, SUPPLY_ENDPOINT } from '../js/power-data.js';
import { createPowerDataHandler, powerApiPlugin } from '../server/power-api.js';

function fakeResponse() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = JSON.parse(body);
    }
  };
}

function sampleFetch(calls) {
  return async (url) => {
    calls.push(url);
    if (url === SUPPLY_ENDPOINT) return structuredClone(sampleSupplyPayload);
    if (url === GENERATION_ENDPOINT) return structuredClone(sampleGenerationPayload);
    throw new Error(`unexpected ${url}`);
  };
}

test('development proxy validates official feeds and caches until forced', async () => {
  const calls = [];
  let nowMs = new Date('2026-05-30T00:15:00.000Z').getTime();
  const handler = createPowerDataHandler({ fetchJson: sampleFetch(calls), now: () => nowMs });

  const first = fakeResponse();
  await handler({ url: '/api/power-data' }, first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['Cache-Control'], 'no-store');
  assert.equal(first.body.schemaVersion, 2);
  assert.equal(first.body.model.source, 'taipower-proxy');
  assert.equal(first.body.generatedFor, undefined);
  assert.deepEqual(first.body.sources, { supply: SUPPLY_ENDPOINT, generation: GENERATION_ENDPOINT });
  assert.equal(first.body.cache.hit, false);
  assert.equal(calls.length, 2);

  nowMs += 30_000;
  const cached = fakeResponse();
  await handler({ url: '/api/power-data.json' }, cached);
  assert.equal(cached.body.cache.hit, true);
  assert.equal(calls.length, 2);

  const forced = fakeResponse();
  await handler({ url: '/api/power-data?force=1' }, forced);
  assert.equal(forced.body.cache.hit, false);
  assert.equal(calls.length, 4);
});

test('development proxy fails closed with 502 instead of serving sample data', async () => {
  const handler = createPowerDataHandler({
    fetchJson: async () => ({}),
    now: () => Date.now()
  });
  const response = fakeResponse();
  await handler({ url: '/api/power-data' }, response);
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.model, undefined);
  assert.equal(typeof response.body.error, 'string');
});

test('vite plugin only intercepts the power data routes', async () => {
  const plugin = powerApiPlugin({ fetchJson: async () => ({}) });
  let middleware = null;
  plugin.configureServer({ middlewares: { use(fn) { middleware = fn; } } });

  let passedThrough = 0;
  for (const url of ['/', '/index.html', '/server/power-api.js', '/api/power-data-extra']) {
    middleware({ url }, fakeResponse(), () => { passedThrough += 1; });
  }
  assert.equal(passedThrough, 4);

  const response = fakeResponse();
  await new Promise((resolveResponse) => {
    response.end = function end(body) {
      this.body = JSON.parse(body);
      resolveResponse();
    };
    middleware({ url: '/api/power-data?force=1' }, response, () => assert.fail('should not pass through'));
  });
  assert.equal(response.statusCode, 502);
});
