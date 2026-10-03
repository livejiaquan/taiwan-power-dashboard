export const SUPPLY_ENDPOINT = 'https://service.taipower.com.tw/data/opendata/apply/file/d006020/001.json';
export const GENERATION_ENDPOINT = 'https://service.taipower.com.tw/data/opendata/apply/file/d006001/001.json';

const SUPPLY_VALUE_TO_MW = 10;

const CATEGORY_META = {
  gas: {
    labelZh: '燃氣',
    labelEn: 'Gas',
    icon: 'bi-fire',
    color: '#0ea5e9',
    renewable: false,
    lowCarbon: false
  },
  coal: {
    labelZh: '燃煤',
    labelEn: 'Coal',
    icon: 'bi-minecart-loaded',
    color: '#64748b',
    renewable: false,
    lowCarbon: false
  },
  solar: {
    labelZh: '太陽能',
    labelEn: 'Solar',
    icon: 'bi-sun-fill',
    color: '#f59e0b',
    renewable: true,
    lowCarbon: true
  },
  wind: {
    labelZh: '風力',
    labelEn: 'Wind',
    icon: 'bi-wind',
    color: '#22c55e',
    renewable: true,
    lowCarbon: true
  },
  hydro: {
    labelZh: '水力',
    labelEn: 'Hydro',
    icon: 'bi-droplet-fill',
    color: '#2563eb',
    renewable: true,
    lowCarbon: true
  },
  nuclear: {
    labelZh: '核能',
    labelEn: 'Nuclear',
    icon: 'bi-radioactive',
    color: '#8b5cf6',
    renewable: false,
    lowCarbon: true
  },
  oil: {
    labelZh: '燃油',
    labelEn: 'Oil',
    icon: 'bi-fuel-pump-fill',
    color: '#dc2626',
    renewable: false,
    lowCarbon: false
  },
  cogeneration: {
    labelZh: '汽電共生',
    labelEn: 'Cogeneration',
    icon: 'bi-building-gear',
    color: '#14b8a6',
    renewable: false,
    lowCarbon: false
  },
  storage: {
    labelZh: '儲能放電',
    labelEn: 'Storage output',
    icon: 'bi-battery-charging',
    color: '#10b981',
    renewable: false,
    lowCarbon: true
  },
  'storage-load': {
    labelZh: '儲能充電負載',
    labelEn: 'Storage load',
    icon: 'bi-battery',
    color: '#94a3b8',
    renewable: false,
    lowCarbon: true
  },
  'other-renewable': {
    labelZh: '其它再生能源',
    labelEn: 'Other renewables',
    icon: 'bi-flower1',
    color: '#059669',
    renewable: true,
    lowCarbon: true
  },
  other: {
    labelZh: '其它',
    labelEn: 'Other',
    icon: 'bi-lightning-charge-fill',
    color: '#475569',
    renewable: false,
    lowCarbon: false
  }
};

const OFFICIAL_RESERVE_INDICATORS = new Set(['G', 'Y', 'O', 'R', 'B']);
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;
const MAX_FEED_OBSERVED_AT_SKEW_MS = 6 * 60 * 60 * 1000;
const MIN_GENERATION_UNIT_COUNT = 100;
const MIN_KNOWN_GENERATION_COVERAGE = 0.98;
const MIN_GENERATION_TO_LOAD_RATIO = 0.9;
const MAX_GENERATION_TO_LOAD_RATIO = 1.1;

const RESERVE_STATUS_BY_INDICATOR = {
  G: {
    indicator: 'G',
    level: 'stable',
    labelZh: '供電充裕',
    labelEn: 'Stable',
    color: '#059669',
    icon: 'bi-check-circle-fill',
    criterion: '備轉容量率 10% 以上'
  },
  Y: {
    indicator: 'Y',
    level: 'watch',
    labelZh: '供電稍緊',
    labelEn: 'Watch',
    color: '#ca8a04',
    icon: 'bi-activity',
    criterion: '備轉容量率高於 6%、未滿 10%'
  },
  O: {
    indicator: 'O',
    level: 'caution',
    labelZh: '供電吃緊',
    labelEn: 'Caution',
    color: '#ea580c',
    icon: 'bi-exclamation-triangle-fill',
    criterion: '備轉容量率 6% 以下'
  },
  R: {
    indicator: 'R',
    level: 'alert',
    labelZh: '供電警戒',
    labelEn: 'Alert',
    color: '#dc2626',
    icon: 'bi-exclamation-octagon-fill',
    criterion: '備轉容量 900 MW 以下'
  },
  B: {
    indicator: 'B',
    level: 'emergency',
    labelZh: '限電警戒',
    labelEn: 'Emergency',
    color: '#1f2937',
    icon: 'bi-exclamation-diamond-fill',
    criterion: '備轉容量 500 MW 以下'
  }
};

