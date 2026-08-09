import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { sampleGenerationPayload, sampleSupplyPayload } from '../data/sample-power-data.js';
import {
  buildDashboardModel,
  GENERATION_ENDPOINT,
  getReserveGuide,
  getReserveHealth,
  normalizeSupplyPayload,
  parseTaipowerGenerationTime,
  parseTaipowerSupplyPublishTime,
  PowerDataValidationError,
  summarizeGenerationUnits,
  SUPPLY_ENDPOINT,
  validateFeedTimes
} from '../js/power-data.js';
import { assessDataFreshness } from '../js/data-freshness.js';
import { createFreshnessClock, DEFAULT_TICK_MS } from '../js/freshness-clock.js';
import {
  evaluateCachedModel,
  reviveModel,
  selectBestCandidate,
  validateSameOriginPayload
} from '../js/api.js';
import { runBuild } from '../scripts/build-static-data.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const SOURCE_INSTANT = new Date('2026-05-29T16:10:00.000Z');
const FETCH_INSTANT = new Date('2026-05-29T16:15:00.000Z');
const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const TRUSTED_STATIC_METADATA = {
  schemaVersion: 2,
  generatedFor: 'github-pages',
  sources: {
    supply: SUPPLY_ENDPOINT,
    generation: GENERATION_ENDPOINT
  }
};

function clone(value) {
  return structuredClone(value);
}

function mutateSupply(mutator) {
  const payload = clone(sampleSupplyPayload);
  mutator(payload);
  return payload;
}

function mutateGeneration(mutator) {
  const payload = clone(sampleGenerationPayload);
  mutator(payload);
  return payload;
}

function assertValidationError(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof PowerDataValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

function buildTrustedModel(source = 'taipower-static') {
  return buildDashboardModel({
    supplyPayload: clone(sampleSupplyPayload),
    generationPayload: clone(sampleGenerationPayload),
    fetchedAt: FETCH_INSTANT,
    source
  });
}

function buildFreshnessModel(now, supplyAgeMs, generationAgeMs) {
  return {
    feeds: {
      supply: { observedAt: new Date(now.getTime() - supplyAgeMs) },
      generation: { observedAt: new Date(now.getTime() - generationAgeMs) }
    }
  };
}

function buildOfficialFetch({
  supplyPayload = sampleSupplyPayload,
  generationPayload = sampleGenerationPayload
} = {}) {
  return async (url) => {
    const payload = url === SUPPLY_ENDPOINT
      ? supplyPayload
      : url === GENERATION_ENDPOINT
        ? generationPayload
        : null;

    if (!payload) {
      return { ok: false, status: 404, json: async () => ({}) };
    }

    return {
      ok: true,
      status: 200,
      json: async () => clone(payload)
    };
  };
}

async function makeTemporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'taiwan-power-dashboard-test-'));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('parses Taipower timestamps to the same instant under UTC and Asia/Taipei', () => {
  const childScript = `
    import {
      parseTaipowerGenerationTime,
      parseTaipowerSupplyPublishTime
    } from './js/power-data.js';
    process.stdout.write(JSON.stringify({
      supply: parseTaipowerSupplyPublishTime('115.05.30(六)00:10').toISOString(),
      generation: parseTaipowerGenerationTime('2026-05-30T00:10:00').toISOString()
    }));
  `;

  function parseInTimezone(timezone) {
    const child = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', childScript],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, TZ: timezone }
      }
    );

    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  }

  const expected = {
    supply: SOURCE_INSTANT.toISOString(),
    generation: SOURCE_INSTANT.toISOString()
  };

  assert.deepEqual(parseInTimezone('UTC'), expected);
  assert.deepEqual(parseInTimezone('Asia/Taipei'), expected);
});

test('timestamp parsers preserve explicit offsets and reject missing or impossible dates', () => {
  assert.equal(
    parseTaipowerGenerationTime('2026-05-30T00:10:00+08:00').toISOString(),
    SOURCE_INSTANT.toISOString()
  );
  assert.equal(
    parseTaipowerGenerationTime('2026-05-29T16:10:00Z').toISOString(),
    SOURCE_INSTANT.toISOString()
  );

  assertValidationError(() => parseTaipowerGenerationTime(''), 'missing_timestamp');
  assertValidationError(() => parseTaipowerGenerationTime('2026-02-30T00:10:00'), 'invalid_timestamp');
  assertValidationError(() => parseTaipowerSupplyPublishTime(null), 'missing_timestamp');
  assertValidationError(() => parseTaipowerSupplyPublishTime('115.02.29(六)00:10'), 'invalid_timestamp');
});

