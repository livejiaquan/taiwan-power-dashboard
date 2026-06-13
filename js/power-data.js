export const SUPPLY_ENDPOINT = 'https://service.taipower.com.tw/data/opendata/apply/file/d006020/001.json';
export const GENERATION_ENDPOINT = 'https://service.taipower.com.tw/data/opendata/apply/file/d006001/001.json';

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

const RESERVE_STATUS = [
  {
    level: 'stable',
    labelZh: '供電充裕',
    labelEn: 'Stable',
    color: '#059669',
    icon: 'bi-check-circle-fill',
    minRate: 15
  },
  {
    level: 'watch',
    labelZh: '正常偏緊',
    labelEn: 'Watch',
    color: '#d97706',
    icon: 'bi-activity',
    minRate: 10
  },
  {
    level: 'caution',
    labelZh: '供電吃緊',
    labelEn: 'Caution',
    color: '#ea580c',
    icon: 'bi-exclamation-triangle-fill',
    minRate: 6
  },
  {
    level: 'alert',
    labelZh: '供電警戒',
    labelEn: 'Alert',
    color: '#dc2626',
    icon: 'bi-exclamation-octagon-fill',
    minRate: -Infinity
  }
];

const RESERVE_RANGES = [
  { label: '警戒', start: 0, end: 6, color: '#dc2626' },
  { label: '吃緊', start: 6, end: 10, color: '#ea580c' },
  { label: '偏緊', start: 10, end: 15, color: '#d97706' },
  { label: '充裕', start: 15, end: 30, color: '#059669' }
];