const RESERVE_STATUS = Object.values(RESERVE_STATUS_BY_INDICATOR);

const RESERVE_RANGES = [
  { label: '吃緊', start: 0, end: 6, color: '#ea580c' },
  { label: '稍緊', start: 6, end: 10, color: '#ca8a04' },
  { label: '充裕', start: 10, end: 20, color: '#059669' }
];

const UNKNOWN_HEALTH = {
  indicator: null,
  level: 'unavailable',
  labelZh: '目前無法確認',
  labelEn: 'Unavailable',
  color: '#64748b',
  icon: 'bi-question-circle-fill',
  criterion: '缺少可信的台電燈號'
};

export class PowerDataValidationError extends Error {
  constructor(feed, code, message) {
    super(`${feed}: ${message}`);
    this.name = 'PowerDataValidationError';
    this.feed = feed;
    this.code = code;
  }
}

function validationError(feed, code, message) {
  throw new PowerDataValidationError(feed, code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidCalendarDate(year, month, day) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function buildTaipeiDate(year, month, day, hour, minute, second, feed, field) {
  if (!isValidCalendarDate(year, month, day)
      || hour < 0 || hour > 23
      || minute < 0 || minute > 59
      || second < 0 || second > 59) {
    validationError(feed, 'invalid_timestamp', `${field} 不是有效的台灣日期時間`);
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    + `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+08:00`;
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) {
    validationError(feed, 'invalid_timestamp', `${field} 無法解析`);
  }
  return parsed;
}

export function parseTaipowerGenerationTime(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    validationError('generation', 'missing_timestamp', 'DateTime 缺失');
  }

  const taipeiMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (taipeiMatch) {
    const [, year, month, day, hour, minute, second = '0'] = taipeiMatch;
    return buildTaipeiDate(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      'generation',
      'DateTime'
    );
  }

  const offsetMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-](\d{2}):?(\d{2}))$/i
  );
  if (!offsetMatch) {
    validationError('generation', 'invalid_timestamp', 'DateTime 格式無效');
  }

  const [, year, month, day, hour, minute, second = '0', zone, offsetHour, offsetMinute] = offsetMatch;
  if (!isValidCalendarDate(Number(year), Number(month), Number(day))
      || Number(hour) > 23
      || Number(minute) > 59
      || Number(second) > 59
      || (zone.toUpperCase() !== 'Z' && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))) {
    validationError('generation', 'invalid_timestamp', 'DateTime 不是有效日期時間');
  }

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) {
    validationError('generation', 'invalid_timestamp', 'DateTime 無法解析');
  }
  return parsed;
}

export function parseTaipowerSupplyPublishTime(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    validationError('supply', 'missing_timestamp', 'publish_time 缺失');
  }

  const match = text.match(/^(\d{2,3})[./-](\d{1,2})[./-](\d{1,2})(?:\([^)]*\))?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    validationError('supply', 'invalid_timestamp', 'publish_time 格式無效');
  }

  const [, rocYear, month, day, hour, minute, second = '0'] = match;
  if (Number(rocYear) < 1) {
    validationError('supply', 'invalid_timestamp', 'publish_time 民國年無效');
  }
  return buildTaipeiDate(
    Number(rocYear) + 1911,
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    'supply',
    'publish_time'
  );
}