test('supply validation rejects malformed HTTP-200-shaped payloads instead of manufacturing zeroes', () => {
  const cases = [
    ['non-object', null, 'invalid_payload'],
    ['empty object', {}, 'upstream_failure'],
    ['upstream failure', { ...clone(sampleSupplyPayload), success: 'false' }, 'upstream_failure'],
    ['empty records', { success: 'true', records: [] }, 'empty_records'],
    [
      'missing current record',
      mutateSupply((payload) => delete payload.records[0].curr_load),
      'missing_record'
    ],
    [
      'unknown current load',
      mutateSupply((payload) => { payload.records[0].curr_load = 'N/A'; }),
      'invalid_number'
    ],
    [
      'HTML-tainted current load',
      mutateSupply((payload) => { payload.records[0].curr_load = '3089.1<script>'; }),
      'invalid_number'
    ],
    [
      'invalid official indicator',
      mutateSupply((payload) => { payload.records[1].fore_peak_resv_indicator = 'U'; }),
      'invalid_indicator'
    ],
    [
      'missing source timestamp',
      mutateSupply((payload) => delete payload.records[1].publish_time),
      'invalid_text'
    ],
    [
      'inconsistent reserve totals',
      mutateSupply((payload) => { payload.records[1].fore_peak_resv_capacity = '1.0'; }),
      'inconsistent_totals'
    ]
  ];

  for (const [name, payload, code] of cases) {
    assertValidationError(() => normalizeSupplyPayload(payload), code, name);
  }
});

test('generation validation rejects empty, malformed, and mostly unknown rows', () => {
  const mostlyUnknown = mutateGeneration((payload) => {
    payload.aaData.slice(0, 8).forEach((row) => {
      row['淨發電量(MW)'] = '-';
    });
  });

  const cases = [
    ['non-object', null, 'invalid_payload'],
    ['empty object', {}, 'empty_rows'],
    ['empty rows', { DateTime: '2026-05-30T00:10:00', aaData: [] }, 'empty_rows'],
    [
      'missing timestamp',
      mutateGeneration((payload) => delete payload.DateTime),
      'invalid_text'
    ],
    [
      'non-object row',
      { DateTime: '2026-05-30T00:10:00', aaData: [null] },
      'invalid_row'
    ],
    [
      'subtotal only',
      { DateTime: '2026-05-30T00:10:00', aaData: [{ '機組名稱': '小計' }] },
      'no_units'
    ],
    [
      'HTML-tainted numeric',
      mutateGeneration((payload) => { payload.aaData[0]['淨發電量(MW)'] = '883<script>'; }),
      'invalid_number'
    ],
    ['mostly unknown output', mostlyUnknown, 'incomplete_values'],
    [
      'truncated unit list',
      mutateGeneration((payload) => { payload.aaData = payload.aaData.slice(0, 50); }),
      'incomplete_units'
    ]
  ];

  for (const [name, payload, code] of cases) {
    assertValidationError(() => summarizeGenerationUnits(payload), code, name);
  }
});

test('unknown generation values remain null and charging does not distort positive shares', () => {
  const payload = mutateGeneration((candidate) => {
    const storageLoad = candidate.aaData.find((row) => String(row['機組類型']).includes('儲能負載'));
    storageLoad['淨發電量(MW)'] = '-';
    storageLoad['淨發電量/裝置容量比(%)'] = '-';
  });
  const generation = summarizeGenerationUnits(payload);
  const storageLoadUnit = generation.units.find((unit) => unit.categoryKey === 'storage-load');

  assert.equal(storageLoadUnit.capacityMw, null);
  assert.equal(storageLoadUnit.netGenerationMw, null);
  assert.equal(storageLoadUnit.utilizationPercent, null);

  const normalGeneration = summarizeGenerationUnits(sampleGenerationPayload);
  const storageLoadCategory = normalGeneration.categories.find((category) => category.key === 'storage-load');
  const shareTotal = normalGeneration.categories.reduce(
    (sum, category) => sum + (category.sharePercent ?? 0),
    0
  );

  assert.equal(storageLoadCategory.netGenerationMw, -21.7);
  assert.equal(storageLoadCategory.sharePercent, 0);
  assert.ok(Math.abs(shareTotal - 100) <= 0.2, `positive shares totalled ${shareTotal}`);
});

