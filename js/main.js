import { powerAPI } from './api.js';
import { chartManager } from './charts.js';
import { escapeHtml } from './sanitize.js';

const autoRefreshMs = 10 * 60 * 1000;

const elements = {
  loadingScreen: document.getElementById('loading-screen'),
  mainContainer: document.getElementById('main-container'),
  refreshBtn: document.getElementById('refresh-btn'),
  lastUpdateTime: document.getElementById('last-update-time'),
  sourceStatus: document.getElementById('source-status'),
  noticeBanner: document.getElementById('notice-banner'),
  healthIcon: document.getElementById('health-icon'),
  healthLabel: document.getElementById('health-label'),
  healthDetail: document.getElementById('health-detail'),
  reserveBlock: document.querySelector('.reserve-block'),
  reserveMeterValue: document.getElementById('reserve-meter-value'),
  reserveLevelBadge: document.getElementById('reserve-level-badge'),
  reserveSummary: document.getElementById('reserve-summary'),
  reserveDescription: document.getElementById('reserve-description'),
  reserveCapacity: document.getElementById('reserve-capacity'),
  peakDemand: document.getElementById('peak-demand'),
  reserveTierItems: document.querySelectorAll('.reserve-tier'),
  peakRange: document.getElementById('peak-range'),
  statsGrid: document.getElementById('stats-grid'),
  categoryGrid: document.getElementById('category-grid'),
  topUnitsBody: document.getElementById('top-units-body'),
  constrainedUnits: document.getElementById('constrained-units'),
  scrollToTop: document.getElementById('scroll-to-top')
};

const appState = {
  result: null,
  loading: false,
  autoRefreshId: null
};

function formatNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString('zh-TW', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatMw(value, digits = 1) {
  return `${formatNumber(value, digits)} MW`;
}

function formatPercent(value, digits = 1) {
  return `${formatNumber(value, digits)}%`;
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function setLoading(isLoading) {
  appState.loading = isLoading;
  elements.refreshBtn.disabled = isLoading;
  elements.refreshBtn.classList.toggle('loading', isLoading);
  elements.refreshBtn.setAttribute('aria-busy', String(isLoading));
}

function hideLoadingScreen() {
  elements.mainContainer.classList.remove('hidden');
  elements.loadingScreen.classList.add('loading-screen--hidden');

  window.setTimeout(() => {
    elements.loadingScreen.classList.add('hidden');
  }, 450);
}

function renderNotice(result) {
  const metadata = result.metadata || {};
  const sourceText = {
    'proxy-live': '台電官方資料 / 同源 API',
    'proxy-cache': '台電官方資料 / 伺服器快取',
    'static-snapshot': '台電官方資料 / GitHub Pages 靜態快照',
    'browser-cache': '台電官方資料 / 瀏覽器快取',
    'stale-browser-cache': '暫用瀏覽器舊資料',
    'direct-live': '台電官方資料 / 直接連線',
    sample: '內建樣本資料'
  }[result.transport] || '資料來源未知';

  elements.sourceStatus.textContent = sourceText;
  elements.noticeBanner.className = 'notice-banner';

  if (metadata.degraded || result.stale || result.transport === 'sample') {
    elements.noticeBanner.classList.add('notice-banner--warning');
    elements.noticeBanner.innerHTML = `
      <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
      <span>${escapeHtml(metadata.reason || '目前顯示降級資料，請稍後重新整理。')}</span>
    `;
  } else {
    elements.noticeBanner.classList.add('notice-banner--success');
    elements.noticeBanner.innerHTML = `
      <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
      <span>資料已從台電開放資料更新，頁面每 10 分鐘自動刷新。</span>
    `;
  }
}

function renderHero(model) {
  const { health, metrics, reserveGuide, supply } = model;

  elements.healthIcon.className = `bi ${health.icon}`;
  elements.healthIcon.style.color = health.color;
  elements.healthLabel.textContent = health.labelZh;
  elements.healthDetail.textContent = `今日尖峰備轉容量率 ${formatPercent(metrics.forecastReserveRatePercent)}，預估尖峰 ${supply.forecastPeakHourRange}`;
  elements.reserveMeterValue.textContent = formatPercent(metrics.forecastReserveRatePercent);
  elements.reserveBlock.style.setProperty('--reserve-color', health.color);
  elements.reserveBlock.dataset.level = reserveGuide.level;
  elements.reserveLevelBadge.textContent = reserveGuide.labelZh;
  elements.reserveLevelBadge.style.color = health.color;
  elements.reserveLevelBadge.style.borderColor = health.color;
  elements.reserveSummary.textContent = reserveGuide.summary;
  elements.reserveDescription.textContent = reserveGuide.description;
  elements.reserveTierItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.level === reserveGuide.level);
  });
  elements.peakRange.textContent = supply.forecastPeakHourRange;
  elements.reserveCapacity.textContent = formatMw(metrics.forecastReserveCapacityMw);
  elements.peakDemand.textContent = formatMw(metrics.forecastPeakDemandMw);
  elements.lastUpdateTime.textContent = formatDateTime(model.updatedAt);
}

