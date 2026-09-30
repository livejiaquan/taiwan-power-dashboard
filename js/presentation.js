// Presentation only: dates always describe the source, never the reader's day.
export function formatSourceDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatRocDate(value) {
  const match = /^(\d{2,3})[.-](\d{1,2})[.-](\d{1,2})$/.exec(value || "");
  if (!match) return "--";
  return `${Number(match[1]) + 1911}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
}

// Fuel identity is consistent across charts, detail rows and unit tables.
// Official supply lights retain their independent meaning.
const fuelColors = {
  gas: "#ff855d",
  coal: "#a9b4bd",
  solar: "#efcd66",
  wind: "#8ad6c3",
  hydro: "#577b89",
  nuclear: "#8c7c99",
  oil: "#68463d",
  cogeneration: "#75b8dd",
  storage: "#617a67",
  "storage-load": "#a5aaa0",
  "other-renewable": "#a3b28d",
  other: "#868c82",
};
export function getFuelColor(key) {
  return fuelColors[key] || fuelColors.other;
}

// Independent official values on a shared scale; reserve is NOT added to load.
export function getPeakVisual(metrics) {
  const supply = metrics.forecastMaxSupplyCapacityMw;
  const demand = metrics.forecastPeakDemandMw;
  const reserve = metrics.forecastReserveCapacityMw;
  if (
    ![supply, demand, reserve].every(Number.isFinite) ||
    supply <= 0 ||
    demand < 0 ||
    reserve < 0
  )
    return null;
  const axis = Math.max(supply, demand, reserve);
  return {
    supply,
    demand,
    reserve,
    supplyWidth: (supply / axis) * 100,
    demandWidth: (demand / axis) * 100,
    reserveWidth: (reserve / axis) * 100,
  };
}

export function getPositiveMix(categories) {
  const positive = categories.filter(
    (c) => Number.isFinite(c.netGenerationMw) && c.netGenerationMw > 0,
  );
  const total = positive.reduce((sum, c) => sum + c.netGenerationMw, 0);
  return positive.map((c) => ({
    ...c,
    positiveShare: (c.netGenerationMw / total) * 100,
  }));
}

// The arc shows forecast demand against capacity, never the demand-denominated reserve rate.
export function getCapacityBalance(metrics) {
  const v = getPeakVisual(metrics);
  if (!v) return null;
  return {
    supply: v.supply,
    demand: v.demand,
    reserve: v.reserve,
    gap: Math.max(0, v.supply - v.demand),
    excess: Math.max(0, v.demand - v.supply),
    segments: [
      Math.min(v.supply, v.demand),
      Math.max(0, v.supply - v.demand),
      Math.max(0, v.demand - v.supply),
    ],
  };
}

// A refresh result describes verification, never a reset of source age.
export function getRefreshFeedback(result) {
  if (!result?.model || !result.freshness?.usable) {
    return "重新檢查完成，仍無可驗證資料；暫停顯示數字。";
  }
  if (result.metadata?.preventedRegression || result.refreshOutcome === "regressed") {
    return "本次來源時間較舊，已保留較新的最後成功資料。";
  }
  if (result.transport === "browser-cache" && result.metadata?.reason) {
    return "本次連線未取得資料，保留最後成功快照；來源時間未變。";
  }
  if (result.refreshOutcome === "updated") {
    return "已取得較新的官方來源時間；資料時效請見上方狀態。";
  }
  if (result.refreshOutcome === "unchanged") {
    return "已重新檢查，官方來源時間尚未更新。";
  }
  return "重新檢查完成，已取得可驗證資料；資料時效請見上方狀態。";
}

// Check both feeds: the oldest timestamp alone can hide a one-feed update.
export function getRefreshOutcome(previous, next) {
  if (next.metadata?.preventedRegression) return "regressed";
  const feeds = ["supply", "generation"];
  const timestamp = (result, feed) => {
    const value = result?.model?.feeds?.[feed]?.observedAt;
    return value == null ? NaN : new Date(value).getTime();
  };
  const before = feeds.map((feed) => timestamp(previous, feed));
  const after = feeds.map((feed) => timestamp(next, feed));
  if (![...before, ...after].every(Number.isFinite)) return "checked";
  if (after.some((time, index) => time < before[index])) return "regressed";
  if (after.some((time, index) => time > before[index])) return "updated";
  return "unchanged";
}