test('supply values use the official ten-MW unit conversion and retain percent units', () => {
  const payload = mutateSupply((candidate) => {
    candidate.records[0].curr_load = '3,089.1';
  });
  const supply = normalizeSupplyPayload(payload);

  assert.equal(supply.currentLoadMw, 30891);
  assert.equal(supply.forecastMaxSupplyCapacityMw, 43510);
  assert.equal(supply.forecastPeakDemandMw, 33500);
  assert.equal(supply.forecastReserveCapacityMw, 10010);
  assert.equal(supply.yesterdayPeakDemandMw, 41431);
  assert.equal(supply.realHourMaxSupplyCapacityMw, 40936);
  assert.equal(supply.currentUtilizationPercent, 75);
  assert.equal(supply.forecastReserveRatePercent, 29.88);
});

test('dashboard validation detects gross cross-feed magnitude errors', () => {
  const implausibleGeneration = mutateGeneration((payload) => {
    payload.aaData.forEach((row) => {
      row['淨發電量(MW)'] = '100';
    });
  });

  assertValidationError(
    () => buildDashboardModel({
      supplyPayload: sampleSupplyPayload,
      generationPayload: implausibleGeneration,
      fetchedAt: FETCH_INSTANT
    }),
    'inconsistent_feed_totals'
  );
});

test('official G/Y/O/R/B indicators take priority over locally derived rate semantics', () => {
  const cases = [
    ['G', 'stable', '供電充裕'],
    ['Y', 'watch', '供電稍緊'],
    ['O', 'caution', '供電吃緊'],
    ['R', 'alert', '供電警戒'],
    ['B', 'emergency', '限電警戒']
  ];

  for (const [indicator, level, labelZh] of cases) {
    const health = getReserveHealth(12, 1000, indicator);
    assert.equal(health.indicator, indicator);
    assert.equal(health.level, level);
    assert.equal(health.labelZh, labelZh);
    assert.equal(health.source, 'official-indicator');
  }

  const capacityAlert = getReserveGuide(12, 900, 'R');
  assert.equal(capacityAlert.level, 'alert');
  assert.equal(capacityAlert.summary, '備轉容量 900 MW，台電燈號為 R');

  const fifteenPercent = getReserveGuide(15, 2000, 'G');
  assert.equal(fifteenPercent.distanceFromStableLinePercent, 5);
  assert.match(fifteenPercent.summary, /供電充裕門檻/);
  assert.ok(fifteenPercent.ranges.every((range) => range.start !== 15));

  const roundingBoundary = getReserveGuide(15.55, 2000, 'G');
  assert.equal(roundingBoundary.displayRatePercent, 15.6);
  assert.equal(roundingBoundary.displayDistanceFromStableLinePercent, 5.6);
  assert.equal(roundingBoundary.summary, '高於供電充裕門檻 5.6 個百分點');

  assert.equal(getReserveHealth(10, null, null).indicator, 'G');
  assert.equal(getReserveHealth(6, null, null).indicator, 'O');
  assert.equal(getReserveHealth(12, 900, null).indicator, 'R');
  assert.equal(getReserveHealth(12, 500, null).indicator, 'B');
});

test('dashboard model preserves both source timestamps and uses the older one as summary time', () => {
  const generationPayload = mutateGeneration((payload) => {
    payload.DateTime = '2026-05-30T00:12:00';
  });
  const model = buildDashboardModel({
    supplyPayload: sampleSupplyPayload,
    generationPayload,
    fetchedAt: FETCH_INSTANT
  });

  assert.equal(model.feeds.supply.observedAt.toISOString(), '2026-05-29T16:10:00.000Z');
  assert.equal(model.feeds.generation.observedAt.toISOString(), '2026-05-29T16:12:00.000Z');
  assert.equal(model.feeds.supply.fetchedAt.toISOString(), FETCH_INSTANT.toISOString());
  assert.equal(model.feeds.generation.fetchedAt.toISOString(), FETCH_INSTANT.toISOString());
  assert.equal(model.updatedAt.toISOString(), '2026-05-29T16:10:00.000Z');
});

