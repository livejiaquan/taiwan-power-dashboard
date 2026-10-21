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
    : `最後成功快照的官方燈號：${indicator} · ${health.labelZh}。`;
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

  const stateCopy = {
    live: {
      tone: metadataReason ? 'warning' : 'success',
      title: metadataReason ? '目前使用最後成功資料' : '官方資料已確認',
      message: `兩份台電來源均在 20 分鐘內；較舊一份為 ${freshness.ageMinutes} 分鐘前。`,
      badge: metadataReason ? '最後成功資料' : '最新資料'
    },
    delayed: {
      tone: 'warning',
      title: `資料延遲 ${freshness.ageMinutes} 分鐘`,
      message: '以下為最後成功資料，不能視為此刻的供電狀態。頁面會持續重新檢查。',
      badge: '延遲資料'
    },
    stale: {
      tone: 'stale',
      title: `非即時快照 · ${freshness.ageMinutes} 分鐘前`,
      message: '資料已超過 60 分鐘；下方數字只代表最後成功快照，不代表目前供電。',
      badge: '非即時快照'
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
export function describeReserveStatus(model, freshness) {
  const { health, reserveGuide, supply } = model;
  const state = freshness?.state;
  const isStale = state === 'stale';
  const isDelayed = state === 'delayed';
  const indicator = supply.forecastReserveIndicator;

  return {
    indicator,
    level: health.level,
    color: isStale ? '#64748b' : health.color,
    muted: isStale,
    headline: isStale
      ? `最後快照：${health.labelZh}`
      : isDelayed
        ? `延遲資料：${health.labelZh}`
        : health.labelZh,
    contextLabel: isStale
      ? '最後快照中的台電供電燈號'
      : isDelayed
        ? '延遲資料中的台電供電燈號'
        : '台電今日供電燈號',
    modeLabel: isStale ? '非即時' : isDelayed ? '延遲' : '來源已確認',
    rateText: formatPercent(reserveGuide.displayRatePercent, reserveGuide.displayPrecision),
    marginText: formatPercentagePoints(
      reserveGuide.displayDistanceFromStableLinePercent,
      reserveGuide.displayPrecision
    ),
    summary: reserveGuide.summary,
    criterion: reserveGuide.description,
    ariaValueText: `${isStale ? '最後快照，非即時，' : isDelayed ? '延遲資料，' : ''}${
      formatPercent(reserveGuide.displayRatePercent, reserveGuide.displayPrecision)
    }，官方 ${indicator} 燈，${health.labelZh}`
  };
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
