import assert from 'node:assert/strict';
import test from 'node:test';

import { sampleGenerationPayload, sampleSupplyPayload } from '../data/sample-power-data.js';
import {
  buildDashboardModel,
  GENERATION_ENDPOINT,
  getReserveGuide,
  PowerDataValidationError,
  summarizeGenerationUnits,
  SUPPLY_ENDPOINT
} from '../js/power-data.js';
import { assessDataFreshness } from '../js/data-freshness.js';
import {
  evaluateCachedModel,
  selectBestCandidate,
  validateSameOriginPayload
} from '../js/api.js';

const MINUTE_MS = 60 * 1000;
const SOURCE_INSTANT = new Date('2026-05-29T16:10:00.000Z');
const FETCH_INSTANT = new Date('2026-05-29T16:15:00.000Z');
const LIVE_NOW = new Date(SOURCE_INSTANT.getTime() + 10 * MINUTE_MS);
const OFFICIAL_SOURCES = Object.freeze({
  supply: SUPPLY_ENDPOINT,
  generation: GENERATION_ENDPOINT
});

function clone(value) {
  return structuredClone(value);
}

function assertValidationError(callback, code) {
  assert.throws(callback, (error) => (
    error instanceof PowerDataValidationError && error.code === code
  ));
}

function buildTrustedModel(source = 'taipower-static') {
  return buildDashboardModel({
    supplyPayload: clone(sampleSupplyPayload),
    generationPayload: clone(sampleGenerationPayload),
    fetchedAt: FETCH_INSTANT,
    source
  });
}

function generationWithNetTotal(targetMw) {
  const payload = clone(sampleGenerationPayload);
  const currentTotal = summarizeGenerationUnits(payload).totals.netGenerationMw;
  const firstOutput = Number(payload.aaData[0]['淨發電量(MW)']);
  payload.aaData[0]['淨發電量(MW)'] = (firstOutput + targetMw - currentTotal).toFixed(1);
  return payload;
}

function buildRatioModel(totalGenerationMw) {
  const supplyPayload = clone(sampleSupplyPayload);
  supplyPayload.records[0].curr_load = '1000.0';
  return buildDashboardModel({
    supplyPayload,
    generationPayload: generationWithNetTotal(totalGenerationMw),
    fetchedAt: FETCH_INSTANT
  });
}

function buildSameOriginPayload(source = 'taipower-static') {
  return {
    schemaVersion: 2,
    ...(source === 'taipower-static' ? { generatedFor: 'github-pages' } : {}),
    sources: clone(OFFICIAL_SOURCES),
    model: JSON.parse(JSON.stringify(buildTrustedModel(source))),
    metadata: {}
  };
}

function makeCandidate(transport, supplyOffsetMs, generationOffsetMs) {
  const model = buildTrustedModel();
  model.feeds.supply.observedAt = new Date(SOURCE_INSTANT.getTime() + supplyOffsetMs);
  model.feeds.generation.observedAt = new Date(SOURCE_INSTANT.getTime() + generationOffsetMs);
  return {
    model,
    transport,
    metadata: {
      schemaVersion: 2,
      generatedFor: 'github-pages',
      sources: clone(OFFICIAL_SOURCES)
    },
    freshness: assessDataFreshness(model, { now: LIVE_NOW })
  };
}

test('generation completeness accepts exactly 100 units and rejects 99', () => {
  const exactly100 = clone(sampleGenerationPayload);
  exactly100.aaData = exactly100.aaData.slice(0, 100);
  const accepted = summarizeGenerationUnits(exactly100);

  assert.equal(accepted.totals.unitCount, 100);
  assert.equal(accepted.totals.knownGenerationCoveragePercent, 100);

  const only99 = clone(exactly100);
  only99.aaData.pop();
  assertValidationError(() => summarizeGenerationUnits(only99), 'incomplete_units');
});

test('generation completeness accepts exactly 98 percent known output and rejects 97 percent', () => {
  const exactly98Percent = clone(sampleGenerationPayload);
  exactly98Percent.aaData = exactly98Percent.aaData.slice(0, 100);
  exactly98Percent.aaData.slice(-2).forEach((row) => {
    row['淨發電量(MW)'] = '-';
  });

  const accepted = summarizeGenerationUnits(exactly98Percent);
  assert.equal(accepted.totals.unitCount, 100);
  assert.equal(accepted.totals.knownGenerationUnitCount, 98);
  assert.equal(accepted.totals.knownGenerationCoveragePercent, 98);

  const only97Percent = clone(exactly98Percent);
  only97Percent.aaData.at(-3)['淨發電量(MW)'] = '-';
  assertValidationError(() => summarizeGenerationUnits(only97Percent), 'incomplete_values');
});

