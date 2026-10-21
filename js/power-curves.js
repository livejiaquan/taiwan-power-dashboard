import { PowerDataValidationError } from './power-data.js';

// Official intraday files behind Taipower's "今日用電曲線" page. They are not
// part of the data.gov.tw API, so every parser here is strict and every section
// is optional: a broken curve never blocks the core snapshot.
const LOAD_GRAPH_BASE = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/data';
const OPENDATA_BASE = 'https://service.taipower.com.tw/data/opendata/apply/file';

export const CURVE_ENDPOINTS = Object.freeze({
  fuelToday: `${LOAD_GRAPH_BASE}/loadfueltype.csv`,
  fuelYesterday: `${LOAD_GRAPH_BASE}/loadfueltype_1.csv`,
  areaToday: `${LOAD_GRAPH_BASE}/loadareas.csv`,
  dailyReserve: `${OPENDATA_BASE}/d006002/001.csv`,
  weekForecast: `${OPENDATA_BASE}/d006007/001.csv`
});

// Column order of loadfueltype.csv (no header row), in 萬瓩. Private and
// Taipower-owned gas/coal are merged into the same categories as the unit feed.
export const FUEL_CURVE_COLUMNS = Object.freeze([
  'gas', 'gas', 'coal', 'coal', 'cogeneration', 'oil',
  'solar', 'wind', 'hydro', 'storage', 'other-renewable', 'storage-load'
]);
export const FUEL_CURVE_KEYS = Object.freeze([...new Set(FUEL_CURVE_COLUMNS)]);
export const AREA_KEYS = Object.freeze(['east', 'south', 'central', 'north']);

const TEN_THOUSAND_KW_TO_MW = 10;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_POINTS_PER_DAY = 145;

function fail(feed, code, message) {
  throw new PowerDataValidationError(feed, code, message);
}

export function taipeiDateKey(date) {
  const shifted = new Date(new Date(date).getTime() + TAIPEI_OFFSET_MS);
  if (Number.isNaN(shifted.getTime())) fail('curves', 'invalid_date', '日期無效');
  return shifted.toISOString().slice(0, 10);
}

