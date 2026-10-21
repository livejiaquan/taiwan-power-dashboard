import { ExternalLink } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';

import { convertPower, formatAge, formatNumber } from '../../js/dashboard-presenter.js';
import { AREA_KEYS, FUEL_CURVE_KEYS } from '../../js/power-curves.js';
import { chartTokens, FONT_FAMILY, tooltipStyle } from '../lib/chart-theme.js';
import { fuelColorByKey, fuelLabel, fuelStyle } from '../lib/fuel.js';
import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';
import { ChartCard } from './chart-card.jsx';
import { Segmented } from './ui/segmented.jsx';

const EChart = lazy(() => import('./echart.jsx'));

const AREA_STYLE = {
  north: { label: '北部', color: '#3b6fd8' },
  central: { label: '中部', color: '#22a06b' },
  south: { label: '南部', color: '#e8a33a' },
  east: { label: '東部', color: '#a35fd6' }
};

// Bottom-to-top stacking from baseload to variable output; charging sits below 0.
const STACK_ORDER = [...FUEL_CURVE_KEYS]
  .filter((key) => key !== 'storage-load')
  .sort((a, b) => fuelStyle(a).order - fuelStyle(b).order);

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(dateKey) {
  return new Date(`${dateKey}T00:00:00+08:00`).getTime();
}

function peakBand(dateKey, range) {
  const match = /^(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})$/.exec(range || '');
  if (!match) return null;
  const start = dayStart(dateKey);
  return [
    start + (Number(match[1]) * 60 + Number(match[2])) * 60000,
    start + (Number(match[3]) * 60 + Number(match[4])) * 60000
  ];
}