export function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).replaceAll(',', '').trim();
  if (!normalized || normalized === '-' || /^N\/A$/i.test(normalized)) {
    return null;
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*%)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized.replace(/\s*%$/, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function round(value, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function requireNumber(value, { feed, field, min = -Infinity, max = Infinity, allowUnknown = false }) {
  const parsed = parseNumber(value);
  if (parsed === null) {
    if (allowUnknown && (String(value).trim() === '-' || /^N\/A$/i.test(String(value).trim()))) {
      return null;
    }
    validationError(feed, 'invalid_number', `${field} 缺失或不是有效數值`);
  }
  if (parsed < min || parsed > max) {
    validationError(feed, 'implausible_value', `${field} 超出可信範圍`);
  }
  return parsed;
}

function requireString(value, { feed, field, pattern = null }) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || (pattern && !pattern.test(text))) {
    validationError(feed, 'invalid_text', `${field} 缺失或格式無效`);
  }
  return text;
}

function parseSupplyMw(value, field, min = 0) {
  return round(requireNumber(value, {
    feed: 'supply',
    field,
    min: min / SUPPLY_VALUE_TO_MW,
    max: 100000 / SUPPLY_VALUE_TO_MW
  }) * SUPPLY_VALUE_TO_MW, 1);
}

export function normalizeFuelType(type) {
  const cleanType = String(type || '').replace(/<[^>]+>/g, '').trim();

  if (cleanType.includes('儲能負載') || cleanType.includes('Energy Storage System Load')) return 'storage-load';
  if (cleanType.includes('民營電廠-燃氣') || cleanType === '燃氣') return 'gas';
  if (cleanType.includes('民營電廠-燃煤') || cleanType === '燃煤') return 'coal';
  if (cleanType.includes('太陽能')) return 'solar';
  if (cleanType.includes('風力')) return 'wind';
  if (cleanType.includes('水力')) return 'hydro';
  if (cleanType.includes('核能')) return 'nuclear';
  if (cleanType.includes('燃料油') || cleanType.includes('燃油') || cleanType.includes('輕油')) return 'oil';
  if (cleanType.includes('汽電共生')) return 'cogeneration';
  if (cleanType.includes('其它再生能源') || cleanType.includes('地熱') || cleanType.includes('生質')) return 'other-renewable';
  if (cleanType.includes('儲能')) return 'storage';

  return 'other';
}

export function getCategoryMeta(key) {
  return CATEGORY_META[key] || CATEGORY_META.other;
}

function findRequiredRecord(records, field, label) {
  const record = records.find((candidate) => isPlainObject(candidate) && candidate[field] !== undefined);
  if (!record) {
    validationError('supply', 'missing_record', `${label} record 缺失`);
  }
  return record;
}

function requireIndicator(value, field) {
  const indicator = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!OFFICIAL_RESERVE_INDICATORS.has(indicator)) {
    validationError('supply', 'invalid_indicator', `${field} 必須是 G/Y/O/R/B`);
  }
  return indicator;
}

function validatePeakHourRange(value) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59
      || Number(match[3]) > 23 || Number(match[4]) > 59) {
    validationError('supply', 'invalid_text', 'fore_peak_hour_range 不是有效時段');
  }
}

function validateRocDate(value, field) {
  const match = value.match(/^(\d{2,3})[.-](\d{1,2})[.-](\d{1,2})$/);
  if (!match
      || Number(match[1]) < 1
      || !isValidCalendarDate(Number(match[1]) + 1911, Number(match[2]), Number(match[3]))) {
    validationError('supply', 'invalid_text', `${field} 不是有效日期`);
  }
}

function validateGregorianMinute(value, field) {
  const match = value.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (!match
      || !isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
      || Number(match[4]) > 23
      || Number(match[5]) > 59) {
    validationError('supply', 'invalid_text', `${field} 不是有效日期時間`);
  }
}