test('feed timestamp validation enforces the +2 minute and six-hour boundaries', () => {
  const fetchedAt = new Date('2026-08-09T12:00:00.000Z');

  assert.doesNotThrow(() => validateFeedTimes({
    supplyObservedAt: new Date(fetchedAt.getTime() + 2 * MINUTE_MS),
    generationObservedAt: fetchedAt,
    fetchedAt
  }));
  assertValidationError(() => validateFeedTimes({
    supplyObservedAt: new Date(fetchedAt.getTime() + 2 * MINUTE_MS + 1),
    generationObservedAt: fetchedAt,
    fetchedAt
  }), 'future_timestamp');

  assert.doesNotThrow(() => validateFeedTimes({
    supplyObservedAt: fetchedAt,
    generationObservedAt: new Date(fetchedAt.getTime() - 6 * HOUR_MS),
    fetchedAt
  }));
  assertValidationError(() => validateFeedTimes({
    supplyObservedAt: fetchedAt,
    generationObservedAt: new Date(fetchedAt.getTime() - 6 * HOUR_MS - 1),
    fetchedAt
  }), 'feed_time_skew');
});

test('freshness state machine implements exact 20-minute, 60-minute, 24-hour, and future boundaries', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');
  const cases = [
    ['exactly 20 minutes', 20 * MINUTE_MS, 'live', true],
    ['one millisecond over 20 minutes', 20 * MINUTE_MS + 1, 'delayed', true],
    ['exactly 60 minutes', 60 * MINUTE_MS, 'delayed', true],
    ['one millisecond over 60 minutes', 60 * MINUTE_MS + 1, 'stale', true],
    ['exactly 24 hours', 24 * HOUR_MS, 'stale', true],
    ['one millisecond over 24 hours', 24 * HOUR_MS + 1, 'unavailable', false],
    ['exactly two minutes in the future', -2 * MINUTE_MS, 'live', true],
    ['over two minutes in the future', -2 * MINUTE_MS - 1, 'unavailable', false]
  ];

  for (const [name, ageMs, state, usable] of cases) {
    const freshness = assessDataFreshness(buildFreshnessModel(now, ageMs, ageMs), { now });
    assert.equal(freshness.state, state, name);
    assert.equal(freshness.usable, usable, name);
  }
});

test('freshness uses the worse feed and handles partial data and Taiwan midnight correctly', () => {
  const now = new Date('2026-08-09T16:03:00.000Z');

  const delayed = assessDataFreshness(
    buildFreshnessModel(now, 10 * MINUTE_MS, 45 * MINUTE_MS),
    { now }
  );
  assert.equal(delayed.state, 'delayed');
  assert.equal(delayed.sources.supply.state, 'live');
  assert.equal(delayed.sources.generation.state, 'delayed');

  const stale = assessDataFreshness(
    buildFreshnessModel(now, 10 * MINUTE_MS, 70 * MINUTE_MS),
    { now }
  );
  assert.equal(stale.state, 'stale');
  assert.equal(stale.oldestObservedAt.toISOString(), '2026-08-09T14:53:00.000Z');

  const partial = assessDataFreshness({
    feeds: {
      supply: { observedAt: new Date(now.getTime() - 5 * MINUTE_MS) },
      generation: { observedAt: null }
    }
  }, { now });
  assert.equal(partial.state, 'unavailable');
  assert.equal(partial.usable, false);
  assert.equal(partial.sources.supply.state, 'live');
  assert.equal(partial.sources.generation.state, 'unavailable');

  const acrossTaiwanMidnight = assessDataFreshness({
    feeds: {
      supply: { observedAt: '2026-08-09T15:58:00.000Z' },
      generation: { observedAt: '2026-08-09T16:02:00.000Z' }
    }
  }, { now });
  assert.equal(acrossTaiwanMidnight.state, 'live');
});

