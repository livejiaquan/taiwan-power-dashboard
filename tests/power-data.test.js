import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDashboardModel,
  normalizeSupplyPayload,
  summarizeGenerationUnits
} from '../js/power-data.js';

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
  assert.equal(model.metrics.currentLoadMw, 3089.1);
  assert.equal(model.metrics.renewableSharePercent, 87.5);
  assert.equal(model.topUnits[0].name, '其它購電太陽能');
  assert.equal(model.categories[0].labelZh, '太陽能');
  assert.ok(model.updatedAt instanceof Date);
});