export function normalizeSupplyPayload(payload) {
  if (!isPlainObject(payload)) {
    validationError('supply', 'invalid_payload', 'payload 必須是 JSON object');
  }
  if (String(payload.success).toLowerCase() !== 'true') {
    validationError('supply', 'upstream_failure', 'success 未顯示成功');
  }
  if (!Array.isArray(payload.records) || payload.records.length === 0) {
    validationError('supply', 'empty_records', 'records 不得為空');
  }

  const current = findRequiredRecord(payload.records, 'curr_load', '目前負載');
  const forecast = findRequiredRecord(payload.records, 'fore_peak_resv_rate', '今日預測');
  const yesterday = findRequiredRecord(payload.records, 'yday_peak_resv_rate', '昨日尖峰');
  const realtimePeak = findRequiredRecord(payload.records, 'real_hr_peak_time', '實際尖峰');

  const currentLoadMw = parseSupplyMw(current.curr_load, 'curr_load', 1000);
  const currentUtilizationPercent = requireNumber(current.curr_util_rate, {
    feed: 'supply',
    field: 'curr_util_rate',
    min: 0,
    max: 150
  });
  const forecastMaxSupplyCapacityMw = parseSupplyMw(
    forecast.fore_maxi_sply_capacity,
    'fore_maxi_sply_capacity',
    1000
  );
  const forecastPeakDemandMw = parseSupplyMw(forecast.fore_peak_dema_load, 'fore_peak_dema_load', 1000);
  const forecastReserveCapacityMw = parseSupplyMw(forecast.fore_peak_resv_capacity, 'fore_peak_resv_capacity');
  const forecastReserveRatePercent = requireNumber(forecast.fore_peak_resv_rate, {
    feed: 'supply',
    field: 'fore_peak_resv_rate',
    min: 0,
    max: 100
  });
  const forecastReserveIndicator = requireIndicator(
    forecast.fore_peak_resv_indicator,
    'fore_peak_resv_indicator'
  );
  const forecastPeakHourRange = requireString(forecast.fore_peak_hour_range, {
    feed: 'supply',
    field: 'fore_peak_hour_range',
    pattern: /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/
  });
  validatePeakHourRange(forecastPeakHourRange);
  const publishTimeText = requireString(forecast.publish_time, {
    feed: 'supply',
    field: 'publish_time'
  });
  const observedAt = parseTaipowerSupplyPublishTime(publishTimeText);

  const reserveDifferenceMw = forecastMaxSupplyCapacityMw - forecastPeakDemandMw;
  const reserveDifferenceToleranceMw = Math.max(100, forecastMaxSupplyCapacityMw * 0.02);
  if (Math.abs(reserveDifferenceMw - forecastReserveCapacityMw) > reserveDifferenceToleranceMw) {
    validationError('supply', 'inconsistent_totals', '預測最大供電、尖峰需求與備轉容量無法對上');
  }

  const calculatedReserveRate = (forecastReserveCapacityMw / forecastPeakDemandMw) * 100;
  if (Math.abs(calculatedReserveRate - forecastReserveRatePercent) > 2) {
    validationError('supply', 'inconsistent_rate', '備轉容量率與容量／需求無法對上');
  }

  const yesterdayDateText = requireString(yesterday.yday_date, {
    feed: 'supply',
    field: 'yday_date',
    pattern: /^\d{2,3}[.-]\d{1,2}[.-]\d{1,2}$/
  });
  validateRocDate(yesterdayDateText, 'yday_date');
  const yesterdayPeakDemandMw = parseSupplyMw(yesterday.yday_peak_dema_load, 'yday_peak_dema_load', 1000);
  const yesterdayReserveRatePercent = requireNumber(yesterday.yday_peak_resv_rate, {
    feed: 'supply',
    field: 'yday_peak_resv_rate',
    min: 0,
    max: 100
  });
  const yesterdayReserveIndicator = requireIndicator(
    yesterday.yday_peak_resv_indicator,
    'yday_peak_resv_indicator'
  );
  const realHourMaxSupplyCapacityMw = parseSupplyMw(
    realtimePeak.real_hr_maxi_sply_capacity,
    'real_hr_maxi_sply_capacity',
    1000
  );
  const realHourPeakTimeText = requireString(realtimePeak.real_hr_peak_time, {
    feed: 'supply',
    field: 'real_hr_peak_time',
    pattern: /^\d{4}[.-]\d{1,2}[.-]\d{1,2}\s+\d{1,2}:\d{2}$/
  });
  validateGregorianMinute(realHourPeakTimeText, 'real_hr_peak_time');

  return {
    observedAt,
    currentLoadMw,
    currentUtilizationPercent,
    forecastMaxSupplyCapacityMw,
    forecastPeakDemandMw,
    forecastReserveCapacityMw,
    forecastReserveRatePercent,
    forecastReserveIndicator,
    forecastPeakHourRange,
    publishTimeText,
    yesterdayDateText,
    yesterdayPeakDemandMw,
    yesterdayReserveRatePercent,
    yesterdayReserveIndicator,
    realHourMaxSupplyCapacityMw,
    realHourPeakTimeText
  };
}

