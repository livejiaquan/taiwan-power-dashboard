import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDashboardModel,
  getReserveGuide,
  normalizeSupplyPayload,
  summarizeGenerationUnits
} from '../js/power-data.js';
import { buildSameOriginDataUrls, reviveModel } from '../js/api.js';
import { escapeHtml } from '../js/sanitize.js';
import { buildStaticDataPayload } from '../scripts/static-data.js';

const standbyGenerationRows = Array.from({ length: 100 }, (_, index) => ({
  '機組類型': '測試備援機組',
  '機組名稱': `測試備援#${index + 1}`,
  '裝置容量(MW)': '100.0',
  '淨發電量(MW)': '0.0',
  '淨發電量/裝置容量比(%)': '0.000%',
  '備註': ' '
}));

const supplyPayload = {
  success: 'true',
  records: [
    { curr_load: '377.06', curr_util_rate: '75' },
    {
      fore_maxi_sply_capacity: '4351.0',
      fore_peak_dema_load: '3350.0',
      fore_peak_resv_capacity: '1001.0',
      fore_peak_resv_rate: '29.88',
      fore_peak_resv_indicator: 'G',
      fore_peak_hour_range: '13:00-16:00',
      publish_time: '115.05.30(六)00:10'
    },
    {
      yday_date: '115.05.29',
      yday_peak_dema_load: '4143.1',
      yday_peak_resv_rate: '20.76',
      yday_peak_resv_indicator: 'G'
    },
    {
      real_hr_maxi_sply_capacity: '4093.6',
      real_hr_peak_time: '2026.05.29 20:00'
    }
  ]
};

const generationPayload = {
  DateTime: '2026-05-30T00:10:00',
  aaData: [
    {
      '機組類型': '燃氣',
      '機組名稱': '大潭CC#1',
      '裝置容量(MW)': '742.7',
      '淨發電量(MW)': '492.3',
      '淨發電量/裝置容量比(%)': '66.285%',
      '備註': ' '
    },
    {
      '機組類型': '燃氣',
      '機組名稱': '小計',
      '裝置容量(MW)': '742.7(40.000%)',
      '淨發電量(MW)': '492.3(52.000%)',
      '淨發電量/裝置容量比(%)': '',
      '備註': ''
    },
    {
      '機組類型': '太陽能',
      '機組名稱': '其它購電太陽能',
      '裝置容量(MW)': '14740.8',
      '淨發電量(MW)': '3300.0',
      '淨發電量/裝置容量比(%)': '22.388%',
      '備註': ' '
    },
    {
      '機組類型': '太陽能',
      '機組名稱': '小計',
      '裝置容量(MW)': '15095.1(24.482%)',
      '淨發電量(MW)': '3300.0(28.500%)',
      '淨發電量/裝置容量比(%)': '',
      '備註': ''
    },
    {
      '機組類型': '儲能負載(Energy Storage System Load)</b>',
      '機組名稱': '電池(註16)',
      '裝置容量(MW)': '-',
      '淨發電量(MW)': '-21.7',
      '淨發電量/裝置容量比(%)': '-',
      '備註': ' '
    },
    ...standbyGenerationRows
  ]
};

test('converts Taipower supply-demand values from 10 MW units to MW', () => {
  const supply = normalizeSupplyPayload(supplyPayload);

  assert.equal(supply.currentLoadMw, 3770.6);
  assert.equal(supply.forecastMaxSupplyCapacityMw, 43510);
  assert.equal(supply.forecastPeakDemandMw, 33500);
  assert.equal(supply.forecastReserveCapacityMw, 10010);
  assert.equal(supply.yesterdayPeakDemandMw, 41431);
  assert.equal(supply.realHourMaxSupplyCapacityMw, 40936);
  assert.equal(supply.currentUtilizationPercent, 75);
  assert.equal(supply.forecastReserveRatePercent, 29.88);
  assert.equal(supply.yesterdayReserveRatePercent, 20.76);
  assert.equal(supply.forecastReserveIndicator, 'G');
  assert.equal(supply.forecastPeakHourRange, '13:00-16:00');
  assert.equal(supply.publishTimeText, '115.05.30(六)00:10');
  assert.equal(supply.realHourPeakTimeText, '2026.05.29 20:00');
});

test('summarizes Taipower unit generation by fuel category and excludes subtotal rows', () => {
  const generation = summarizeGenerationUnits(generationPayload);

  assert.equal(generation.updatedAt, '2026-05-30T00:10:00');
  assert.equal(generation.units.length, 103);
  assert.equal(generation.totals.netGenerationMw, 3770.6);
  assert.equal(generation.categories[0].key, 'solar');
  assert.equal(generation.categories[0].netGenerationMw, 3300);
  assert.equal(generation.categories[1].key, 'gas');
  assert.equal(generation.categories[1].capacityMw, 742.7);
  assert.equal(generation.categories.find((item) => item.key === 'storage-load').netGenerationMw, -21.7);
});