export function shiftDateKey(dateKey, days) {
  const base = new Date(`${dateKey}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function taipeiInstant(dateKey, hour, minute) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - TAIPEI_OFFSET_MS);
}

function splitRows(text) {
  if (typeof text !== 'string') fail('curves', 'invalid_payload', 'CSV 內容不是文字');
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.replace(/^\uFEFF/, '').trim()));
}

function isBlank(cells) {
  return cells.every((cell) => cell === '');
}

function parseClock(value, feed) {
  // loadareas.csv writes whole hours as "00", "01"…; loadfueltype.csv as "00:00".
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(value);
  if (!match) fail(feed, 'invalid_time', `時間格式無效：${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) fail(feed, 'invalid_time', `時間超出範圍：${value}`);
  return { hour, minute, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

function parseValue(value, feed) {
  if (value === '' || !/^-?\d+(?:\.\d+)?$/.test(value)) fail(feed, 'invalid_value', `數值無效：${value}`);
  return Number(value);
}

function parseTimedRows(text, { dateKey, feed, valueCount }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) fail(feed, 'invalid_date', '缺少台北日期');
  const points = [];
  let previousMinutes = -1;

  for (const cells of splitRows(text)) {
    if (isBlank(cells)) continue;
    // Future slots are padded with "," rows; a time with no values is the same.
    if (cells.slice(1).every((cell) => cell === '')) continue;
    if (cells.length !== valueCount + 1) {
      fail(feed, 'unexpected_columns', `欄數 ${cells.length} 與預期 ${valueCount + 1} 不符，官方格式可能已變更`);
    }
    const clock = parseClock(cells[0], feed);
    const minutes = clock.hour * 60 + clock.minute;
    if (minutes <= previousMinutes) fail(feed, 'non_monotonic', '時間未依序遞增');
    previousMinutes = minutes;
    points.push({
      time: clock.label,
      at: taipeiInstant(dateKey, clock.hour, clock.minute).toISOString(),
      values: cells.slice(1).map((cell) => parseValue(cell, feed))
    });
  }

  if (points.length === 0) fail(feed, 'empty', '沒有任何資料列');
  if (points.length > MAX_POINTS_PER_DAY) fail(feed, 'too_many_rows', '資料列超過一天 10 分鐘解析度上限');
  return points;
}

const round1 = (value) => Math.round(value * 10) / 10;

export function parseFuelCurveCsv(text, { dateKey, feed = 'fuel-curve' }) {
  const points = parseTimedRows(text, { dateKey, feed, valueCount: FUEL_CURVE_COLUMNS.length });
  return {
    date: dateKey,
    unit: 'MW',
    keys: FUEL_CURVE_KEYS,
    points: points.map(({ time, at, values }) => {
      const fuels = Object.fromEntries(FUEL_CURVE_KEYS.map((key) => [key, 0]));
      values.forEach((value, index) => {
        fuels[FUEL_CURVE_COLUMNS[index]] += value * TEN_THOUSAND_KW_TO_MW;
      });
      for (const key of FUEL_CURVE_KEYS) fuels[key] = round1(fuels[key]);
      // Net load = all generation including storage charging (negative).
      const loadMw = round1(Object.values(fuels).reduce((sum, value) => sum + value, 0));
      if (loadMw < 1000 || loadMw > 80000) fail(feed, 'implausible_total', `${time} 總量 ${loadMw} MW 不在可信範圍`);
      return { time, at, loadMw, fuels };
    })
  };
}

export function parseAreaCurveCsv(text, { dateKey, feed = 'area-curve' }) {
  const points = parseTimedRows(text, { dateKey, feed, valueCount: AREA_KEYS.length });
  return {
    date: dateKey,
    unit: 'MW',
    keys: AREA_KEYS,
    points: points.map(({ time, at, values }) => ({
      time,
      at,
      areas: Object.fromEntries(AREA_KEYS.map((key, index) => [key, round1(values[index] * TEN_THOUSAND_KW_TO_MW)]))
    }))
  };
}

function parseDailyRows(text, { feed, valueCount }) {
  const rows = [];
  for (const cells of splitRows(text)) {
    if (isBlank(cells)) continue;
    if (!/^\d{8}$/.test(cells[0])) continue; // header row
    if (cells.length < valueCount + 1) fail(feed, 'unexpected_columns', '欄數不足，官方格式可能已變更');
    const date = `${cells[0].slice(0, 4)}-${cells[0].slice(4, 6)}-${cells[0].slice(6, 8)}`;
    rows.push({ date, values: cells.slice(1, valueCount + 1).map((cell) => parseValue(cell, feed)) });
  }
  if (rows.length === 0) fail(feed, 'empty', '沒有任何資料列');
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// d006002: 日期, 備轉容量(萬瓩), 備轉容量率(%). Peak load is implied by
// reserve ÷ rate, which matches Taipower's published yesterday peak.
export function parseDailyReserveCsv(text, { days = 14, feed = 'daily-reserve' } = {}) {
  return parseDailyRows(text, { feed, valueCount: 2 })
    .slice(-days)
    .map(({ date, values: [reserve, rate] }) => ({
      date,
      reserveMw: round1(reserve * TEN_THOUSAND_KW_TO_MW),
      reserveRatePercent: rate,
      peakLoadMw: rate > 0 ? Math.round((reserve * TEN_THOUSAND_KW_TO_MW * 100) / rate) : null
    }));
}

// d006007: 日期, 預估淨尖峰供電能力, 預估瞬時尖峰負載, 預估尖峰備轉容量率(%), 預估尖峰備轉容量.
export function parseWeekForecastCsv(text, { feed = 'week-forecast' } = {}) {
  return parseDailyRows(text, { feed, valueCount: 4 })
    .slice(0, 8)
    .map(({ date, values: [capacity, peak, rate, reserve] }) => ({
      date,
      supplyCapacityMw: round1(capacity * TEN_THOUSAND_KW_TO_MW),
      peakLoadMw: round1(peak * TEN_THOUSAND_KW_TO_MW),
      reserveRatePercent: rate,
      reserveMw: round1(reserve * TEN_THOUSAND_KW_TO_MW)
    }));
}

const SECTION_PARSERS = {
  today: (text, { todayKey }) => parseFuelCurveCsv(text, { dateKey: todayKey, feed: 'fuel-today' }),
  yesterday: (text, { todayKey }) => parseFuelCurveCsv(text, { dateKey: shiftDateKey(todayKey, -1), feed: 'fuel-yesterday' }),
  areas: (text, { todayKey }) => parseAreaCurveCsv(text, { dateKey: todayKey }),
  recentDays: (text) => parseDailyReserveCsv(text),
  forecast: (text) => parseWeekForecastCsv(text)
};

export const SECTION_ENDPOINTS = Object.freeze({
  today: CURVE_ENDPOINTS.fuelToday,
  yesterday: CURVE_ENDPOINTS.fuelYesterday,
  areas: CURVE_ENDPOINTS.areaToday,
  recentDays: CURVE_ENDPOINTS.dailyReserve,
  forecast: CURVE_ENDPOINTS.weekForecast
});

// Each section succeeds or fails on its own; failures are recorded, never
// replaced with sample data.
export function buildCurvesPayload({ texts, todayKey, generatedAt = new Date() }) {
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date(generatedAt).toISOString(),
    todayKey,
    unit: 'MW',
    sources: SECTION_ENDPOINTS,
    errors: {}
  };

  for (const [section, parse] of Object.entries(SECTION_PARSERS)) {
    const text = texts?.[section];
    if (text instanceof Error || typeof text !== 'string') {
      payload[section] = null;
      payload.errors[section] = text instanceof Error ? text.message : '未取得資料';
      continue;
    }
    try {
      payload[section] = parse(text, { todayKey });
    } catch (error) {
      payload[section] = null;
      payload.errors[section] = error.message;
    }
  }

  // The intraday file is "today" only if its last point is not in the future.
  const lastToday = payload.today?.points.at(-1);
  if (lastToday && new Date(lastToday.at).getTime() > new Date(generatedAt).getTime() + 15 * 60 * 1000) {
    payload.errors.today = '今日曲線最後一筆晚於抓取時間，日期可能不一致';
    payload.today = null;
  }

  return payload;
}