test('generation-to-load ratio accepts inclusive 0.9 and 1.1 boundaries only', () => {
  assert.equal(buildRatioModel(9000).metrics.totalGenerationMw, 9000);
  assert.equal(buildRatioModel(11000).metrics.totalGenerationMw, 11000);

  assertValidationError(() => buildRatioModel(8999.9), 'inconsistent_feed_totals');
  assertValidationError(() => buildRatioModel(11000.1), 'inconsistent_feed_totals');
});

test('same-origin provenance binds schema, source type, deployment type, and exact endpoints', () => {
  const staticPayload = buildSameOriginPayload('taipower-static');
  assert.equal(
    validateSameOriginPayload(staticPayload, { now: LIVE_NOW }).transport,
    'static-snapshot'
  );

  for (const schemaVersion of [undefined, 1, 3]) {
    assert.throws(
      () => validateSameOriginPayload({ ...staticPayload, schemaVersion }, { now: LIVE_NOW }),
      /schemaVersion 不相容/
    );
  }

  for (const generatedFor of [undefined, 'preview', 'local-proxy']) {
    assert.throws(
      () => validateSameOriginPayload({ ...staticPayload, generatedFor }, { now: LIVE_NOW }),
      /source 與 transport provenance 不一致/
    );
  }

  const proxyPayload = buildSameOriginPayload('taipower-proxy');
  assert.equal(
    validateSameOriginPayload(proxyPayload, { now: LIVE_NOW }).transport,
    'proxy-live'
  );
  assert.equal(
    validateSameOriginPayload({ ...proxyPayload, cache: { hit: true } }, { now: LIVE_NOW }).transport,
    'proxy-cache'
  );
  for (const generatedFor of ['github-pages', 'preview', 'evil', null]) {
    assert.throws(
      () => validateSameOriginPayload({ ...proxyPayload, generatedFor }, { now: LIVE_NOW }),
      /source 與 transport provenance 不一致/
    );
  }

  const directPayload = buildSameOriginPayload('taipower-direct');
  assert.throws(
    () => validateSameOriginPayload(directPayload, { now: LIVE_NOW }),
    /source 與 transport provenance 不一致/
  );

  const endpointMutations = [
    undefined,
    { generation: GENERATION_ENDPOINT },
    { supply: SUPPLY_ENDPOINT },
    { supply: GENERATION_ENDPOINT, generation: SUPPLY_ENDPOINT },
    { supply: `${SUPPLY_ENDPOINT}?mirror=1`, generation: GENERATION_ENDPOINT },
    { supply: SUPPLY_ENDPOINT, generation: 'https://example.com/generation.json' }
  ];
  for (const sources of endpointMutations) {
    assert.throws(
      () => validateSameOriginPayload({ ...staticPayload, sources }, { now: LIVE_NOW }),
      /官方 endpoint provenance/
    );
  }
});

test('cached provenance rejects inconsistent source and deployment metadata', () => {
  const staticModel = JSON.parse(JSON.stringify(buildTrustedModel('taipower-static')));
  const baseCache = {
    timestamp: LIVE_NOW.getTime(),
    model: staticModel,
    metadata: {
      schemaVersion: 2,
      generatedFor: 'github-pages',
      sources: clone(OFFICIAL_SOURCES)
    }
  };
  assert.ok(evaluateCachedModel(baseCache, { now: LIVE_NOW }));

  for (const metadata of [
    { ...baseCache.metadata, schemaVersion: 1 },
    { ...baseCache.metadata, generatedFor: 'preview' },
    { ...baseCache.metadata, sources: { ...OFFICIAL_SOURCES, generation: 'https://example.com/feed' } }
  ]) {
    assert.equal(evaluateCachedModel({ ...baseCache, metadata }, { now: LIVE_NOW }), null);
  }

  const proxyModel = JSON.parse(JSON.stringify(buildTrustedModel('taipower-proxy')));
  assert.ok(evaluateCachedModel({
    ...baseCache,
    model: proxyModel,
    metadata: { schemaVersion: 2, sources: clone(OFFICIAL_SOURCES) }
  }, { now: LIVE_NOW }));
  assert.equal(evaluateCachedModel({
    ...baseCache,
    model: proxyModel,
    metadata: clone(baseCache.metadata)
  }, { now: LIVE_NOW }), null);
  assert.equal(evaluateCachedModel({
    ...baseCache,
    model: proxyModel,
    metadata: { schemaVersion: 2, generatedFor: 'preview', sources: clone(OFFICIAL_SOURCES) }
  }, { now: LIVE_NOW }), null);

  const directModel = JSON.parse(JSON.stringify(buildTrustedModel('taipower-direct')));
  assert.ok(evaluateCachedModel({
    ...baseCache,
    model: directModel,
    metadata: { sources: clone(OFFICIAL_SOURCES) }
  }, { now: LIVE_NOW }));
  assert.equal(evaluateCachedModel({
    ...baseCache,
    model: directModel,
    metadata: clone(baseCache.metadata)
  }, { now: LIVE_NOW }), null);
});