const RESERVE_DESCRIPTIONS = {
  stable: '高於 15% 代表供電緩衝充足，尖峰時段仍有較多可調度容量。',
  watch: '介於 10% 到 15%，供電仍可用但緩衝變薄，尖峰時段要留意。',
  caution: '介於 6% 到 10%，供電偏緊，任何機組或需求變化都更敏感。',
  alert: '備轉容量已低於 6%，需留意官方供電警訊。'
};

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

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function round(value, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
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

export function normalizeSupplyPayload(payload) {
  const records = Array.isArray(payload?.records) ? payload.records : [];
  const current = records.find((record) => record.curr_load !== undefined) || {};
  const forecast = records.find((record) => record.fore_peak_resv_rate !== undefined) || {};
  const yesterday = records.find((record) => record.yday_peak_resv_rate !== undefined) || {};
  const realtimePeak = records.find((record) => record.real_hr_peak_time !== undefined) || {};

  return {
    currentLoadMw: parseNumber(current.curr_load) || 0,
    currentUtilizationPercent: parseNumber(current.curr_util_rate) || 0,
    forecastMaxSupplyCapacityMw: parseNumber(forecast.fore_maxi_sply_capacity) || 0,
    forecastPeakDemandMw: parseNumber(forecast.fore_peak_dema_load) || 0,
    forecastReserveCapacityMw: parseNumber(forecast.fore_peak_resv_capacity) || 0,
    forecastReserveRatePercent: parseNumber(forecast.fore_peak_resv_rate) || 0,
    forecastReserveIndicator: forecast.fore_peak_resv_indicator || 'U',
    forecastPeakHourRange: forecast.fore_peak_hour_range || '--',
    publishTimeText: forecast.publish_time || '--',
    yesterdayDateText: yesterday.yday_date || '--',
    yesterdayPeakDemandMw: parseNumber(yesterday.yday_peak_dema_load) || 0,
    yesterdayReserveRatePercent: parseNumber(yesterday.yday_peak_resv_rate) || 0,
    yesterdayReserveIndicator: yesterday.yday_peak_resv_indicator || 'U',
    realHourMaxSupplyCapacityMw: parseNumber(realtimePeak.real_hr_maxi_sply_capacity) || 0,
    realHourPeakTimeText: realtimePeak.real_hr_peak_time || '--'
  };
}

export function summarizeGenerationUnits(payload) {
  const rows = Array.isArray(payload?.aaData) ? payload.aaData : [];
  const categoriesByKey = new Map();

  const units = rows
    .filter((row) => {
      const name = String(row['機組名稱'] || '').trim();
      return name && !name.startsWith('小計');
    })
    .map((row) => {
      const categoryKey = normalizeFuelType(row['機組類型']);
      const meta = getCategoryMeta(categoryKey);

      return {
        type: String(row['機組類型'] || '').replace(/<[^>]+>/g, '').trim(),
        categoryKey,
        name: String(row['機組名稱'] || '').trim(),
        capacityMw: parseNumber(row['裝置容量(MW)']) || 0,
        netGenerationMw: parseNumber(row['淨發電量(MW)']) || 0,
        utilizationPercent: parseNumber(row['淨發電量/裝置容量比(%)']),
        note: String(row['備註'] || '').trim(),
        color: meta.color,
        icon: meta.icon
      };
    });

  for (const unit of units) {
    if (!categoriesByKey.has(unit.categoryKey)) {
      const meta = getCategoryMeta(unit.categoryKey);
      categoriesByKey.set(unit.categoryKey, {
        key: unit.categoryKey,
        ...meta,
        capacityMw: 0,
        netGenerationMw: 0,
        unitCount: 0,
        activeUnitCount: 0
      });
    }

    const category = categoriesByKey.get(unit.categoryKey);
    category.capacityMw += unit.capacityMw;
    category.netGenerationMw += unit.netGenerationMw;
    category.unitCount += 1;
    if (unit.netGenerationMw > 0) {
      category.activeUnitCount += 1;
    }
  }

  const totalNetGenerationMw = units.reduce((sum, unit) => sum + unit.netGenerationMw, 0);
  const totalCapacityMw = units.reduce((sum, unit) => sum + unit.capacityMw, 0);

  const categories = [...categoriesByKey.values()]
    .map((category) => ({
      ...category,
      capacityMw: round(category.capacityMw, 1),
      netGenerationMw: round(category.netGenerationMw, 1),
      sharePercent: totalNetGenerationMw ? round((category.netGenerationMw / totalNetGenerationMw) * 100, 1) : 0
    }))
    .sort((a, b) => b.netGenerationMw - a.netGenerationMw);

  return {
    updatedAt: payload?.DateTime || null,
    units,
    categories,
    totals: {
      netGenerationMw: round(totalNetGenerationMw, 1),
      capacityMw: round(totalCapacityMw, 1),
      activeUnitCount: units.filter((unit) => unit.netGenerationMw > 0).length,
      unitCount: units.length
    }
  };
}

export function getReserveHealth(ratePercent) {
  return RESERVE_STATUS.find((status) => ratePercent >= status.minRate) || RESERVE_STATUS.at(-1);
}

export function getReserveGuide(ratePercent) {
  const normalizedRate = Number.isFinite(ratePercent) ? ratePercent : 0;
  const health = getReserveHealth(normalizedRate);
  const distanceFromStableLinePercent = round(normalizedRate - 15, 2);
  const markerPercent = round(Math.min(100, Math.max(0, (normalizedRate / 30) * 100)), 2);
  const direction = distanceFromStableLinePercent >= 0 ? '高於' : '低於';

  return {
    level: health.level,
    labelZh: health.labelZh,
    markerPercent,
    distanceFromStableLinePercent,
    summary: `${direction}供電充裕線 ${Math.abs(distanceFromStableLinePercent).toFixed(1)} 個百分點`,
    description: RESERVE_DESCRIPTIONS[health.level],
    ranges: RESERVE_RANGES
  };
}

export function buildDashboardModel({ supplyPayload, generationPayload, fetchedAt = new Date(), source = 'live' }) {
  const supply = normalizeSupplyPayload(supplyPayload);
  const generation = summarizeGenerationUnits(generationPayload);
  const totalGeneration = generation.totals.netGenerationMw;
  const renewableGeneration = generation.categories
    .filter((category) => category.renewable)
    .reduce((sum, category) => sum + category.netGenerationMw, 0);
  const lowCarbonGeneration = generation.categories
    .filter((category) => category.lowCarbon)
    .reduce((sum, category) => sum + category.netGenerationMw, 0);

  const updatedAt = generation.updatedAt ? new Date(generation.updatedAt) : new Date(fetchedAt);

  return {
    source,
    fetchedAt: new Date(fetchedAt),
    updatedAt,
    health: getReserveHealth(supply.forecastReserveRatePercent),
    reserveGuide: getReserveGuide(supply.forecastReserveRatePercent),
    supply,
    generation,
    categories: generation.categories,
    topUnits: [...generation.units]
      .filter((unit) => unit.netGenerationMw > 0)
      .sort((a, b) => b.netGenerationMw - a.netGenerationMw)
      .slice(0, 8),
    constrainedUnits: generation.units
      .filter((unit) => unit.note && unit.note !== '-')
      .sort((a, b) => b.capacityMw - a.capacityMw)
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
      renewableSharePercent: totalGeneration ? round((renewableGeneration / totalGeneration) * 100, 1) : 0,
      lowCarbonSharePercent: totalGeneration ? round((lowCarbonGeneration / totalGeneration) * 100, 1) : 0
    }
  };
}

export { CATEGORY_META, RESERVE_STATUS };