function statCard({ icon, value, unit, label, tone, detail }) {
  return `
    <article class="stat-card stat-card--${tone}">
      <i class="bi ${icon} stat-card__icon" aria-hidden="true"></i>
      <div class="stat-card__value">
        <span>${value}</span>
        <small>${unit}</small>
      </div>
      <p class="stat-card__label">${label}</p>
      <p class="stat-card__detail">${detail}</p>
    </article>
  `;
}

function renderStats(model) {
  const { metrics, supply, generation } = model;

  elements.statsGrid.innerHTML = [
    statCard({
      icon: 'bi-lightning-charge-fill',
      value: formatNumber(metrics.currentLoadMw),
      unit: 'MW',
      label: '目前用電',
      tone: 'primary',
      detail: `負載率 ${formatPercent(metrics.currentUtilizationPercent, 0)}`
    }),
    statCard({
      icon: 'bi-shield-check',
      value: formatNumber(metrics.forecastReserveCapacityMw),
      unit: 'MW',
      label: '預估備轉容量',
      tone: 'success',
      detail: `尖峰需求 ${formatMw(metrics.forecastPeakDemandMw)}`
    }),
    statCard({
      icon: 'bi-diagram-3-fill',
      value: formatNumber(metrics.totalGenerationMw),
      unit: 'MW',
      label: '目前淨發電量',
      tone: 'info',
      detail: `${generation.totals.activeUnitCount}/${generation.totals.unitCount} 組機組有輸出`
    }),
    statCard({
      icon: 'bi-flower1',
      value: formatNumber(metrics.renewableSharePercent),
      unit: '%',
      label: '再生能源占比',
      tone: 'warning',
      detail: `低碳發電占比 ${formatPercent(metrics.lowCarbonSharePercent)}`
    }),
    statCard({
      icon: 'bi-clock-history',
      value: formatNumber(supply.yesterdayReserveRatePercent),
      unit: '%',
      label: '昨日尖峰備轉',
      tone: 'muted',
      detail: `${supply.yesterdayDateText} 尖峰 ${formatMw(supply.yesterdayPeakDemandMw)}`
    })
  ].join('');
}

function renderCategories(model) {
  const totalPositive = model.categories
    .filter((category) => category.netGenerationMw > 0)
    .reduce((sum, category) => sum + category.netGenerationMw, 0);

  elements.categoryGrid.innerHTML = model.categories
    .map((category) => {
      const width = totalPositive ? Math.max(0, (category.netGenerationMw / totalPositive) * 100) : 0;
      const netClass = category.netGenerationMw < 0 ? 'category-card__value--negative' : '';
      const label = escapeHtml(category.labelZh);

      return `
        <article class="category-card">
          <div class="category-card__header">
            <span class="category-card__icon" style="background:${category.color}">
              <i class="bi ${category.icon}" aria-hidden="true"></i>
            </span>
            <div>
              <h3>${label}</h3>
              <p>${category.activeUnitCount}/${category.unitCount} 組輸出</p>
            </div>
          </div>
          <div class="category-card__value ${netClass}">${formatMw(category.netGenerationMw)}</div>
          <div class="category-card__bar" aria-hidden="true">
            <span style="width:${Math.max(0, width)}%; background:${category.color}"></span>
          </div>
          <div class="category-card__meta">
            <span>占比 ${formatPercent(category.sharePercent)}</span>
            <span>容量 ${formatMw(category.capacityMw)}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderTables(model) {
  elements.topUnitsBody.innerHTML = model.topUnits
    .map((unit, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>
          <span class="unit-type" style="--unit-color:${unit.color}">${escapeHtml(unit.name)}</span>
        </td>
        <td>${escapeHtml(unit.type)}</td>
        <td>${formatMw(unit.netGenerationMw)}</td>
        <td>${unit.utilizationPercent === null ? '--' : formatPercent(unit.utilizationPercent)}</td>
      </tr>
    `)
    .join('');

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
    .map((unit) => `
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
    `)
    .join('');
}

function renderCharts(model) {
  chartManager.createFuelMixChart('fuel-mix-chart', model.categories);
  chartManager.createCategoryBarChart('category-bar-chart', model.categories);
}

function render(result) {
  const model = result.model;
  appState.result = result;

  renderNotice(result);
  renderHero(model);
  renderStats(model);
  renderCharts(model);
  renderCategories(model);
  renderTables(model);
}

async function loadDashboard(force = false) {
  if (appState.loading) return;

  setLoading(true);
  try {
    const result = await powerAPI.fetchDashboard({ force });
    render(result);
  } finally {
    setLoading(false);
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
  elements.refreshBtn.addEventListener('click', () => loadDashboard(true));

  elements.scrollToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', () => {
    elements.scrollToTop.classList.toggle('visible', window.scrollY > 600);
  });

  window.addEventListener('beforeunload', () => {
    window.clearInterval(appState.autoRefreshId);
  });
}

bindEvents();
loadDashboard();
startAutoRefresh();