test('candidate selection is monotonic for each feed independently', () => {
  const cachedResult = makeCandidate('browser-cache', 0, 0);
  const cases = [
    ['supply regression', -MINUTE_MS, MINUTE_MS, 'browser-cache', true],
    ['generation regression', MINUTE_MS, -MINUTE_MS, 'browser-cache', true],
    ['both regress', -MINUTE_MS, -MINUTE_MS, 'browser-cache', true],
    ['same source instants', 0, 0, 'static-snapshot', false],
    ['supply advances', MINUTE_MS, 0, 'static-snapshot', false],
    ['generation advances', 0, MINUTE_MS, 'static-snapshot', false],
    ['both advance', MINUTE_MS, MINUTE_MS, 'static-snapshot', false]
  ];

  for (const [name, supplyOffset, generationOffset, transport, preventedRegression] of cases) {
    const result = selectBestCandidate({
      cachedResult,
      fetchedCandidates: [makeCandidate('static-snapshot', supplyOffset, generationOffset)]
    });
    assert.equal(result.candidate.transport, transport, name);
    assert.equal(result.preventedRegression, preventedRegression, name);
  }

  const mixed = selectBestCandidate({
    cachedResult,
    fetchedCandidates: [
      makeCandidate('static-snapshot', 10 * MINUTE_MS, -MINUTE_MS),
      makeCandidate('direct-live', MINUTE_MS, 0)
    ]
  });
  assert.equal(mixed.candidate.transport, 'direct-live');
  assert.equal(mixed.preventedRegression, false);
});

test('15.55 percent uses one shared half-up display value everywhere', () => {
  const guide = getReserveGuide(15.55, 2000, 'G');
  assert.equal(guide.displayRatePercent, 15.6);
  assert.equal(guide.displayDistanceFromStableLinePercent, 5.6);
  assert.equal(guide.displayPrecision, 1);
  assert.equal(guide.summary, '高於供電充裕門檻 5.6 個百分點');
  assert.equal(guide.distanceFromStableLinePercent, 5.55);
});

test('reserve display precision never rounds across a 6 or 10 percent boundary', () => {
  const band = (rate) => rate >= 10 ? 'G' : rate > 6 ? 'Y' : 'O';
  const cases = [
    [9.95, 9.95, -0.05, 2, '低於供電充裕門檻 0.05 個百分點'],
    [9.35, 9.4, -0.6, 1, '低於供電充裕門檻 0.6 個百分點'],
    [6.05, 6.1, -3.9, 1, '低於供電充裕門檻 3.9 個百分點'],
    [6.04, 6.04, -3.96, 2, '低於供電充裕門檻 3.96 個百分點'],
    [5.95, 6, -4, 1, '低於供電充裕門檻 4.0 個百分點']
  ];

  for (const [rate, displayedRate, displayedMargin, precision, summary] of cases) {
    const guide = getReserveGuide(rate, 2000, band(rate));
    assert.equal(guide.displayRatePercent, displayedRate, rate);
    assert.equal(guide.displayDistanceFromStableLinePercent, displayedMargin, rate);
    assert.equal(guide.displayPrecision, precision, rate);
    assert.equal(guide.summary, summary, rate);
  }

  for (let thousandths = 0; thousandths <= 20_000; thousandths += 1) {
    const rate = thousandths / 1000;
    const guide = getReserveGuide(rate, 2000, band(rate));
    assert.equal(band(guide.displayRatePercent), band(rate), rate);
    assert.equal(
      guide.displayDistanceFromStableLinePercent,
      Number((guide.displayRatePercent - 10).toFixed(guide.displayPrecision)),
      rate
    );
  }
});

test('exactly 10 percent uses boundary copy instead of zero-distance above copy', () => {
  const guide = getReserveGuide(10, 2000, 'G');
  assert.equal(guide.displayRatePercent, 10);
  assert.equal(guide.displayDistanceFromStableLinePercent, 0);
  assert.equal(guide.summary, '正好位於供電充裕門檻');
});