test('freshness clock ages rendered data across live, delayed, stale, and unavailable boundaries', () => {
  const sourceTime = new Date('2026-08-09T12:00:00.000Z');
  let currentNow = new Date(sourceTime.getTime() + 20 * MINUTE_MS);
  const model = buildFreshnessModel(sourceTime, 0, 0);
  let currentResult = {
    model,
    freshness: assessDataFreshness(model, { now: currentNow })
  };
  let scheduledTick = null;
  let clearedId = null;
  const changes = [];
  const clock = createFreshnessClock({
    getResult: () => currentResult,
    onFreshnessChange: (freshness) => {
      changes.push(freshness.state);
      currentResult = { ...currentResult, freshness };
    },
    now: () => currentNow,
    setIntervalImpl: (callback, delay) => {
      assert.equal(delay, DEFAULT_TICK_MS);
      scheduledTick = callback;
      return 42;
    },
    clearIntervalImpl: (id) => { clearedId = id; }
  });

  clock.start();
  assert.equal(currentResult.freshness.state, 'live');

  currentNow = new Date(sourceTime.getTime() + 20 * MINUTE_MS + 1);
  scheduledTick();
  currentNow = new Date(sourceTime.getTime() + 60 * MINUTE_MS + 1);
  scheduledTick();
  currentNow = new Date(sourceTime.getTime() + 24 * HOUR_MS + 1);
  scheduledTick();

  assert.deepEqual(changes, ['delayed', 'stale', 'unavailable']);
  clock.stop();
  assert.equal(clearedId, 42);
});

test('cache receipt time cannot reset source freshness', () => {
  const model = buildTrustedModel();
  const staleNow = new Date(SOURCE_INSTANT.getTime() + 70 * MINUTE_MS);
  const justReceived = {
    timestamp: staleNow.getTime(),
    model: JSON.parse(JSON.stringify(model)),
    metadata: clone(TRUSTED_STATIC_METADATA)
  };

  const firstEvaluation = evaluateCachedModel(justReceived, { now: staleNow });
  assert.ok(firstEvaluation);
  assert.equal(firstEvaluation.receiptAgeMs, 0);
  assert.equal(firstEvaluation.freshness.state, 'stale');
  assert.equal(firstEvaluation.freshness.ageMinutes, 70);

  const oneMinuteLater = new Date(staleNow.getTime() + MINUTE_MS);
  const rewrittenReceipt = {
    ...justReceived,
    timestamp: oneMinuteLater.getTime()
  };
  const secondEvaluation = evaluateCachedModel(rewrittenReceipt, { now: oneMinuteLater });
  assert.ok(secondEvaluation);
  assert.equal(secondEvaluation.receiptAgeMs, 0);
  assert.equal(secondEvaluation.freshness.state, 'stale');
  assert.equal(secondEvaluation.freshness.ageMinutes, 71);
});

test('cache accepts exactly 24-hour source context but rejects older or future source data', () => {
  const model = buildTrustedModel();
  const exactly24Hours = new Date(SOURCE_INSTANT.getTime() + 24 * HOUR_MS);
  const baseCache = {
    timestamp: exactly24Hours.getTime(),
    model: JSON.parse(JSON.stringify(model)),
    metadata: clone(TRUSTED_STATIC_METADATA)
  };

  const accepted = evaluateCachedModel(baseCache, { now: exactly24Hours });
  assert.ok(accepted);
  assert.equal(accepted.freshness.state, 'stale');

  const tooOld = new Date(exactly24Hours.getTime() + 1);
  assert.equal(
    evaluateCachedModel({ ...baseCache, timestamp: tooOld.getTime() }, { now: tooOld }),
    null
  );

  const futureNow = new Date('2026-08-09T12:00:00.000Z');
  const futureModel = JSON.parse(JSON.stringify(model));
  futureModel.feeds.supply.observedAt = new Date(futureNow.getTime() + 2 * MINUTE_MS + 1).toISOString();
  futureModel.feeds.generation.observedAt = futureModel.feeds.supply.observedAt;
  assert.equal(evaluateCachedModel({
    timestamp: futureNow.getTime(),
    model: futureModel,
    metadata: clone(TRUSTED_STATIC_METADATA)
  }, { now: futureNow }), null);
});

