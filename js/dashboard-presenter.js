// Pure presentation rules shared by the UI layer. Everything that decides what
// the page is allowed to claim about data trust lives here so it stays testable
// without a DOM or a UI framework.

export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '--';
  return value.toLocaleString('zh-TW', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

export function formatMw(value, digits = 1) {
  return Number.isFinite(value) ? `${formatNumber(value, digits)} MW` : '--';
}

export function formatPercent(value, digits = 1) {
  return Number.isFinite(value) ? `${formatNumber(value, digits)}%` : '--';
}

export function formatPercentagePoints(value, digits = 1) {
  if (!Number.isFinite(value)) return '--';
  return `${value >= 0 ? '+' : ''}${formatNumber(value, digits)}pp`;
}

export function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function formatClockTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function getSourceText(transport) {
  return {
    'proxy-live': '台電官方資料 · 同源 API',
    'proxy-cache': '台電官方資料 · 伺服器快取',
    'static-snapshot': '台電官方資料 · GitHub Pages 快照',
    'browser-cache': '台電官方資料 · 瀏覽器快取',
    'direct-live': '台電官方資料 · 直接連線',
    unavailable: '目前無可驗證資料'
  }[transport] || '資料流未知';
}

function getTrustHealthMessage(result) {
  const state = result.freshness?.state;
  const health = result.model?.health;
  const indicator = result.model?.supply?.forecastReserveIndicator;
  if (state === 'unavailable'
      || health?.source !== 'official-indicator'
      || !indicator
      || !health.labelZh) {
    return null;
  }

  return state === 'live'
    ? `官方燈號：${indicator} · ${health.labelZh}。`
    : `最後更新時的官方燈號：${indicator} · ${health.labelZh}。`;
}

const REFRESH_MESSAGES = {
  updated: '已取得較新的官方來源時間。',
  failed: '本次重新檢查失敗，仍顯示最後成功資料。',
  unchanged: '已重新檢查，官方來源時間尚未更新。',
  regressed: '本次來源時間較舊，已保留較新的最後成功資料。'
};

// tone: success | warning | stale | error — drives every trust-related color.
export function describeTrustState(result) {
  const freshness = result?.freshness || { state: 'unavailable', sources: {} };
  const state = freshness.state;
  const metadataReason = result?.metadata?.reason;
  const fallbackMessage = metadataReason && state !== 'unavailable'
    ? state === 'live' ? metadataReason : '本次更新未取得較新資料。'
    : null;

  const age = formatDataAge(freshness.ageMinutes);
  const stateCopy = {
    live: {
      tone: metadataReason ? 'warning' : 'success',
      title: metadataReason ? '顯示最後成功資料' : '資料即時',
      message: `兩份台電來源中較舊的一份為 ${age}。`,
      badge: '即時'
    },
    delayed: {
      tone: 'warning',
      title: `資料稍舊 · ${age}`,
      message: `兩份台電來源中較舊的一份為 ${age}。${UPDATE_CADENCE}`,
      badge: '稍舊'
    },
    stale: {
      tone: 'warning',
      title: `資料過舊 · ${age}`,
      message: `兩份台電來源中較舊的一份為 ${age}。${UPDATE_CADENCE}`,
      badge: '過舊'
    },
    expired: {
      tone: 'warning',
      title: `超過 24 小時的資料 · ${age}`,
      message: `以下是 ${age}的最後成功資料。${UPDATE_CADENCE}`,
      badge: '超過 24 小時'
    },
    unavailable: {
      tone: 'error',
      title: '目前無法確認供電狀態',
      message: metadataReason || '未取得兩份可驗證的台電官方資料，因此不顯示舊數字或示範資料。',
      badge: '無法確認'
    }
  }[state] || {
    tone: 'error',
    title: '資料狀態無法辨識',
    message: '為避免誤導，暫不顯示供電結論。',
    badge: '無法確認'
  };

  const formatSource = (source) => ({
    observedAt: source?.observedAt || null,
    ageMinutes: source?.ageMinutes ?? null,
    state: source?.state || 'unavailable',
    text: source?.observedAt
      ? `${formatDateTime(source.observedAt)}（${source.ageMinutes} 分鐘前）`
      : '--'
  });

  return {
    state,
    tone: stateCopy.tone,
    title: stateCopy.title,
    badge: stateCopy.badge,
    message: [
      stateCopy.message,
      getTrustHealthMessage(result || {}),
      fallbackMessage,
      REFRESH_MESSAGES[result?.refreshOutcome] || null
    ].filter(Boolean).join(' '),
    sourceText: getSourceText(result?.transport),
    sources: {
      supply: formatSource(freshness.sources?.supply),
      generation: formatSource(freshness.sources?.generation)
    },
    oldestObservedAt: freshness.oldestObservedAt || null,
    oldestObservedText: freshness.oldestObservedAt ? formatDateTime(freshness.oldestObservedAt) : '--'
  };
}

// Headline wording for the reserve status, qualified by freshness so a delayed
// or stale snapshot can never read like a statement about right now.
// Headline wording for the reserve status. Live and slightly old data keep the
// official light's colour; data over six hours old turns neutral and is
// described as the light at the last update, so it never reads as "now".
export function describeReserveStatus(model, freshness) {
  const { health, reserveGuide, supply } = model;
  const state = freshness?.state;
  const isOld = state === 'stale' || state === 'expired';
  const indicator = supply.forecastReserveIndicator;

  return {
    indicator,
    level: health.level,
    color: isOld ? '#64748b' : health.color,
    muted: isOld,
    headline: isOld ? `最後更新時：${health.labelZh}` : health.labelZh,
    contextLabel: isOld ? '最後更新時的台電供電燈號' : '台電今日供電燈號',
    rateText: formatPercent(reserveGuide.displayRatePercent, reserveGuide.displayPrecision),
    marginText: formatPercentagePoints(
      reserveGuide.displayDistanceFromStableLinePercent,
      reserveGuide.displayPrecision
    ),
    summary: reserveGuide.summary,
    criterion: reserveGuide.description,
    ariaValueText: `${isOld ? '最後更新時，' : ''}${
      formatPercent(reserveGuide.displayRatePercent, reserveGuide.displayPrecision)
    }，官方 ${indicator} 燈，${health.labelZh}`
  };
}

// One label for both feeds, keyed to the older one: 「資料時間 HH:MM · N 小時前」.
// Only 過舊 and older add a sentence and the official link; nothing here is
// worded as broken, because the numbers are still the last official ones.
export function describeDataTime(freshness) {
  const state = freshness?.state;
  const at = freshness?.oldestObservedAt;
  if (!at || state === 'unavailable' || !DATA_TIME_TIERS[state]) return null;
  const tier = DATA_TIME_TIERS[state];
  const clock = state === 'expired' ? formatShortDateTime(at) : formatClockTime(at);
  return {
    tier: state,
    tierLabel: tier.label,
    tone: tier.tone,
    label: `資料時間 ${clock} · ${formatDataAge(freshness.ageMinutes)}`,
    note: tier.note ? tier.note(formatClockTime(at)) : null,
    showOfficialLink: Boolean(tier.note)
  };
}

const UPDATE_CADENCE = '本站每 3–4 小時更新一次，最新數據請見台電官網。';

const DATA_TIME_TIERS = {
  live: { label: '即時', tone: 'live' },
  delayed: { label: '稍舊', tone: 'amber' },
  stale: { label: '過舊', tone: 'amber', note: (clock) => `GitHub 排程延遲，最後成功更新 ${clock}。${UPDATE_CADENCE}` },
  expired: { label: '超過 24 小時', tone: 'amber', note: () => `這是 24 小時前的資料。${UPDATE_CADENCE}` }
};

function formatShortDateTime(date) {
  const taipei = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${taipei.getUTCMonth() + 1}/${taipei.getUTCDate()} ${formatClockTime(date)}`;
}

// Relative age in the unit a reader would say aloud: minutes under an hour,
// whole hours under two days, then days.
export function formatDataAge(minutes) {
  if (!Number.isFinite(minutes)) return '--';
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} 小時前`;
  return `${Math.floor(minutes / (24 * 60))} 天前`;
}

function getFeedTimes(result) {
  const feeds = result?.model?.feeds;
  if (!feeds?.supply?.observedAt || !feeds?.generation?.observedAt) return null;
  return [feeds.supply.observedAt.getTime(), feeds.generation.observedAt.getTime()];
}

// Classifies a forced refresh against the previously rendered result. Each feed
// is compared on its own so an advance in either one counts as an update.
export function classifyRefreshOutcome(previousResult, nextResult) {
  const previousFeedTimes = getFeedTimes(previousResult);
  const nextFeedTimes = getFeedTimes(nextResult);
  if (!previousFeedTimes || !nextFeedTimes) return null;

  if (nextResult.metadata?.refreshFailed) return 'failed';
  if (nextResult.metadata?.preventedRegression
      || nextFeedTimes.some((time, index) => time < previousFeedTimes[index])) {
    return 'regressed';
  }
  return nextFeedTimes.some((time, index) => time > previousFeedTimes[index])
    ? 'updated'
    : 'unchanged';
}

// Positive-output categories with a share, used by the mix charts.
export function getPositiveCategories(model) {
  return (model?.categories || [])
    .filter((category) => Number.isFinite(category.netGenerationMw) && category.netGenerationMw > 0);
}

// Taipower and Taiwanese media quote power in 萬瓩 (10 MW); MW is offered as
// an alternative. Energy (度) is never mixed with power here.
export const POWER_UNITS = Object.freeze({
  wan: { label: '萬瓩', divisor: 10, digits: 1 },
  mw: { label: 'MW', divisor: 1, digits: 0 }
});

export function convertPower(mw, unit = 'wan') {
  const spec = POWER_UNITS[unit] || POWER_UNITS.wan;
  return Number.isFinite(mw) ? mw / spec.divisor : null;
}

export function formatPowerValue(mw, unit = 'wan', digits) {
  const spec = POWER_UNITS[unit] || POWER_UNITS.wan;
  return formatNumber(convertPower(mw, unit), digits ?? spec.digits);
}

export function formatPower(mw, unit = 'wan', digits) {
  if (!Number.isFinite(mw)) return '--';
  return `${formatPowerValue(mw, unit, digits)} ${(POWER_UNITS[unit] || POWER_UNITS.wan).label}`;
}

export function formatAge(minutes) {
  if (!Number.isFinite(minutes)) return '--';
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小時 ${rest} 分鐘前` : `${hours} 小時前`;
}