export function summarizeGenerationUnits(payload) {
  if (!isPlainObject(payload)) {
    validationError('generation', 'invalid_payload', 'payload 必須是 JSON object');
  }
  if (!Array.isArray(payload.aaData) || payload.aaData.length === 0) {
    validationError('generation', 'empty_rows', 'aaData 不得為空');
  }

  const updatedAt = requireString(payload.DateTime, {
    feed: 'generation',
    field: 'DateTime'
  });
  const observedAt = parseTaipowerGenerationTime(updatedAt);
  const categoriesByKey = new Map();

  const units = payload.aaData
    .filter((row) => {
      if (!isPlainObject(row)) {
        validationError('generation', 'invalid_row', '機組 row 必須是 JSON object');
      }
      const name = String(row['機組名稱'] || '').trim();
      return name && !name.startsWith('小計');
    })
    .map((row, index) => {
      const rawType = requireString(row['機組類型'], {
        feed: 'generation',
        field: `aaData[${index}].機組類型`
      });
      const type = rawType.replace(/<[^>]+>/g, '').trim();
      if (!type) {
        validationError('generation', 'invalid_text', `aaData[${index}].機組類型 只含 HTML 或無可識別內容`);
      }
      const name = requireString(row['機組名稱'], {
        feed: 'generation',
        field: `aaData[${index}].機組名稱`
      });
      const categoryKey = normalizeFuelType(type);
      const meta = getCategoryMeta(categoryKey);
      const capacityMw = requireNumber(row['裝置容量(MW)'], {
        feed: 'generation',
        field: `aaData[${index}].裝置容量(MW)`,
        min: 0,
        max: 100000,
        allowUnknown: true
      });
      const netGenerationMw = requireNumber(row['淨發電量(MW)'], {
        feed: 'generation',
        field: `aaData[${index}].淨發電量(MW)`,
        min: -20000,
        max: 100000,
        allowUnknown: true
      });
      const utilizationValue = row['淨發電量/裝置容量比(%)'];
      const utilizationPercent = utilizationValue === '' || utilizationValue === null || utilizationValue === undefined
        ? null
        : requireNumber(utilizationValue, {
            feed: 'generation',
            field: `aaData[${index}].淨發電量/裝置容量比(%)`,
            min: -500,
            max: 1000,
            allowUnknown: true
          });

      return {
        type,
        categoryKey,
        name,
        capacityMw,
        netGenerationMw,
        utilizationPercent,
        note: String(row['備註'] || '').trim(),
        color: meta.color,
        icon: meta.icon
      };
    });

  if (units.length === 0) {
    validationError('generation', 'no_units', '沒有可識別的非小計機組');
  }
  if (units.length < MIN_GENERATION_UNIT_COUNT) {
    validationError('generation', 'incomplete_units', '非小計機組筆數低於 production 安全下限');
  }

  for (const unit of units) {
    if (!categoriesByKey.has(unit.categoryKey)) {
      const meta = getCategoryMeta(unit.categoryKey);
      categoriesByKey.set(unit.categoryKey, {
        key: unit.categoryKey,
        ...meta,
        capacityMw: 0,
        netGenerationMw: 0,
        knownCapacityUnitCount: 0,
        knownGenerationUnitCount: 0,
        unitCount: 0,
        activeUnitCount: 0
      });
    }

    const category = categoriesByKey.get(unit.categoryKey);
    if (Number.isFinite(unit.capacityMw)) {
      category.capacityMw += unit.capacityMw;
      category.knownCapacityUnitCount += 1;
    }
    if (Number.isFinite(unit.netGenerationMw)) {
      category.netGenerationMw += unit.netGenerationMw;
      category.knownGenerationUnitCount += 1;
    }
    category.unitCount += 1;
    if (Number.isFinite(unit.netGenerationMw) && unit.netGenerationMw > 0) {
      category.activeUnitCount += 1;
    }
  }

  const knownGenerationUnits = units.filter((unit) => Number.isFinite(unit.netGenerationMw));
  const knownCapacityUnits = units.filter((unit) => Number.isFinite(unit.capacityMw));
  const totalNetGenerationMw = knownGenerationUnits.reduce((sum, unit) => sum + unit.netGenerationMw, 0);
  const grossGenerationMw = knownGenerationUnits.reduce((sum, unit) => sum + Math.max(0, unit.netGenerationMw), 0);
  const totalCapacityMw = knownCapacityUnits.reduce((sum, unit) => sum + unit.capacityMw, 0);
  const knownGenerationCoverage = knownGenerationUnits.length / units.length;

  if (knownGenerationCoverage < MIN_KNOWN_GENERATION_COVERAGE) {
    validationError('generation', 'incomplete_values', '可驗證淨發電量的機組比例低於 98%');
  }
  if (grossGenerationMw < 100 || grossGenerationMw > 150000) {
    validationError('generation', 'implausible_total', '已知機組的發電總量不在可信範圍');
  }

  const categories = [...categoriesByKey.values()]
    .map((category) => ({
      ...category,
      capacityMw: category.knownCapacityUnitCount > 0 ? round(category.capacityMw, 1) : null,
      netGenerationMw: category.knownGenerationUnitCount > 0 ? round(category.netGenerationMw, 1) : null,
      sharePercent: category.knownGenerationUnitCount > 0
        ? round((Math.max(0, category.netGenerationMw) / grossGenerationMw) * 100, 1)
        : null
    }))
    .sort((a, b) => (b.netGenerationMw ?? -Infinity) - (a.netGenerationMw ?? -Infinity));

  return {
    updatedAt,
    observedAt,
    units,
    categories,
    totals: {
      netGenerationMw: round(totalNetGenerationMw, 1),
      grossGenerationMw: round(grossGenerationMw, 1),
      capacityMw: round(totalCapacityMw, 1),
      activeUnitCount: knownGenerationUnits.filter((unit) => unit.netGenerationMw > 0).length,
      unitCount: units.length,
      knownGenerationUnitCount: knownGenerationUnits.length,
      unknownGenerationUnitCount: units.length - knownGenerationUnits.length,
      knownGenerationCoveragePercent: round(knownGenerationCoverage * 100, 1),
      knownCapacityUnitCount: knownCapacityUnits.length,
      unknownCapacityUnitCount: units.length - knownCapacityUnits.length
    }
  };
}

