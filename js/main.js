import { powerAPI } from "./api.js";
import { chartManager } from "./charts.js";
import { createFreshnessClock } from "./freshness-clock.js";
import { escapeHtml } from "./sanitize.js";
import {
  formatSourceDate,
  formatRocDate,
  getFuelColor,
  getCapacityBalance,
  getPositiveMix,
  getRefreshFeedback,
  getRefreshOutcome,
} from "./presentation.js";

const autoRefreshMs = 10 * 60 * 1000;

const elements = {
  loadingScreen: document.getElementById("loading-screen"),
  mainContainer: document.getElementById("main-container"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshFeedback: document.getElementById("refresh-feedback"),
  retryDataBtn: document.getElementById("retry-data-btn"),
  lastUpdateTime: document.getElementById("last-update-time"),
  sourceStatus: document.getElementById("source-status"),
  supplySourceTime: document.getElementById("supply-source-time"),
  generationSourceTime: document.getElementById("generation-source-time"),
  noticeBanner: document.getElementById("notice-banner"),
  noticeIcon: document.getElementById("notice-icon"),
  noticeTitle: document.getElementById("notice-title"),
  noticeMessage: document.getElementById("notice-message"),
  unavailableActions: document.getElementById("unavailable-actions"),
  unavailableState: document.getElementById("unavailable-state"),
  heroDataStatus: document.getElementById("hero-data-status"),
  dashboardContents: document.querySelectorAll("[data-dashboard-content]"),
  statusHero: document.querySelector(".status-hero"),
  healthBlock: document.querySelector(".health-block"),
  healthIcon: document.getElementById("health-icon"),
  healthLabel: document.getElementById("health-label"),
  healthTierText: document.getElementById("health-tier-text"),
  healthIndicatorCode: document.getElementById("health-indicator-code"),
  healthContextLabel: document.getElementById("health-context-label"),
  healthMode: document.getElementById("health-mode"),
  reserveMargin: document.getElementById("reserve-margin"),
  reserveBlock: document.querySelector(".reserve-block"),
  reserveMeterValue: document.getElementById("reserve-meter-value"),
  reserveMeter: document.getElementById("reserve-meter"),
  reserveThresholdItems: document.querySelectorAll(
    ".reserve-gauge__labels [data-level]",
  ),
  reserveLevelBadge: document.getElementById("reserve-level-badge"),
  reserveSummary: document.getElementById("reserve-summary"),
  reserveDescription: document.getElementById("reserve-description"),
  reserveCapacity: document.getElementById("reserve-capacity"),
  peakDemand: document.getElementById("peak-demand"),
  peakRange: document.getElementById("peak-range"),
  statsGrid: document.getElementById("stats-grid"),
  categoryGrid: document.getElementById("category-grid"),
  topUnitsBody: document.getElementById("top-units-body"),
  constrainedUnits: document.getElementById("constrained-units"),
  fuelChart: document.getElementById("fuel-mix-chart"),
  categoryChart: document.getElementById("category-bar-chart"),
  fuelChartFallback: document.getElementById("fuel-chart-fallback"),
  categoryChartFallback: document.getElementById("category-chart-fallback"),
  scrollToTop: document.getElementById("scroll-to-top"),
  supplyDateLabel: document.getElementById("supply-date-label"),
  generationDateLabel: document.getElementById("generation-date-label"),
  contextHeading: document.querySelector(".context-heading"),
  noticeBrief: document.getElementById("notice-brief"),
  maxSupply: document.getElementById("max-supply"),
  peakDiagram: document.getElementById("peak-diagram"),
  lightLetter: document.getElementById("official-light-letter"),
  currentLoad: document.getElementById("current-load"),
  currentOutput: document.getElementById("current-output"),
  loadSourceLabel: document.getElementById("load-source-label"),
  activeUnits: document.getElementById("active-units"),
  loadCaption: document.getElementById("load-caption"),
  outputCaption: document.getElementById("output-caption"),
  mixGlance: document.getElementById("mix-glance-visual"),
};

const appState = {
  result: null,
  loading: false,
  autoRefreshId: null,
};

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("zh-TW", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatMw(value, digits = 1) {
  return Number.isFinite(value) ? `${formatNumber(value, digits)} MW` : "--";
}

function formatPercent(value, digits = 1) {
  return Number.isFinite(value) ? `${formatNumber(value, digits)}%` : "--";
}

function formatPercentagePoints(value, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}pp`;
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatSourceTime(source) {
  if (!source?.observedAt) return "--";
  return `${formatDateTime(source.observedAt)}（${source.ageMinutes} 分鐘前）`;
}

function setLoading(isLoading) {
  appState.loading = isLoading;
  elements.refreshBtn.disabled = isLoading;
  elements.retryDataBtn.disabled = isLoading;
  elements.refreshBtn.classList.toggle("loading", isLoading);
  elements.refreshBtn.setAttribute("aria-busy", String(isLoading));
  elements.retryDataBtn.setAttribute("aria-busy", String(isLoading));
}

function hideLoadingScreen() {
  elements.mainContainer.classList.remove("hidden");
  elements.loadingScreen.classList.add("loading-screen--hidden");

  window.setTimeout(() => {
    elements.loadingScreen.classList.add("hidden");
  }, 450);
}

function setDataContentVisible(isVisible) {
  elements.dashboardContents.forEach((element) => {
    element.hidden = !isVisible;
  });
  elements.unavailableState.hidden = isVisible;
  elements.unavailableActions.hidden = isVisible;
}

function setHeroDataStatus(state, text) {
  elements.heroDataStatus.className = `hero-data-status hero-data-status--${state}`;
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  elements.heroDataStatus.replaceChildren(dot, document.createTextNode(text));
}

function getSourceText(transport) {
  return (
    {
      "proxy-live": "台電官方資料 · 同源 API",
      "proxy-cache": "台電官方資料 · 伺服器快取",
      "static-snapshot": "台電官方資料 · GitHub Pages 快照",
      "browser-cache": "台電官方資料 · 瀏覽器快取",
      "direct-live": "台電官方資料 · 直接連線",
      unavailable: "目前無可驗證資料",
    }[transport] || "資料流未知"
  );
}

function getTrustHealthMessage(result) {
  const state = result.freshness?.state;
  const health = result.model?.health;
  const indicator = result.model?.supply?.forecastReserveIndicator;
  if (
    state === "unavailable" ||
    health?.source !== "official-indicator" ||
    !indicator ||
    !health.labelZh
  ) {
    return null;
  }

  return state === "live"
    ? `官方燈號：${indicator} · ${health.labelZh}。`
    : `最後成功快照的官方燈號：${indicator} · ${health.labelZh}。`;
}

function renderTrustState(result) {
  const freshness = result.freshness || { state: "unavailable", sources: {} };
  const state = freshness.state;
  const metadataReason = result.metadata?.reason;
  const fallbackMessage =
    metadataReason && state !== "unavailable"
      ? state === "live"
        ? metadataReason
        : "本次更新未取得較新資料。"
      : null;
  const refreshMessage =
    result.refreshOutcome === "updated"
      ? "已取得較新的官方來源時間。"
      : result.refreshOutcome === "unchanged"
        ? "已重新檢查，官方來源時間尚未更新。"
        : result.refreshOutcome === "regressed"
          ? "本次來源時間較舊，已保留較新的最後成功資料。"
          : null;

  const stateCopy =
    {
      live: {
        bannerClass: metadataReason ? "warning" : "success",
        icon: metadataReason
          ? "bi-exclamation-triangle-fill"
          : "bi-check-circle-fill",
        title: metadataReason ? "目前使用最後成功資料" : "官方資料已確認",
        message: `兩份台電來源均在 20 分鐘內；較舊一份為 ${freshness.ageMinutes} 分鐘前。`,
        heroClass: metadataReason ? "warning" : "success",
        heroText: metadataReason ? "最後成功資料" : "最新資料",
      },
      delayed: {
        bannerClass: "warning",
        icon: "bi-clock-history",
        title: `資料延遲 ${freshness.ageMinutes} 分鐘`,
        message:
          "以下為最後成功資料，不能視為此刻的供電狀態。頁面會持續重新檢查。",
        heroClass: "warning",
        heroText: "延遲資料",
      },
      stale: {
        bannerClass: "stale",
        icon: "bi-exclamation-triangle-fill",
        title: `非即時快照 · ${freshness.ageMinutes} 分鐘前`,
        message:
          "資料已超過 60 分鐘；下方數字只代表最後成功快照，不代表目前供電。",
        heroClass: "stale",
        heroText: "非即時快照",
      },
      unavailable: {
        bannerClass: "error",
        icon: "bi-cloud-slash-fill",
        title: "目前無法確認供電狀態",
        message:
          result.metadata?.reason ||
          "未取得兩份可驗證的台電官方資料，因此不顯示舊數字或示範資料。",
        heroClass: "error",
        heroText: "無法確認",
      },
    }[state] || null;

  const copy = stateCopy || {
    bannerClass: "error",
    icon: "bi-cloud-slash-fill",
    title: "資料狀態無法辨識",
    message: "為避免誤導，暫不顯示供電結論。",
    heroClass: "error",
    heroText: "無法確認",
  };

  elements.noticeBanner.className = `notice-banner notice-banner--${copy.bannerClass}`;
  elements.noticeIcon.className = `bi ${copy.icon}`;
  elements.noticeTitle.textContent = copy.title;
  elements.noticeBrief.textContent =
    state === "live"
      ? "供需與機組來源時間已核對。"
      : state === "unavailable"
        ? "暫停顯示數字，請重查或向台電確認。"
        : "以下是舊資料，不代表此刻供電。";
  elements.noticeMessage.textContent = [
    copy.message,
    getTrustHealthMessage(result),
    fallbackMessage,
    refreshMessage,
  ]
    .filter(Boolean)
    .join(" ");
  setHeroDataStatus(copy.heroClass, copy.heroText);
  elements.sourceStatus.textContent = getSourceText(result.transport);

  const supplySource = freshness.sources?.supply;
  const generationSource = freshness.sources?.generation;
  elements.supplySourceTime.textContent = formatSourceTime(supplySource);
  elements.generationSourceTime.textContent =
    formatSourceTime(generationSource);
  elements.lastUpdateTime.textContent = freshness.oldestObservedAt
    ? formatDateTime(freshness.oldestObservedAt)
    : "--";
  elements.mainContainer.dataset.freshness = state;
}

function renderHero(model, freshness) {
  const { health, metrics, reserveGuide, supply } = model;
  const isStale = freshness.state === "stale";
  const isDelayed = freshness.state === "delayed";
  const displayColor = isStale ? "#64748b" : health.color;
  const reservePosition = Math.min(
    100,
    Math.max(0, (metrics.forecastReserveRatePercent / 20) * 100),
  );
  const needleAngle = -108 + reservePosition * 2.16;
  const thresholdLevel =
    health.level === "stable"
      ? "stable"
      : health.level === "watch"
        ? "watch"
        : "caution";
  const indicator = supply.forecastReserveIndicator;
  const sourceDate = formatSourceDate(supply.observedAt);
  elements.supplyDateLabel.textContent = `${sourceDate} 的預估尖峰 · 非目前瞬時值`;
  elements.contextHeading.textContent = `${sourceDate} / 預估尖峰`;
  elements.generationDateLabel.textContent = `來源時間 ${formatDateTime(model.feeds.generation.observedAt)} · 台灣`;
  elements.statusHero.setAttribute(
    "aria-label",
    `${sourceDate} 來源資料的供需與備轉`,
  );

  elements.healthIcon.className = `bi ${health.icon}`;
  elements.healthIcon.style.color = displayColor;
  elements.lightLetter.parentElement.style.borderColor = displayColor;
  elements.lightLetter.parentElement.style.color = displayColor;
  elements.healthLabel.textContent = isStale
    ? `最後快照：${health.labelZh}`
    : isDelayed
      ? `延遲資料：${health.labelZh}`
      : health.labelZh;
  elements.healthTierText.textContent = `${indicator} 燈`;
  elements.healthIndicatorCode.textContent = `${indicator} · 官方燈號`;
  elements.healthContextLabel.textContent = isStale
    ? "最後快照中的台電供電燈號"
    : isDelayed
      ? "延遲資料中的台電供電燈號"
      : `${sourceDate} 的台電供電燈號`;
  elements.healthMode.className = `health-mode${isStale ? " health-mode--stale" : isDelayed ? " health-mode--delayed" : ""}`;
  elements.healthMode.textContent = isStale
    ? "非即時"
    : isDelayed
      ? "延遲"
      : "來源已確認";
  elements.reserveMargin.textContent = formatPercentagePoints(
    reserveGuide.displayDistanceFromStableLinePercent,
    reserveGuide.displayPrecision,
  );
  elements.healthBlock.dataset.indicator = indicator;
  elements.healthBlock.style.setProperty("--health-color", displayColor);
  elements.healthBlock.style.setProperty(
    "--reserve-arc",
    `${reservePosition}%`,
  );
  elements.healthBlock.style.setProperty("--needle-angle", `${needleAngle}deg`);
  elements.healthBlock.dataset.level = health.level;
  elements.healthBlock.dataset.freshness = freshness.state;
  elements.reserveMeterValue.textContent = formatPercent(
    reserveGuide.displayRatePercent,
    reserveGuide.displayPrecision,
  );
  elements.reserveBlock.style.setProperty("--reserve-color", displayColor);
  elements.reserveBlock.dataset.level = thresholdLevel;
  elements.reserveBlock.style.setProperty(
    "--reserve-position",
    `${reservePosition}%`,
  );
  elements.reserveThresholdItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.level === thresholdLevel);
  });
  elements.reserveMeter.setAttribute("aria-valuemin", "0");
  elements.reserveMeter.setAttribute(
    "aria-valuemax",
    String(Math.max(30, Math.ceil(metrics.forecastReserveRatePercent))),
  );
  elements.reserveMeter.setAttribute(
    "aria-valuenow",
    String(Math.max(0, metrics.forecastReserveRatePercent)),
  );
  const freshnessQualifier = isStale
    ? "最後快照，非即時，"
    : isDelayed
      ? "延遲資料，"
      : "";
  elements.reserveMeter.setAttribute(
    "aria-valuetext",
    `${freshnessQualifier}${formatPercent(reserveGuide.displayRatePercent, reserveGuide.displayPrecision)}，官方 ${indicator} 燈，${health.labelZh}`,
  );
  elements.reserveLevelBadge.textContent = `${indicator} · ${health.labelZh}`;
  elements.reserveLevelBadge.style.color = displayColor;
  elements.reserveLevelBadge.style.borderColor = displayColor;
  elements.reserveSummary.textContent = reserveGuide.summary;
  elements.reserveDescription.textContent = reserveGuide.description;
  elements.peakRange.textContent = supply.forecastPeakHourRange;
  elements.reserveCapacity.textContent = formatMw(
    metrics.forecastReserveCapacityMw,
    0,
  );
  elements.peakDemand.textContent = formatMw(metrics.forecastPeakDemandMw, 0);
  renderVisualSummary(model, freshness);
  elements.statusHero.classList.toggle("status-hero--stale", isStale);
}

function renderVisualSummary(model, freshness) {
  const visual = getCapacityBalance(model.metrics);
  elements.lightLetter.textContent = model.supply.forecastReserveIndicator;
  elements.maxSupply.textContent = formatNumber(visual.supply, 0);
  document.getElementById("demand-share").textContent = formatPercent(
    (visual.demand / visual.supply) * 100,
  );
  document.getElementById("capacity-gap-share").textContent =
    visual.excess > 0
      ? "超出能力"
      : formatPercent((visual.gap / visual.supply) * 100);
  const graphic = document.getElementById("peak-balance-chart");
  graphic.setAttribute(
    "aria-label",
    `同日預估尖峰供需：需求 ${formatMw(visual.demand, 0)}，可供電能力 ${formatMw(visual.supply, 0)}；能力減需求 ${formatMw(visual.supply - visual.demand, 0)}。此圖不是即時剩餘電量，亦不是備轉率。`,
  );
  const current = freshness.state === "live";
  elements.loadCaption.textContent = current
    ? "來源時點實際用電"
    : "快照用電（非目前）";
  elements.outputCaption.textContent = current
    ? "來源時點機組淨輸出"
    : "快照機組淨輸出";
  elements.currentLoad.textContent = formatMw(model.metrics.currentLoadMw, 0);
  elements.currentOutput.textContent = formatMw(
    model.metrics.totalGenerationMw,
    0,
  );
  elements.loadSourceLabel.textContent = `${formatDateTime(model.feeds.supply.observedAt)} · 台灣`;
  elements.activeUnits.textContent = `${model.generation.totals.activeUnitCount}/${model.generation.totals.unitCount} 組有輸出 · ${formatDateTime(model.feeds.generation.observedAt)}`;
  const mix = getPositiveMix(model.categories);
  const major = mix.slice(0, 4);
  const rest = mix.slice(4).reduce((sum, c) => sum + c.positiveShare, 0);
  elements.mixGlance.innerHTML = `<div class="mix-keys">${major.map((c) => `<span><i style="background:${getFuelColor(c.key)}" aria-hidden="true"></i>${escapeHtml(c.labelZh)}<b>${formatPercent(c.positiveShare)}</b></span>`).join("")}${rest > 0 ? `<span><i style="background:#81949e" aria-hidden="true"></i>其餘正輸出<b>${formatPercent(rest)}</b></span>` : ""}</div>`;
  document
    .getElementById("glance-mix-chart")
    .setAttribute(
      "aria-label",
      `正輸出發電結構：${mix.map((c) => `${c.labelZh} ${formatPercent(c.positiveShare)}`).join("，")}。機組淨輸出另列，不以可供電能力為分母。`,
    );
}

function statCard({ value, unit, label, tone, detail, time }) {
  return `
    <article class="stat-card stat-card--${tone}">
      <p class="stat-card__label">${escapeHtml(label)}</p>
      <div class="stat-card__value">
        <span>${value}</span>
        <small>${unit}</small>
      </div>
      <p class="stat-card__detail">${escapeHtml(detail)}</p>
      <p class="stat-card__time">${escapeHtml(time)}</p>
    </article>
  `;
}

function renderStats(model, freshness) {
  const { metrics, supply, generation } = model;
  const timeLabel = freshness.state === "live" ? "目前" : "快照";
  const supplyTime = formatDateTime(model.feeds.supply.observedAt);
  const generationTime = formatDateTime(model.feeds.generation.observedAt);

  elements.statsGrid.innerHTML = [
    statCard({
      icon: "bi-lightning-charge-fill",
      value: formatNumber(metrics.currentLoadMw, 0),
      unit: "MW",
      label: `${timeLabel}用電`,
      tone: "primary",
      detail: `負載率 ${formatPercent(metrics.currentUtilizationPercent, 0)}`,
      time: supplyTime,
    }),
    statCard({
      icon: "bi-diagram-3-fill",
      value: formatNumber(metrics.totalGenerationMw, 0),
      unit: "MW",
      label: `${timeLabel}淨發電量`,
      tone: "info",
      detail: `${generation.totals.activeUnitCount}/${generation.totals.unitCount} 組機組有輸出`,
      time: generationTime,
    }),
    statCard({
      icon: "bi-flower1",
      value: formatNumber(metrics.renewableSharePercent),
      unit: "%",
      label: `${timeLabel}再生能源占比`,
      tone: "warning",
      detail: `再生能源發電 ${formatMw(metrics.renewableGenerationMw)}`,
      time: generationTime,
    }),
    statCard({
      icon: "bi-clock-history",
      value: formatNumber(supply.yesterdayReserveRatePercent),
      unit: "%",
      label: "尖峰備轉實績",
      tone: "muted",
      detail: `尖峰需求 ${formatMw(supply.yesterdayPeakDemandMw)}`,
      time: formatRocDate(supply.yesterdayDateText),
    }),
  ].join("");
}

function renderCategories(model) {
  const positiveShares = new Map(
    getPositiveMix(model.categories).map((category) => [category.key, category.positiveShare]),
  );

  elements.categoryGrid.innerHTML = model.categories
    .map((category) => {
      const width = positiveShares.get(category.key) || 0;
      const shareLabel = !Number.isFinite(category.netGenerationMw)
        ? "輸出未知，不計入占比"
        : category.netGenerationMw < 0
          ? "負載，不計入占比"
          : `正輸出占比 ${formatPercent(width)}`;
      const netClass =
        category.netGenerationMw < 0 ? "category-card__value--negative" : "";
      const label = escapeHtml(category.labelZh);
      const color = getFuelColor(category.key);

      return `
        <article class="category-card">
          <div class="category-card__header">
            <span class="category-card__icon" style="background:${color}">
              <i class="bi ${category.icon}" aria-hidden="true"></i>
            </span>
            <div>
              <h3>${label}</h3>
              <p>${category.activeUnitCount}/${category.unitCount} 組輸出</p>
            </div>
          </div>
          <div class="category-card__value ${netClass}">${formatMw(category.netGenerationMw)}</div>
          <div class="category-card__bar" aria-hidden="true">
            <span style="width:${width}%; background:${color}"></span>
          </div>
          <div class="category-card__meta">
            <span>${shareLabel}</span>
            <span>容量 ${formatMw(category.capacityMw)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTables(model) {
  elements.topUnitsBody.innerHTML = model.topUnits
    .map(
      (unit, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><span class="unit-type" style="--unit-color:${getFuelColor(unit.categoryKey)}">${escapeHtml(unit.name)}</span></td>
        <td>${escapeHtml(unit.type)}</td>
        <td>${formatMw(unit.netGenerationMw)}</td>
        <td>${Number.isFinite(unit.utilizationPercent) ? formatPercent(unit.utilizationPercent) : "--"}</td>
      </tr>
    `,
    )
    .join("");

  if (model.constrainedUnits.length === 0) {
    elements.constrainedUnits.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-check-circle" aria-hidden="true"></i>
        <h3>未列出限制或檢修備註</h3>
        <p>目前取回資料中沒有可顯示的機組備註。</p>
      </div>
    `;
    return;
  }

  elements.constrainedUnits.innerHTML = model.constrainedUnits
    .map(
      (unit) => `
      <article class="alert-card">
        <div class="alert-card__header">
          <i class="bi bi-tools" aria-hidden="true"></i>
          <div>
            <h3>${escapeHtml(unit.name)}</h3>
            <p>${escapeHtml(unit.type)}</p>
          </div>
        </div>
        <p class="alert-card__note">${escapeHtml(unit.note)}</p>
        <div class="alert-card__meta">
          <span>${formatMw(unit.netGenerationMw)}</span>
          <span>容量 ${formatMw(unit.capacityMw)}</span>
        </div>
      </article>
    `,
    )
    .join("");
}

function renderCharts(model) {
  const balance = chartManager.createPeakBalanceChart(
    "peak-balance-chart",
    getCapacityBalance(model.metrics),
  );
  const glance = chartManager.createGlanceMixChart(
    "glance-mix-chart",
    getPositiveMix(model.categories),
  );
  document.getElementById("balance-chart-fallback").hidden = Boolean(balance);
  document.getElementById("glance-chart-fallback").hidden = Boolean(glance);

  const fuelChart = chartManager.createFuelMixChart(
    "fuel-mix-chart",
    model.categories,
  );
  const categoryChart = chartManager.createCategoryBarChart(
    "category-bar-chart",
    model.categories,
  );

  elements.fuelChart.hidden = !fuelChart;
  elements.fuelChartFallback.hidden = Boolean(fuelChart);
  elements.categoryChart.hidden = !categoryChart;
  elements.categoryChartFallback.hidden = Boolean(categoryChart);
}

function render(result) {
  appState.result = result;
  setDataContentVisible(true);
  renderTrustState(result);
  renderHero(result.model, result.freshness);
  renderStats(result.model, result.freshness);
  renderCharts(result.model);
  renderCategories(result.model);
  renderTables(result.model);
}

function renderUnavailable(result) {
  appState.result = result;
  setDataContentVisible(false);
  chartManager.destroy("peak-balance-chart");
  chartManager.destroy("glance-mix-chart");
  chartManager.destroy("fuel-mix-chart");
  chartManager.destroy("category-bar-chart");
  renderTrustState(result);
}

const freshnessClock = createFreshnessClock({
  getResult: () => appState.result,
  onFreshnessChange: (freshness, result) => {
    const agedResult = {
      ...result,
      freshness,
      metadata: freshness.usable
        ? result.metadata
        : {
            ...result.metadata,
            reason:
              freshness.reasons.join("；") || "最後成功資料已無法安全呈現。",
          },
    };

    if (!freshness.usable) {
      renderUnavailable(agedResult);
      return;
    }
    if (!result.freshness?.usable) {
      render(agedResult);
      return;
    }

    appState.result = agedResult;
    renderTrustState(agedResult);
    renderHero(agedResult.model, freshness);
    renderStats(agedResult.model, freshness);
  },
});

async function loadDashboard(force = false) {
  if (appState.loading) return;

  const previousResult = appState.result;
  setLoading(true);
  if (force) {
    elements.refreshFeedback.hidden = false;
    elements.refreshFeedback.textContent = "正在重新檢查官方來源時間…";
  }
  try {
    const result = await powerAPI.fetchDashboard({ force });
    if (force && result.model) {
      result.refreshOutcome = getRefreshOutcome(previousResult, result);
    }

    if (result.model && result.freshness?.usable) {
      render(result);
    } else {
      renderUnavailable(result);
    }
  } catch (error) {
    console.error("Dashboard render failed", error);
    renderUnavailable({
      model: null,
      transport: "unavailable",
      freshness: { state: "unavailable", usable: false, sources: {} },
      metadata: { reason: "頁面無法安全呈現資料，請稍後再試。" },
    });
  } finally {
    setLoading(false);
    if (force) {
      elements.refreshFeedback.textContent = getRefreshFeedback(appState.result);
    }
    hideLoadingScreen();
  }
}

function startAutoRefresh() {
  window.clearInterval(appState.autoRefreshId);
  appState.autoRefreshId = window.setInterval(() => {
    loadDashboard(true);
  }, autoRefreshMs);
}

function bindEvents() {
  elements.refreshBtn.addEventListener("click", () => loadDashboard(true));
  elements.retryDataBtn.addEventListener("click", () => loadDashboard(true));

  elements.scrollToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    elements.scrollToTop.classList.toggle("visible", window.scrollY > 600);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") freshnessClock.tick();
  });
  window.addEventListener("focus", freshnessClock.tick);
  window.addEventListener("pageshow", freshnessClock.tick);
}

bindEvents();
loadDashboard();
startAutoRefresh();
freshnessClock.start();
