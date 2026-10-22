import { useMemo } from 'react';

import { convertPower, formatNumber, formatPercent } from '../../js/dashboard-presenter.js';
import { chartTokens, FONT_FAMILY, tooltipStyle } from '../lib/chart-theme.js';
import { readToken } from '../lib/tokens.js';
import { useUnit } from '../lib/units.jsx';
import { ChartCard } from './chart-card.jsx';
import { DeferredChart } from './deferred-chart.jsx';


const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

function dayLabel(dateKey) {
  const [, month, day] = dateKey.split('-');
  const weekday = new Date(`${dateKey}T12:00:00+08:00`).getUTCDay();
  return `${Number(month)}/${Number(day)}（${WEEKDAY[weekday]}）`;
}

// Colour by the official percentage bands. R/B depend on absolute MW, which the
// daily files do report, so those take precedence.
function levelToken(rate, reserveMw) {
  if (Number.isFinite(reserveMw) && reserveMw <= 500) return 'b';
  if (Number.isFinite(reserveMw) && reserveMw <= 900) return 'r';
  if (rate <= 6) return 'o';
  if (rate < 10) return 'y';
  return 'g';
}

function buildRows(curves, model, todayKey) {
  const past = (curves?.recentDays || [])
    .filter((day) => day.date < todayKey)
    .slice(-10)
    .map((day) => ({ ...day, kind: 'actual' }));
  const today = model
    ? [{
        date: todayKey,
        kind: 'today',
        reserveRatePercent: model.metrics.forecastReserveRatePercent,
        reserveMw: model.metrics.forecastReserveCapacityMw,
        peakLoadMw: model.metrics.forecastPeakDemandMw
      }]
    : [];
  const future = (curves?.forecast || [])
    .filter((day) => day.date > todayKey)
    .slice(0, 7)
    .map((day) => ({ ...day, kind: 'forecast' }));
  return [...past, ...today, ...future];
}

function buildOption(rows, unit, unitLabel) {
  const tokens = chartTokens();
  const statusColor = (token) => readToken(`--status-${token}-bg`);

  return {
    animationDuration: 400,
    aria: { enabled: true, decal: { show: false } },
    textStyle: { fontFamily: FONT_FAMILY },
    grid: { left: 4, right: 4, top: 24, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipStyle(tokens),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: tokens.grid } },
      formatter: ([item]) => {
        const row = rows[item.dataIndex];
        const tag = row.kind === 'actual' ? '實績' : row.kind === 'today' ? '今日預估' : '預測';
        return `<b>${dayLabel(row.date)}</b> · ${tag}<br/>尖峰備轉容量率 <b>${formatPercent(row.reserveRatePercent, 2)}</b><br/>備轉容量 ${formatNumber(convertPower(row.reserveMw, unit), unit === 'wan' ? 1 : 0)} ${unitLabel}${
          Number.isFinite(row.peakLoadMw) ? `<br/>尖峰負載 ${formatNumber(convertPower(row.peakLoadMw, unit), unit === 'wan' ? 1 : 0)} ${unitLabel}` : ''
        }`;
      }
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.date),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: tokens.border } },
      axisLabel: {
        color: tokens.muted,
        fontSize: 12,
        interval: 0,
        formatter: (dateKey, index) => {
          const [, month, day] = dateKey.split('-');
          return rows[index]?.kind === 'today' ? '今天' : `${Number(month)}/${Number(day)}`;
        },
        hideOverlap: true
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: tokens.muted, fontSize: 12, formatter: '{value}%' },
      splitLine: { lineStyle: { color: tokens.grid } }
    },
    series: [{
      type: 'bar',
      barMaxWidth: 26,
      data: rows.map((row) => {
        const color = statusColor(levelToken(row.reserveRatePercent, row.reserveMw));
        return {
          value: row.reserveRatePercent,
          itemStyle: {
            color: row.kind === 'forecast'
              ? { image: stripe(color), repeat: 'repeat' }
              : row.kind === 'today' ? `${color}55` : color,
            borderColor: color,
            borderWidth: row.kind === 'actual' ? 0 : 1.5,
            borderRadius: [4, 4, 0, 0],
            opacity: row.kind === 'actual' ? 0.85 : 1
          }
        };
      }),
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          { yAxis: 10, lineStyle: { color: statusColor('g'), type: [5, 4] }, label: { show: false } },
          { yAxis: 6, lineStyle: { color: statusColor('o'), type: [5, 4] }, label: { show: false } }
        ]
      }
    }]
  };
}