function normalizeIndicator(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : null;
}

export function getReserveHealth(ratePercent, reserveCapacityMw = null, officialIndicator = null) {
  if (isPlainObject(ratePercent)) {
    const supply = ratePercent;
    return getReserveHealth(
      supply.forecastReserveRatePercent,
      supply.forecastReserveCapacityMw,
      supply.forecastReserveIndicator
    );
  }

  const indicator = normalizeIndicator(officialIndicator);
  if (indicator && RESERVE_STATUS_BY_INDICATOR[indicator]) {
    return {
      ...RESERVE_STATUS_BY_INDICATOR[indicator],
      source: 'official-indicator'
    };
  }
  if (officialIndicator !== null && officialIndicator !== undefined) {
    return {
      ...UNKNOWN_HEALTH,
      source: 'invalid-indicator'
    };
  }

  let derivedIndicator = null;
  if (Number.isFinite(reserveCapacityMw) && reserveCapacityMw <= 500) {
    derivedIndicator = 'B';
  } else if (Number.isFinite(reserveCapacityMw) && reserveCapacityMw <= 900) {
    derivedIndicator = 'R';
  } else if (Number.isFinite(ratePercent) && ratePercent >= 10) {
    derivedIndicator = 'G';
  } else if (Number.isFinite(ratePercent) && ratePercent > 6) {
    derivedIndicator = 'Y';
  } else if (Number.isFinite(ratePercent)) {
    derivedIndicator = 'O';
  }

  if (!derivedIndicator) {
    return { ...UNKNOWN_HEALTH };
  }

  return {
    ...RESERVE_STATUS_BY_INDICATOR[derivedIndicator],
    source: 'derived-fallback'
  };
}

function getReservePercentBand(ratePercent) {
  if (ratePercent >= 10) return 'stable';
  if (ratePercent > 6) return 'watch';
  return 'caution';
}