function clock(ms) {
  return new Date(ms).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildOption({ curves, model, mode, showYesterday, unit, unitLabel }) {
  const tokens = chartTokens();
  const today = curves.today;
  const start = dayStart(today.date);
  const value = (mw) => {
    const converted = convertPower(mw, unit);
    return converted === null ? null : Number(converted.toFixed(unit === 'wan' ? 1 : 0));
  };
  const last = today.points.at(-1);
  const lastMs = new Date(last.at).getTime();
  const band = peakBand(today.date, model?.supply?.forecastPeakHourRange);
  const series = [];

  if (mode === 'fuel') {
    for (const key of STACK_ORDER) {
      const color = fuelColorByKey(key);
      series.push({
        name: fuelLabel(key),
        type: 'line',
        stack: 'generation',
        symbol: 'none',
        lineStyle: { width: 0 },
        areaStyle: { color, opacity: 0.92 },
        color,
        emphasis: { focus: 'series' },
        data: today.points.map((point) => [new Date(point.at).getTime(), value(point.fuels[key])])
      });
    }
    series.push({
      name: fuelLabel('storage-load'),
      type: 'line',
      stack: 'charging',
      symbol: 'none',
      lineStyle: { width: 0 },
      areaStyle: { color: fuelColorByKey('storage-load'), opacity: 0.9 },
      color: fuelColorByKey('storage-load'),
      data: today.points.map((point) => [new Date(point.at).getTime(), value(point.fuels['storage-load'])])
    });
  } else if (curves.areas) {
    for (const key of [...AREA_KEYS].reverse()) {
      const style = AREA_STYLE[key];
      series.push({
        name: style.label,
        type: 'line',
        stack: 'areas',
        symbol: 'none',
        lineStyle: { width: 0 },
        areaStyle: { color: style.color, opacity: 0.9 },
        color: style.color,
        data: curves.areas.points.map((point) => [new Date(point.at).getTime(), value(point.areas[key])])
      });
    }
  }

  // Total load as a crisp outline over the stack, ending at the latest point.
  series.push({
    name: '總負載',
    type: 'line',
    symbol: 'none',
    color: tokens.foreground,
    lineStyle: { width: 1.6, color: tokens.foreground },
    z: 5,
    data: today.points.map((point) => [new Date(point.at).getTime(), value(point.loadMw)]),
    markLine: {
      silent: true,
      symbol: 'none',
      animation: false,
      data: [
        {
          xAxis: lastMs,
          lineStyle: { color: tokens.foreground, type: 'solid', width: 1, opacity: 0.55 },
          label: { formatter: `最新 ${last.time}`, position: 'end', color: tokens.foreground, fontSize: 11, fontWeight: 600, fontFamily: FONT_FAMILY }
        },
        ...(Number.isFinite(model?.metrics?.forecastPeakDemandMw) ? [{
          yAxis: value(model.metrics.forecastPeakDemandMw),
          lineStyle: { color: tokens.muted, type: [6, 4], width: 1.2 },
          label: { formatter: '預估尖峰負載', position: 'insideStartTop', color: tokens.muted, fontSize: 11, fontFamily: FONT_FAMILY }
        }] : []),
        ...(Number.isFinite(model?.metrics?.forecastMaxSupplyCapacityMw) ? [{
          yAxis: value(model.metrics.forecastMaxSupplyCapacityMw),
          lineStyle: { color: '#16a34a', type: [2, 3], width: 1.4 },
          label: { formatter: '今日最大供電能力', position: 'insideStartTop', color: '#16a34a', fontSize: 11, fontFamily: FONT_FAMILY }
        }] : [])
      ]
    },
    markArea: {
      silent: true,
      data: [
        // Hours after the latest point have no actual data yet.
        [{ xAxis: lastMs, itemStyle: { color: tokens.grid, opacity: 0.55 } }, { xAxis: start + DAY_MS }],
        ...(band ? [[
          { xAxis: band[0], itemStyle: { color: '#f59e0b', opacity: 0.08 }, label: { show: true, formatter: '預估尖峰時段', position: 'insideTop', color: tokens.muted, fontSize: 11, fontFamily: FONT_FAMILY } },
          { xAxis: band[1] }
        ]] : [])
      ]
    }
  });

  if (showYesterday && curves.yesterday) {
    series.push({
      name: '昨日負載',
      type: 'line',
      symbol: 'none',
      color: tokens.muted,
      lineStyle: { width: 1.4, type: [5, 4], color: tokens.muted },
      z: 4,
      data: curves.yesterday.points.map((point) => [new Date(point.at).getTime() + DAY_MS, value(point.loadMw)])
    });
  }

  return {
    animationDuration: 400,
    aria: { enabled: true },
    textStyle: { fontFamily: FONT_FAMILY },
    grid: { left: 4, right: 12, top: 30, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipStyle(tokens),
      trigger: 'axis',
      order: 'seriesDesc',
      axisPointer: { type: 'line', lineStyle: { color: tokens.subtle } },
      formatter: (items) => {
        const visible = items.filter((item) => item.value?.[1] !== null && item.value?.[1] !== undefined);
        if (!visible.length) return '';
        const time = clock(visible[0].value[0]);
        const rows = visible
          .filter((item) => item.seriesName !== '總負載' && item.seriesName !== '昨日負載')
          .filter((item) => Math.abs(item.value[1]) > 0)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((item) => `<div style="display:flex;gap:12px;justify-content:space-between"><span>${item.marker}${item.seriesName}</span><b style="font-variant-numeric:tabular-nums">${formatNumber(item.value[1], unit === 'wan' ? 1 : 0)}</b></div>`)
          .join('');
        const total = visible.find((item) => item.seriesName === '總負載');
        const yesterday = visible.find((item) => item.seriesName === '昨日負載');
        return `<div style="min-width:180px"><div style="margin-bottom:6px;font-weight:600">${time} · 單位：${unitLabel}</div>${
          total ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>總負載</span><b style="font-variant-numeric:tabular-nums">${formatNumber(total.value[1], unit === 'wan' ? 1 : 0)}</b></div>` : ''
        }${yesterday ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;opacity:.75"><span>昨日同時段</span><span style="font-variant-numeric:tabular-nums">${formatNumber(yesterday.value[1], unit === 'wan' ? 1 : 0)}</span></div>` : ''}${rows}</div>`;
      }
    },
    xAxis: {
      type: 'time',
      min: start,
      max: start + DAY_MS,
      interval: 3 * 60 * 60 * 1000,
      axisLine: { lineStyle: { color: tokens.border } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { color: tokens.muted, fontSize: 11, formatter: (ms) => clock(ms).replace('24:00', '00:00'), hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      // Leave just enough room below zero for storage charging.
      min: (extent) => (extent.min < 0 ? Math.floor(extent.min / (unit === 'wan' ? 100 : 1000)) * (unit === 'wan' ? 100 : 1000) : 0),
      axisLabel: { color: tokens.muted, fontSize: 11, formatter: (v) => formatNumber(v, 0) },
      splitLine: { lineStyle: { color: tokens.grid } }
    },
    series
  };
}

export function TodayCurveCard({ curves, model, theme, now = new Date() }) {
  const { unit, unitLabel } = useUnit();
  const [mode, setMode] = useState('fuel');
  const [showYesterday, setShowYesterday] = useState(true);
  const today = curves?.today;
  const effectiveMode = mode === 'area' && !curves?.areas ? 'fuel' : mode;

  const option = useMemo(
    () => (today ? buildOption({ curves, model, mode: effectiveMode, showYesterday, unit, unitLabel }) : null),
    // theme forces CSS tokens to be re-read after a switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curves, model, effectiveMode, showYesterday, unit, unitLabel, theme]
  );

  if (!today) {
    return (
      <ChartCard
        id="today"
        title="今日用電曲線"
        summary="台電每 10 分鐘公布今日燃料別用電曲線。本站這次未能取得，上方的即時數字不受影響。"
      >
        <div className="flex flex-col gap-5 text-[15px] leading-7 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          <p>
            台電的曲線檔目前只能從台電網站直接查看，本站的自動抓取暫時被拒絕。可以先到台電官網看今日與昨日的用電曲線。
          </p>
          <a
            href="https://www.taipower.com.tw/d006/loadGraph/loadGraph/load_briefing3.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 sm:self-auto"
          >
            台電今日用電曲線
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">（另開新視窗）</span>
          </a>
        </div>
      </ChartCard>
    );
  }

  const last = today.points.at(-1);
  const ageMinutes = Math.max(0, Math.round((now.getTime() - new Date(last.at).getTime()) / 60000));
  const peakPoint = today.points.reduce((max, point) => (point.loadMw > max.loadMw ? point : max), today.points[0]);
  const yesterdaySameTime = curves.yesterday?.points.find((point) => point.time === last.time);
  const digits = unit === 'wan' ? 1 : 0;
  const fmt = (mw) => formatNumber(convertPower(mw, unit), digits);
  const stale = ageMinutes > 60;

  const legendKeys = effectiveMode === 'fuel'
    ? [...STACK_ORDER].reverse().filter((key) => today.points.some((point) => Math.abs(point.fuels[key]) > 0))
    : null;

  const columns = [
    { key: 'time', label: '時間' },
    { key: 'load', label: `總負載（${unitLabel}）`, numeric: true },
    ...[...STACK_ORDER, 'storage-load'].map((key) => ({ key, label: fuelLabel(key), numeric: true }))
  ];
  const rows = [...today.points].reverse().map((point) => ({
    time: point.time,
    load: fmt(point.loadMw),
    ...Object.fromEntries([...STACK_ORDER, 'storage-load'].map((key) => [key, fmt(point.fuels[key])]))
  }));

  const summary = `今天到 ${last.time} 為止的用電，依燃料別堆疊；虛線是昨日同時段負載，水平線是台電公布的預估尖峰負載與最大供電能力。`;

  return (
    <ChartCard
      id="today"
      title="今日用電曲線"
      summary={summary}
      controls={(
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="堆疊方式"
            value={effectiveMode}
            onChange={setMode}
            options={[
              { value: 'fuel', label: '燃料別' },
              { value: 'area', label: '區域別', disabled: !curves.areas }
            ]}
          />
          {curves.yesterday && (
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-[13px] font-semibold">
              <input
                type="checkbox"
                checked={showYesterday}
                onChange={(event) => setShowYesterday(event.target.checked)}
                className="size-3.5 accent-[var(--accent)]"
              />
              昨日對照
            </label>
          )}
        </div>
      )}
      table={{ columns, rows }}
      csv={{
        filename: `taipower-load-${today.date}.csv`,
        header: ['時間', '總負載(MW)', ...[...STACK_ORDER, 'storage-load'].map((key) => `${fuelLabel(key)}(MW)`)],
        rows: today.points.map((point) => [
          `${today.date} ${point.time}`,
          point.loadMw,
          ...[...STACK_ORDER, 'storage-load'].map((key) => point.fuels[key])
        ])
      }}
      meta={`曲線資料至 ${last.time}（${formatAge(ageMinutes)}）· 台電今日用電曲線`}
      footnote="燃氣、燃煤含民營電廠。儲能充電為負值畫在 0 以下。台電未公布全天預測曲線，因此以預估尖峰負載與時段呈現。"
    >
      <dl className="mb-8 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <div className="border-l-2 border-border pl-4">
          <dt className="text-[13px] text-muted-foreground">最新總負載 · {last.time}</dt>
          <dd className="num mt-1.5 text-2xl font-bold tracking-tight">{fmt(last.loadMw)} <span className="text-xs font-semibold text-muted-foreground">{unitLabel}</span></dd>
        </div>
        <div className="border-l-2 border-border pl-4">
          <dt className="text-[13px] text-muted-foreground">今日目前最高 · {peakPoint.time}</dt>
          <dd className="num mt-1.5 text-2xl font-bold tracking-tight">{fmt(peakPoint.loadMw)} <span className="text-xs font-semibold text-muted-foreground">{unitLabel}</span></dd>
        </div>
        <div className="border-l-2 border-border pl-4">
          <dt className="text-[13px] text-muted-foreground">較昨日同時段</dt>
          <dd className="num mt-1.5 text-2xl font-bold tracking-tight">
            {yesterdaySameTime ? `${last.loadMw >= yesterdaySameTime.loadMw ? '+' : '−'}${fmt(Math.abs(last.loadMw - yesterdaySameTime.loadMw))}` : '--'}
            {yesterdaySameTime && <span className="text-xs font-semibold text-muted-foreground"> {unitLabel}</span>}
          </dd>
        </div>
        <div className="border-l-2 border-border pl-4">
          <dt className="text-[13px] text-muted-foreground">預估尖峰 · {model?.supply?.forecastPeakHourRange || '--'}</dt>
          <dd className="num mt-1.5 text-2xl font-bold tracking-tight">{fmt(model?.metrics?.forecastPeakDemandMw)} <span className="text-xs font-semibold text-muted-foreground">{unitLabel}</span></dd>
        </div>
      </dl>

      {stale && (
        <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          曲線最後一筆是 {formatAge(ageMinutes)}，不代表目前用電。
        </p>
      )}

      <div className={cn('h-[320px] sm:h-[400px]', stale && 'opacity-70 grayscale')}>
        <Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-muted" />}>
          <EChart
            option={option}
            className="h-full w-full"
            ariaLabel={`今日用電曲線，${summary}最新 ${last.time} 總負載 ${fmt(last.loadMw)} ${unitLabel}。完整數值請切換為表格檢視。`}
          />
        </Suspense>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground" aria-label="圖例">
        {(legendKeys || [...AREA_KEYS].reverse()).map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: legendKeys ? fuelColorByKey(key) : AREA_STYLE[key].color }}
              aria-hidden="true"
            />
            {legendKeys ? fuelLabel(key) : AREA_STYLE[key].label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-foreground" aria-hidden="true" />總負載
        </li>
        {showYesterday && curves.yesterday && (
          <li className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden="true" />昨日負載
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dotted border-[#16a34a]" aria-hidden="true" />最大供電能力
        </li>
      </ul>
    </ChartCard>
  );
}