// Diagonal hatching marks forecasts without relying on colour (CAISO practice).
const stripeCache = new Map();
function stripe(color) {
  if (typeof document === 'undefined') return color;
  if (stripeCache.has(color)) return stripeCache.get(color);
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext('2d');
  if (!context) return color;
  context.globalAlpha = 0.28;
  context.fillStyle = color;
  context.fillRect(0, 0, 8, 8);
  context.globalAlpha = 1;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-2, 10);
  context.lineTo(10, -2);
  context.stroke();
  stripeCache.set(color, canvas);
  return canvas;
}

export function ReserveTrendCard({ curves, model, todayKey, theme }) {
  const { unit, unitLabel } = useUnit();
  const rows = useMemo(() => buildRows(curves, model, todayKey), [curves, model, todayKey]);
  const option = useMemo(
    () => (rows.length > 1 ? buildOption(rows, unit, unitLabel) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, unit, unitLabel, theme]
  );

  if (!option) {
    return (
      <ChartCard id="trend" title="備轉容量率：近期實績與未來一週" summary="每日尖峰備轉容量率資料目前無法取得。">
        <p className="rounded-xl bg-muted px-4 py-8 text-center text-base text-muted-foreground">資料暫時無法取得。</p>
      </ChartCard>
    );
  }

  const digits = unit === 'wan' ? 1 : 0;
  const kindLabel = { actual: '實績', today: '今日預估', forecast: '預測' };
  const columns = [
    { key: 'date', label: '日期' },
    { key: 'kind', label: '類型' },
    { key: 'rate', label: '尖峰備轉容量率', numeric: true },
    { key: 'reserve', label: `備轉容量（${unitLabel}）`, numeric: true },
    { key: 'peak', label: `尖峰負載（${unitLabel}）`, numeric: true }
  ];
  const tableRows = rows.map((row) => ({
    date: dayLabel(row.date),
    kind: kindLabel[row.kind],
    rate: formatPercent(row.reserveRatePercent, 2),
    reserve: formatNumber(convertPower(row.reserveMw, unit), digits),
    peak: Number.isFinite(row.peakLoadMw) ? formatNumber(convertPower(row.peakLoadMw, unit), digits) : '--'
  }));
  const lowestFuture = rows.filter((row) => row.kind === 'forecast')
    .reduce((min, row) => (!min || row.reserveRatePercent < min.reserveRatePercent ? row : min), null);

  return (
    <ChartCard
      id="trend"
      title="備轉容量率：近期實績與未來一週"
      summary={lowestFuture
        ? `實心為已發生的每日尖峰實績，斜線為台電的未來一週預測。未來七天最低預估是 ${dayLabel(lowestFuture.date)} 的 ${formatPercent(lowestFuture.reserveRatePercent, 1)}。`
        : '實心為已發生的每日尖峰實績，外框為今日預估。'}
      table={{ columns, rows: tableRows }}
      csv={{
        filename: `taipower-reserve-${todayKey}.csv`,
        header: ['日期', '類型', '尖峰備轉容量率(%)', '備轉容量(MW)', '尖峰負載(MW)'],
        rows: rows.map((row) => [row.date, kindLabel[row.kind], row.reserveRatePercent, row.reserveMw, row.peakLoadMw ?? ''])
      }}
      meta="台電每日尖峰備轉（d006002）· 未來一週供需預測（d006007）"
      footnote="過去日期的尖峰負載由「備轉容量 ÷ 備轉容量率」推算，與台電公布值誤差在 1 MW 等級。"
    >
      <div className="h-[300px] sm:h-[340px]">
        <DeferredChart option={option} className="h-full w-full" ariaLabel="每日尖峰備轉容量率長條圖，完整數值請切換為表格檢視。" />
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="圖例">
        <li className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-status-g" aria-hidden="true" />實績</li>
        <li className="flex items-center gap-2"><span className="size-2.5 rounded-sm border-[1.5px] border-status-g bg-status-g/30" aria-hidden="true" />今日預估</li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm border-[1.5px] border-status-g bg-[repeating-linear-gradient(135deg,var(--status-g)_0_1.5px,transparent_1.5px_4px)]" aria-hidden="true" />預測
        </li>
        <li className="flex items-center gap-2"><span className="h-0 w-4 border-t-2 border-dashed border-status-g" aria-hidden="true" />10% 充裕門檻</li>
      </ul>
    </ChartCard>
  );
}