function getReserveRateDisplay(ratePercent) {
  if (!Number.isFinite(ratePercent)) {
    return { value: null, precision: 1 };
  }

  const sourceBand = getReservePercentBand(ratePercent);
  for (let precision = 1; precision <= 6; precision += 1) {
    const value = round(ratePercent, precision);
    if (getReservePercentBand(value) === sourceBand) {
      return { value, precision };
    }
  }

  const precision = 6;
  const step = 10 ** -precision;
  const value = sourceBand === 'stable'
    ? Math.max(10, round(ratePercent, precision))
    : sourceBand === 'watch'
      ? Math.min(10 - step, Math.max(6 + step, round(ratePercent, precision)))
      : Math.min(6, round(ratePercent, precision));
  return { value, precision };
}

export function getReserveGuide(ratePercent, reserveCapacityMw = null, officialIndicator = null) {
  const health = getReserveHealth(ratePercent, reserveCapacityMw, officialIndicator);
  const hasRate = Number.isFinite(ratePercent);
  const distanceFromStableLinePercent = hasRate ? round(ratePercent - 10, 2) : null;
  const rateDisplay = getReserveRateDisplay(ratePercent);
  const displayRatePercent = rateDisplay.value;
  const displayDistanceFromStableLinePercent = hasRate
    ? round(displayRatePercent - 10, rateDisplay.precision)
    : null;
  const markerPercent = hasRate
    ? round(Math.min(100, Math.max(0, (ratePercent / 20) * 100)), 2)
    : null;
  const direction = distanceFromStableLinePercent !== null && distanceFromStableLinePercent >= 0 ? '高於' : '低於';
  const usesCapacityThreshold = health.indicator === 'R' || health.indicator === 'B';
  const summary = usesCapacityThreshold && Number.isFinite(reserveCapacityMw)
    ? `備轉容量 ${round(reserveCapacityMw, 0)} MW，台電燈號為 ${health.indicator}`
    : distanceFromStableLinePercent === null
      ? '目前無法確認備轉狀態'
      : distanceFromStableLinePercent === 0
        ? '正好位於供電充裕門檻'
        : `${direction}供電充裕門檻 ${Math.abs(displayDistanceFromStableLinePercent).toFixed(rateDisplay.precision)} 個百分點`;

  return {
    indicator: health.indicator,
    source: health.source,
    level: health.level,
    labelZh: health.labelZh,
    markerPercent,
    distanceFromStableLinePercent,
    displayRatePercent,
    displayDistanceFromStableLinePercent,
    displayPrecision: rateDisplay.precision,
    summary,
    description: health.criterion,
    ranges: RESERVE_RANGES,
    capacityThresholdsMw: {
      alert: 900,
      emergency: 500
    }
  };
}

export function validateFeedTimes({ supplyObservedAt, generationObservedAt, fetchedAt }) {
  if (supplyObservedAt === null || supplyObservedAt === undefined || supplyObservedAt === ''
      || generationObservedAt === null || generationObservedAt === undefined || generationObservedAt === ''
      || fetchedAt === null || fetchedAt === undefined || fetchedAt === '') {
    validationError('dashboard', 'missing_timestamp', 'observedAt 與 fetchedAt 不得缺失');
  }
  const fetchedDate = new Date(fetchedAt);
  const supplyDate = new Date(supplyObservedAt);
  const generationDate = new Date(generationObservedAt);

  if (!Number.isFinite(fetchedDate.getTime())) {
    validationError('dashboard', 'invalid_fetched_at', 'fetchedAt 無效');
  }
  if (!Number.isFinite(supplyDate.getTime()) || !Number.isFinite(generationDate.getTime())) {
    validationError('dashboard', 'invalid_observed_at', 'feed observedAt 無效');
  }
  if (supplyDate.getTime() > fetchedDate.getTime() + MAX_FUTURE_SKEW_MS) {
    validationError('supply', 'future_timestamp', 'publish_time 晚於抓取時間超過 2 分鐘');
  }
  if (generationDate.getTime() > fetchedDate.getTime() + MAX_FUTURE_SKEW_MS) {
    validationError('generation', 'future_timestamp', 'DateTime 晚於抓取時間超過 2 分鐘');
  }
  if (Math.abs(supplyDate.getTime() - generationDate.getTime()) > MAX_FEED_OBSERVED_AT_SKEW_MS) {
    validationError('dashboard', 'feed_time_skew', '兩份 feed 來源時間相差超過 6 小時');
  }

  return {
    fetchedAt: fetchedDate,
    supplyObservedAt: supplyDate,
    generationObservedAt: generationDate
  };
}