test('reviveModel fails closed for missing provenance and sample sources', () => {
  const model = JSON.parse(JSON.stringify(buildTrustedModel()));

  const missingObservedAt = clone(model);
  delete missingObservedAt.feeds.supply.observedAt;
  assert.throws(() => reviveModel(missingObservedAt), /feeds\.supply\.observedAt is required/);

  const invalidObservedAt = clone(model);
  invalidObservedAt.feeds.generation.observedAt = 'not-a-date';
  assert.throws(() => reviveModel(invalidObservedAt), /must be a valid timestamp/);

  for (const source of ['sample', 'sample-static']) {
    const sampleModel = clone(model);
    sampleModel.source = source;
    assert.throws(
      () => reviveModel(sampleModel),
      /Sample data is not accepted by the production client/
    );
  }

  const unverified = clone(model);
  unverified.source = 'unverified-third-party';
  assert.throws(
    () => reviveModel(unverified),
    /not an approved Taipower transport/
  );
});

test('same-origin validation rejects degraded, sample, incomplete, future, and over-age snapshots', () => {
  const model = JSON.parse(JSON.stringify(buildTrustedModel()));
  const liveNow = new Date(SOURCE_INSTANT.getTime() + 10 * MINUTE_MS);
  const payload = {
    schemaVersion: 2,
    model,
    generatedFor: 'github-pages',
    sources: clone(TRUSTED_STATIC_METADATA.sources),
    metadata: {}
  };

  const valid = validateSameOriginPayload(payload, { now: liveNow });
  assert.equal(valid.transport, 'static-snapshot');
  assert.equal(valid.freshness.state, 'live');

  assert.throws(
    () => validateSameOriginPayload({ ...payload, metadata: { degraded: true } }, { now: liveNow }),
    /回傳降級資料/
  );

  assert.throws(
    () => validateSameOriginPayload({ ...payload, schemaVersion: 999 }, { now: liveNow }),
    /schemaVersion 不相容/
  );

  const unverifiedEndpoints = clone(payload);
  unverifiedEndpoints.sources.generation = 'https://example.com/unverified.json';
  assert.throws(
    () => validateSameOriginPayload(unverifiedEndpoints, { now: liveNow }),
    /官方 endpoint provenance/
  );

  const unverifiedSource = clone(payload);
  unverifiedSource.model.source = 'unverified-third-party';
  assert.throws(
    () => validateSameOriginPayload(unverifiedSource, { now: liveNow }),
    /source 與 transport provenance 不一致/
  );

  for (const source of ['sample', 'sample-static']) {
    const samplePayload = clone(payload);
    samplePayload.model.source = source;
    assert.throws(
      () => validateSameOriginPayload(samplePayload, { now: liveNow }),
      /Sample data is not accepted/
    );
  }

  const incomplete = clone(payload);
  delete incomplete.model.metrics.currentLoadMw;
  assert.throws(
    () => validateSameOriginPayload(incomplete, { now: liveNow }),
    /metrics\.currentLoadMw must be a finite number/
  );

  const future = clone(payload);
  const futureInstant = new Date(liveNow.getTime() + 2 * MINUTE_MS + 1).toISOString();
  future.model.feeds.supply.observedAt = futureInstant;
  future.model.feeds.generation.observedAt = futureInstant;
  assert.throws(
    () => validateSameOriginPayload(future, { now: liveNow }),
    /位於未來/
  );

  const stale = validateSameOriginPayload(payload, {
    now: new Date(SOURCE_INSTANT.getTime() + 70 * MINUTE_MS)
  });
  assert.equal(stale.freshness.state, 'stale');

  assert.throws(
    () => validateSameOriginPayload(payload, {
      now: new Date(SOURCE_INSTANT.getTime() + 24 * HOUR_MS + 1)
    }),
    /超過 24 小時/
  );
});

