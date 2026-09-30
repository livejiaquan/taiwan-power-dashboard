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