export function buildDashboardModel({ supplyPayload, generationPayload, fetchedAt = new Date(), source = 'live' }) {
  const supply = normalizeSupplyPayload(supplyPayload);
  const generation = summarizeGenerationUnits(generationPayload);
  const feedTimes = validateFeedTimes({
    supplyObservedAt: supply.observedAt,
    generationObservedAt: generation.observedAt,
    fetchedAt
  });
  const totalGeneration = generation.totals.netGenerationMw;
  const grossGeneration = generation.totals.grossGenerationMw;
  const generationToLoadRatio = totalGeneration / supply.currentLoadMw;
  if (!Number.isFinite(generationToLoadRatio)
      || generationToLoadRatio < MIN_GENERATION_TO_LOAD_RATIO
      || generationToLoadRatio > MAX_GENERATION_TO_LOAD_RATIO) {
    validationError('dashboard', 'inconsistent_feed_totals', '發電總量與目前負載的數量級無法對上');
  }
  const renewableGeneration = generation.categories
    .filter((category) => category.renewable)
    .reduce((sum, category) => sum + Math.max(0, category.netGenerationMw ?? 0), 0);
  const lowCarbonGeneration = generation.categories
    .filter((category) => category.lowCarbon)
    .reduce((sum, category) => sum + Math.max(0, category.netGenerationMw ?? 0), 0);
  const updatedAt = new Date(Math.min(
    feedTimes.supplyObservedAt.getTime(),
    feedTimes.generationObservedAt.getTime()
  ));
  const health = getReserveHealth(
    supply.forecastReserveRatePercent,
    supply.forecastReserveCapacityMw,
    supply.forecastReserveIndicator
  );

  return {
    source,
    fetchedAt: feedTimes.fetchedAt,
    updatedAt,
    observedAt: {
      supply: feedTimes.supplyObservedAt,
      generation: feedTimes.generationObservedAt
    },
    feeds: {
      supply: {
        observedAt: feedTimes.supplyObservedAt,
        fetchedAt: feedTimes.fetchedAt
      },
      generation: {
        observedAt: feedTimes.generationObservedAt,
        fetchedAt: feedTimes.fetchedAt
      }
    },
    health,
    reserveGuide: getReserveGuide(
      supply.forecastReserveRatePercent,
      supply.forecastReserveCapacityMw,
      supply.forecastReserveIndicator
    ),
    supply,
    generation,
    categories: generation.categories,
    topUnits: [...generation.units]
      .filter((unit) => Number.isFinite(unit.netGenerationMw) && unit.netGenerationMw > 0)
      .sort((a, b) => b.netGenerationMw - a.netGenerationMw)
      .slice(0, 8),
    constrainedUnits: generation.units
      .filter((unit) => unit.note && unit.note !== '-')
      .sort((a, b) => (b.capacityMw ?? -Infinity) - (a.capacityMw ?? -Infinity))
      .slice(0, 8),
    metrics: {
      currentLoadMw: supply.currentLoadMw,
      currentUtilizationPercent: supply.currentUtilizationPercent,
      forecastReserveRatePercent: supply.forecastReserveRatePercent,
      forecastReserveCapacityMw: supply.forecastReserveCapacityMw,
      forecastMaxSupplyCapacityMw: supply.forecastMaxSupplyCapacityMw,
      forecastPeakDemandMw: supply.forecastPeakDemandMw,
      totalGenerationMw: totalGeneration,
      renewableGenerationMw: round(renewableGeneration, 1),
      renewableSharePercent: grossGeneration ? round((renewableGeneration / grossGeneration) * 100, 1) : 0,
      lowCarbonSharePercent: grossGeneration ? round((lowCarbonGeneration / grossGeneration) * 100, 1) : 0
    }
  };
}

export { CATEGORY_META, RESERVE_STATUS };