test('candidate selection prevents per-feed source-time regression', () => {
  const now = new Date(SOURCE_INSTANT.getTime() + 10 * MINUTE_MS);

  function makeCandidate(transport, supplyOffsetMs, generationOffsetMs) {
    const model = buildTrustedModel();
    model.feeds.supply.observedAt = new Date(SOURCE_INSTANT.getTime() + supplyOffsetMs);
    model.feeds.generation.observedAt = new Date(SOURCE_INSTANT.getTime() + generationOffsetMs);
    return {
      model,
      transport,
      metadata: clone(TRUSTED_STATIC_METADATA),
      freshness: assessDataFreshness(model, { now })
    };
  }

  const cachedResult = makeCandidate('browser-cache', 0, 0);
  const mixedRegression = makeCandidate('static-snapshot', -MINUTE_MS, MINUTE_MS);
  const blocked = selectBestCandidate({ cachedResult, fetchedCandidates: [mixedRegression] });
  assert.equal(blocked.candidate.transport, 'browser-cache');
  assert.equal(blocked.preventedRegression, true);

  const newerSnapshot = makeCandidate('static-snapshot', MINUTE_MS, MINUTE_MS);
  const advanced = selectBestCandidate({ cachedResult, fetchedCandidates: [newerSnapshot] });
  assert.equal(advanced.candidate.transport, 'static-snapshot');
  assert.equal(advanced.preventedRegression, false);
});

test('production builder writes a validated official snapshot with distinct observed and fetched times', async (t) => {
  const directory = await makeTemporaryDirectory(t);
  const outputPath = join(directory, 'api', 'power-data.json');

  const result = await runBuild({
    fetchImpl: buildOfficialFetch(),
    outputPath,
    now: () => new Date(FETCH_INSTANT),
    attempts: 1,
    retryDelayMs: 0
  });
  const onDisk = JSON.parse(await readFile(outputPath, 'utf8'));

  assert.equal(result.outputPath, resolve(outputPath));
  assert.equal(onDisk.schemaVersion, 2);
  assert.equal(onDisk.model.source, 'taipower-static');
  assert.equal(onDisk.model.feeds.supply.observedAt, SOURCE_INSTANT.toISOString());
  assert.equal(onDisk.model.feeds.generation.observedAt, SOURCE_INSTANT.toISOString());
  assert.equal(onDisk.model.feeds.supply.fetchedAt, FETCH_INSTANT.toISOString());
  assert.equal(onDisk.cache.storedAt, FETCH_INSTANT.toISOString());
  assert.equal(onDisk.degraded, undefined);
  assert.notEqual(onDisk.model.source, 'sample-static');
});

test('production builder failure or malformed HTTP 200 never overwrites last-known-good output', async (t) => {
  const directory = await makeTemporaryDirectory(t);
  const outputPath = join(directory, 'power-data.json');
  const sentinel = 'last-known-good\n';
  await writeFile(outputPath, sentinel);

  await assert.rejects(
    runBuild({
      fetchImpl: async () => { throw new Error('forced network failure'); },
      outputPath,
      now: () => FETCH_INSTANT,
      attempts: 1,
      retryDelayMs: 0
    }),
    /forced network failure/
  );
  assert.equal(await readFile(outputPath, 'utf8'), sentinel);

  await assert.rejects(
    runBuild({
      fetchImpl: buildOfficialFetch({ supplyPayload: {} }),
      outputPath,
      now: () => FETCH_INSTANT,
      attempts: 1,
      retryDelayMs: 0
    }),
    PowerDataValidationError
  );
  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});

test('production builder CLI exits non-zero and preserves output when official fetch fails', async (t) => {
  const directory = await makeTemporaryDirectory(t);
  const outputPath = join(directory, 'power-data.json');
  const preloadPath = join(directory, 'force-fetch-failure.mjs');
  const sentinel = 'last-known-good\n';

  await writeFile(outputPath, sentinel);
  await writeFile(
    preloadPath,
    `globalThis.fetch = async () => { throw new Error('forced CLI fetch failure'); };\n`
      + `globalThis.setTimeout = (callback) => { callback(); return 0; };\n`
  );

  const child = spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(preloadPath).href,
      resolve(REPO_ROOT, 'scripts/build-static-data.js'),
      '--out',
      outputPath
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 10_000
    }
  );

  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /previous deployment remains untouched/);
  assert.match(child.stderr, /forced CLI fetch failure/);
  assert.equal(await readFile(outputPath, 'utf8'), sentinel);
});
