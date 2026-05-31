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

const supplyPayload = {
  success: 'true',
  records: [
    { curr_load: '3089.1', curr_util_rate: '75' },
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
    }
  ]
};

test('normalizes Taipower supply-demand records into MW and MWh-facing fields', () => {
  const supply = normalizeSupplyPayload(supplyPayload);

  assert.equal(supply.currentLoadMw, 3089.1);
  assert.equal(supply.currentUtilizationPercent, 75);
  assert.equal(supply.forecastReserveRatePercent, 29.88);
  assert.equal(supply.forecastReserveIndicator, 'G');
  assert.equal(supply.forecastPeakHourRange, '13:00-16:00');
  assert.equal(supply.publishTimeText, '115.05.30(六)00:10');
  assert.equal(supply.realHourPeakTimeText, '2026.05.29 20:00');
});

test('summarizes Taipower unit generation by fuel category and excludes subtotal rows', () => {
  const generation = summarizeGenerationUnits(generationPayload);

  assert.equal(generation.updatedAt, '2026-05-30T00:10:00');
  assert.equal(generation.units.length, 3);
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
  assert.equal(model.reserveGuide.level, 'stable');
  assert.equal(model.reserveGuide.distanceFromStableLinePercent, 14.88);
  assert.equal(model.reserveGuide.markerPercent, 99.6);
  assert.equal(model.reserveGuide.summary, '高於供電充裕線 14.9 個百分點');
  assert.equal(model.metrics.currentLoadMw, 3089.1);
  assert.equal(model.metrics.renewableSharePercent, 87.5);
  assert.equal(model.topUnits[0].name, '其它購電太陽能');
  assert.equal(model.categories[0].labelZh, '太陽能');
  assert.ok(model.updatedAt instanceof Date);
});

test('maps reserve rate into readable threshold guidance', () => {
  assert.deepEqual(
    getReserveGuide(4.9),
    {
      level: 'alert',
      labelZh: '供電警戒',
      markerPercent: 16.33,
      distanceFromStableLinePercent: -10.1,
      summary: '低於供電充裕線 10.1 個百分點',
      description: '備轉容量已低於 6%，需留意官方供電警訊。',
      ranges: [
        { label: '警戒', start: 0, end: 6, color: '#dc2626' },
        { label: '吃緊', start: 6, end: 10, color: '#ea580c' },
        { label: '偏緊', start: 10, end: 15, color: '#d97706' },
        { label: '充裕', start: 15, end: 30, color: '#059669' }
      ]
    }
  );

  const stable = getReserveGuide(18.2);
  assert.equal(stable.level, 'stable');
  assert.equal(stable.markerPercent, 60.67);
  assert.equal(stable.summary, '高於供電充裕線 3.2 個百分點');
});

test('revives cached models created before reserve guide existed', () => {
  const oldCachedModel = {
    fetchedAt: '2026-05-30T00:10:00.000Z',
    updatedAt: '2026-05-30T00:10:00.000Z',
    metrics: {
      forecastReserveRatePercent: 18.2
    }
  };

  const revived = reviveModel(oldCachedModel);

  assert.equal(revived.reserveGuide.level, 'stable');
  assert.equal(revived.reserveGuide.summary, '高於供電充裕線 3.2 個百分點');
  assert.ok(revived.fetchedAt instanceof Date);
  assert.ok(revived.updatedAt instanceof Date);
});

test('escapes API text before rendering HTML templates', () => {
  assert.equal(
    escapeHtml('<img src=x onerror=alert(1)> "台電" & \'測試\''),
    '&lt;img src=x onerror=alert(1)&gt; &quot;台電&quot; &amp; &#39;測試&#39;'
  );
});

test('tries GitHub Pages static data before the local Node proxy', () => {
  assert.deepEqual(buildSameOriginDataUrls(false), ['api/power-data.json', '/api/power-data']);
  assert.deepEqual(buildSameOriginDataUrls(true), ['api/power-data.json?force=1', '/api/power-data?force=1']);
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

test('marks static payloads as degraded when generated from fallback data', () => {
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
