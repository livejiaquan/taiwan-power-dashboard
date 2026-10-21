import { readFileSync } from 'node:fs';

import { sampleGenerationPayload, sampleSupplyPayload } from '../../data/sample-power-data.js';
import { buildCurvesPayload } from '../../js/power-curves.js';
import { buildStaticDataPayload } from '../../scripts/static-data.js';

// Sample feeds are observed at 2026-05-30 00:10 Asia/Taipei.
export const SOURCE_TIME = new Date('2026-05-29T16:10:00.000Z');
export const minutesAfterSource = (minutes) => new Date(SOURCE_TIME.getTime() + minutes * 60 * 1000);

export function powerPayload() {
  return buildStaticDataPayload({
    supplyPayload: sampleSupplyPayload,
    generationPayload: sampleGenerationPayload,
    generatedAt: minutesAfterSource(2)
  });
}

const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

export function curvesPayload() {
  // Only the 00:00 and 00:10 rows exist at the sample's source time.
  const today = fixture('loadfueltype.csv').split(/\r?\n/).slice(0, 2).join('\n');
  const areas = fixture('loadareas.csv').split('\n').slice(0, 2).join('\n');
  const forecast = [
    '日期,預估淨尖峰供電能力(萬瓩),預估瞬時尖峰負載(萬瓩),預估尖峰備轉容量率(%),預估尖峰備轉容量(萬瓩)',
    ...['20260531', '20260601', '20260602', '20260603', '20260604', '20260605', '20260606']
      .map((date, index) => `${date},4519,${3700 + index * 40},${(22.1 - index * 1.6).toFixed(2)},${819 - index * 60}`)
  ].join('\n');
  return buildCurvesPayload({
    todayKey: '2026-05-30',
    generatedAt: minutesAfterSource(2),
    texts: {
      today,
      yesterday: fixture('loadfueltype_1.csv'),
      areas,
      recentDays: fixture('d006002.csv').replaceAll('202610', '202605'),
      forecast
    }
  });
}

export async function mockData(page, { power = powerPayload(), curves = curvesPayload(), now } = {}) {
  if (now) await page.clock.install({ time: now });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.route('**/api/power-data.json*', (route) => route.fulfill({ json: power }));
  await page.route('**/api/curves.json*', (route) => (curves
    ? route.fulfill({ json: curves })
    : route.fulfill({ status: 404, body: '' })));
}