test('builds dashboard model with health status, renewable share, and plant highlights', () => {
  const model = buildDashboardModel({ supplyPayload, generationPayload });

  assert.equal(model.health.level, 'stable');
  assert.equal(model.health.indicator, 'G');
  assert.equal(model.health.source, 'official-indicator');
  assert.equal(model.reserveGuide.level, 'stable');
  assert.equal(model.reserveGuide.distanceFromStableLinePercent, 19.88);
  assert.equal(model.reserveGuide.markerPercent, 100);
  assert.equal(model.reserveGuide.summary, '高於供電充裕門檻 19.9 個百分點');
  assert.equal(model.metrics.currentLoadMw, 3770.6);
  assert.equal(model.topUnits[0].name, '其它購電太陽能');
  assert.equal(model.categories[0].labelZh, '太陽能');
  assert.ok(model.updatedAt instanceof Date);
});

test('does not count storage charging as negative generation when calculating energy shares', () => {
  const model = buildDashboardModel({ supplyPayload, generationPayload });

  assert.equal(model.metrics.totalGenerationMw, 3770.6);
  assert.equal(model.metrics.renewableGenerationMw, 3300);
  assert.equal(model.metrics.renewableSharePercent, 87);
  assert.equal(model.metrics.lowCarbonSharePercent, 87);
});

test('maps reserve rate into readable threshold guidance', () => {
  const low = getReserveGuide(4.9);
  assert.equal(low.indicator, 'O');
  assert.equal(low.source, 'derived-fallback');
  assert.equal(low.level, 'caution');
  assert.equal(low.labelZh, '供電吃緊');
  assert.equal(low.markerPercent, 24.5);
  assert.equal(low.distanceFromStableLinePercent, -5.1);
  assert.equal(low.summary, '低於供電充裕門檻 5.1 個百分點');
  assert.deepEqual(low.ranges, [
    { label: '吃緊', start: 0, end: 6, color: '#ea580c' },
    { label: '稍緊', start: 6, end: 10, color: '#ca8a04' },
    { label: '充裕', start: 10, end: 20, color: '#059669' }
  ]);

  const stable = getReserveGuide(18.2);
  assert.equal(stable.level, 'stable');
  assert.equal(stable.markerPercent, 91);
  assert.equal(stable.summary, '高於供電充裕門檻 8.2 個百分點');
});

test('rejects cached models that predate trustworthy per-feed provenance', () => {
  const oldCachedModel = {
    fetchedAt: '2026-05-30T00:10:00.000Z',
    updatedAt: '2026-05-30T00:10:00.000Z',
    metrics: {
      forecastReserveRatePercent: 18.2
    }
  };

  assert.throws(
    () => reviveModel(oldCachedModel),
    /not an approved Taipower transport/
  );

  assert.throws(
    () => reviveModel({ ...oldCachedModel, source: 'taipower-static' }),
    /feeds\.supply\.observedAt is required/
  );
});

test('escapes API text before rendering HTML templates', () => {
  assert.equal(
    escapeHtml('<img src=x onerror=alert(1)> "台電" & \'測試\''),
    '&lt;img src=x onerror=alert(1)&gt; &quot;台電&quot; &amp; &#39;測試&#39;'
  );
});

test('uses only the static snapshot on GitHub Pages', () => {
  const originalLocation = globalThis.location;
  globalThis.location = { hostname: 'livejiaquan.github.io', protocol: 'https:' };

  try {
    assert.deepEqual(buildSameOriginDataUrls(false), ['api/power-data.json']);
    assert.deepEqual(buildSameOriginDataUrls(true), ['api/power-data.json?force=1']);
  } finally {
    globalThis.location = originalLocation;
  }
});

test('keeps the local Node proxy as a development fallback', () => {
  const originalLocation = globalThis.location;
  globalThis.location = { hostname: '127.0.0.1', protocol: 'http:' };

  try {
    assert.deepEqual(buildSameOriginDataUrls(false), ['api/power-data.json', '/api/power-data']);
    assert.deepEqual(buildSameOriginDataUrls(true), ['api/power-data.json?force=1', '/api/power-data?force=1']);
  } finally {
    globalThis.location = originalLocation;
  }
});

test('builds a static GitHub Pages payload from Taipower data', () => {
  const generatedAt = new Date('2026-05-30T00:15:00.000Z');
  const payload = buildStaticDataPayload({ supplyPayload, generationPayload, generatedAt });

  assert.equal(payload.model.source, 'taipower-static');
  assert.equal(payload.model.reserveGuide.level, 'stable');
  assert.equal(payload.generatedFor, 'github-pages');
  assert.equal(payload.sources.supply, 'https://service.taipower.com.tw/data/opendata/apply/file/d006020/001.json');
  assert.equal(payload.cache.hit, false);
  assert.equal(payload.cache.storedAt, generatedAt.toISOString());
});

test('can create an explicitly degraded demo payload for client rejection tests', () => {
  const payload = buildStaticDataPayload({
    supplyPayload,
    generationPayload,
    source: 'sample-static',
    degradedReason: 'Taipower timeout'
  });

  assert.equal(payload.model.source, 'sample-static');
  assert.equal(payload.degraded, true);
  assert.equal(payload.reason, 'Taipower timeout');
  assert.equal(payload.metadata.degraded, true);
  assert.equal(payload.metadata.reason, 'Taipower timeout');
});
