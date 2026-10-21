import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildCurvesPayload,
  FUEL_CURVE_KEYS,
  parseAreaCurveCsv,
  parseDailyReserveCsv,
  parseFuelCurveCsv,
  parseWeekForecastCsv,
  shiftDateKey,
  taipeiDateKey
} from '../js/power-curves.js';

const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('fuel curve skips padded future rows, converts 萬瓩 to MW and sums net load', async () => {
  const curve = parseFuelCurveCsv(await fixture('loadfueltype.csv'), { dateKey: '2026-10-21' });
  assert.equal(curve.points.length, 65);
  assert.equal(curve.points.at(-1).time, '10:40');
  assert.equal(curve.points[0].at, '2026-10-20T16:00:00.000Z');
  assert.deepEqual(Object.keys(curve.points[0].fuels), [...FUEL_CURVE_KEYS]);

  const sample = parseFuelCurveCsv(
    '10:40,1443.1,194.9,689.3,87.1,183.6,19.0,781.9,314.9,59.2,0.0,3.9,-84.2\n,\n',
    { dateKey: '2026-10-21' }
  ).points[0];
  assert.equal(sample.fuels.gas, 16380);
  assert.equal(sample.fuels.coal, 7764);
  assert.equal(sample.fuels['storage-load'], -842);
  // Matches the official curr_load of 3692.6 萬瓩 within rounding.
  assert.ok(Math.abs(sample.loadMw - 36926) <= 2);
});

test('fuel curve fails closed when Taipower changes the column layout', () => {
  const legacy = '00:00,1,2,3,4,5,6,7,8,9,10,11,12,13\n';
  assert.throws(() => parseFuelCurveCsv(legacy, { dateKey: '2026-10-21' }), /欄數 14 與預期 13 不符/);
  assert.throws(() => parseFuelCurveCsv('', { dateKey: '2026-10-21' }), /沒有任何資料列/);
  assert.throws(
    () => parseFuelCurveCsv('00:10,1,1,1,1,1,1,1,1,1,1,1,1\n00:00,1,1,1,1,1,1,1,1,1,1,1,1\n', { dateKey: '2026-10-21' }),
    /未依序遞增/
  );
  assert.throws(
    () => parseFuelCurveCsv('00:00,1500,N/A,1,1,1,1,1,1,1,1,1,1\n', { dateKey: '2026-10-21' }),
    /數值無效/
  );
});

test('area curve normalises whole-hour labels and strips the BOM', async () => {
  const curve = parseAreaCurveCsv(await fixture('loadareas.csv'), { dateKey: '2026-10-21' });
  assert.equal(curve.points[0].time, '00:00');
  assert.equal(curve.points[6].time, '01:00');
  assert.deepEqual(Object.keys(curve.points[0].areas), ['east', 'south', 'central', 'north']);
  assert.ok(curve.points[0].areas.north > 10000);
});

test('daily reserve history derives peak load from reserve and rate', async () => {
  const days = parseDailyReserveCsv(await fixture('d006002.csv'), { days: 7 });
  assert.equal(days.length, 7);
  assert.deepEqual(days.at(-1), {
    date: '2026-10-20',
    reserveMw: 7639,
    reserveRatePercent: 19.53,
    peakLoadMw: 39114
  });
});

test('week forecast parses capacity, peak, rate and reserve in MW', async () => {
  const days = parseWeekForecastCsv(await fixture('d006007.csv'));
  assert.equal(days[0].date, '2026-10-22');
  assert.equal(days[0].supplyCapacityMw, 45190);
  assert.equal(days[0].peakLoadMw, 37000);
  assert.equal(days[0].reserveRatePercent, 22.13);
  assert.equal(days[0].reserveMw, 8190);
});

test('Taipei date keys do not depend on the runner timezone', () => {
  assert.equal(taipeiDateKey(new Date('2026-10-20T16:30:00.000Z')), '2026-10-21');
  assert.equal(taipeiDateKey(new Date('2026-10-20T15:59:00.000Z')), '2026-10-20');
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
});

test('curves payload isolates failed sections instead of failing or inventing data', async () => {
  const payload = buildCurvesPayload({
    todayKey: '2026-10-21',
    generatedAt: new Date('2026-10-21T02:50:00.000Z'),
    texts: {
      today: await fixture('loadfueltype.csv'),
      yesterday: new Error('HTTP 403'),
      areas: 'garbage',
      recentDays: await fixture('d006002.csv'),
      forecast: await fixture('d006007.csv')
    }
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.today.points.length, 65);
  assert.equal(payload.yesterday, null);
  assert.equal(payload.errors.yesterday, 'HTTP 403');
  assert.equal(payload.areas, null);
  assert.match(payload.errors.areas, /沒有任何資料列/);
  assert.equal(payload.recentDays.length, 14);
  assert.equal(payload.forecast.length, 8);
});

test('curves payload rejects an intraday file dated ahead of the fetch', async () => {
  const payload = buildCurvesPayload({
    todayKey: '2026-10-21',
    generatedAt: new Date('2026-10-21T00:00:00.000Z'),
    texts: { today: await fixture('loadfueltype.csv') }
  });
  assert.equal(payload.today, null);
  assert.match(payload.errors.today, /晚於抓取時間/);
});

test('curve build records upstream failures per section and still writes a payload', async (t) => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { runCurveBuild } = await import('../scripts/build-curve-data.js');
  const { CURVE_ENDPOINTS } = await import('../js/power-curves.js');
  const directory = await mkdtemp(join(tmpdir(), 'curves-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const texts = {
    [CURVE_ENDPOINTS.fuelToday]: await fixture('loadfueltype.csv'),
    [CURVE_ENDPOINTS.dailyReserve]: await fixture('d006002.csv')
  };
  const requested = [];
  const { payload, outputPath } = await runCurveBuild({
    outputPath: join(directory, 'curves.json'),
    todayKey: '2026-10-21',
    now: () => new Date('2026-10-21T02:50:00.000Z'),
    attempts: 1,
    fetchImpl: async (url, init) => {
      requested.push(init.headers['User-Agent']);
      if (texts[url]) return { ok: true, status: 200, text: async () => texts[url] };
      return { ok: false, status: 403, text: async () => '' };
    }
  });

  assert.equal(requested.length, 5);
  assert.ok(requested.every((agent) => /Mozilla/.test(agent)));
  assert.equal(payload.today.points.length, 65);
  assert.equal(payload.yesterday, null);
  assert.equal(payload.errors.yesterday, 'HTTP 403');
  const onDisk = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(onDisk.todayKey, '2026-10-21');
});

test('client accepts only schema-valid curves with official provenance', async () => {
  const { validateCurvesPayload } = await import('../js/curves-api.js');
  const payload = buildCurvesPayload({
    todayKey: '2026-10-21',
    generatedAt: new Date('2026-10-21T02:50:00.000Z'),
    texts: { today: await fixture('loadfueltype.csv'), recentDays: await fixture('d006002.csv') }
  });
  const accepted = validateCurvesPayload(JSON.parse(JSON.stringify(payload)));
  assert.equal(accepted.today.points.length, 65);
  assert.equal(accepted.yesterday, null);
  assert.equal(accepted.recentDays.length, 14);

  assert.equal(validateCurvesPayload({ ...payload, schemaVersion: 2 }), null);
  assert.equal(validateCurvesPayload({ ...payload, sources: { ...payload.sources, today: 'https://example.com/x.csv' } }), null);
  assert.equal(validateCurvesPayload({ ...payload, today: { points: [{ time: '00:00', at: 'nope', fuels: {} }] } }).today, null);
});
