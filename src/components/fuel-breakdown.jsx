import { lazy, Suspense, useMemo, useState } from 'react';

import { formatPercent } from '../../js/dashboard-presenter.js';
import { fuelColor, sortByFuelOrder } from '../lib/fuel.js';
import { cn } from '../lib/utils.js';
import { readToken } from '../lib/tokens.js';
import { useUnit } from '../lib/units.jsx';
import { ChartCard } from './chart-card.jsx';
import { Segmented } from './ui/segmented.jsx';

// ECharts is the heaviest dependency; load it after the status cards render.
const EChart = lazy(() => import('./echart.jsx'));

function capacityFactor(category) {
  if (!Number.isFinite(category.capacityMw) || category.capacityMw <= 0) return null;
  if (!Number.isFinite(category.netGenerationMw)) return null;
  return Math.max(0, (category.netGenerationMw / category.capacityMw) * 100);
}

function tooltipBase() {
  return {
    backgroundColor: readToken('--popover'),
    borderColor: readToken('--border'),
    textStyle: { color: readToken('--popover-foreground'), fontFamily: 'Inter, "Noto Sans TC", sans-serif', fontSize: 12 },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgb(0 0 0 / .12);'
  };
}

function donutOption(categories, total, power) {
  return {
    animationDuration: 500,
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (item) => `<b>${item.name}</b><br/>${power(item.value)} · ${formatPercent(item.percent)}`
    },
    series: [{
      type: 'pie',
      radius: ['62%', '88%'],
      padAngle: 1.2,
      itemStyle: { borderRadius: 4, borderColor: readToken('--card'), borderWidth: 1 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: categories.map((category) => ({
        name: category.labelZh,
        value: category.netGenerationMw,
        itemStyle: { color: fuelColor(category) }
      }))
    }],
    graphic: [],
    title: { show: false },
    _total: total
  };
}

function factorOption(categories, power) {
  const rows = categories.filter((category) => capacityFactor(category) !== null).reverse();
  const muted = readToken('--muted-foreground');
  return {
    animationDuration: 500,
    grid: { left: 8, right: 48, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: ([item]) => {
        const category = rows[item.dataIndex];
        return `<b>${category.labelZh}</b><br/>輸出 ${power(category.netGenerationMw)} / 裝置 ${power(category.capacityMw)}<br/>容量使用率 ${formatPercent(item.value)}`;
      }
    },
    xAxis: { type: 'value', max: 100, show: false },
    yAxis: {
      type: 'category',
      data: rows.map((category) => category.labelZh),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 12 }
    },
    series: [{
      type: 'bar',
      barWidth: 12,
      showBackground: true,
      backgroundStyle: { color: readToken('--track'), borderRadius: 6 },
      itemStyle: { borderRadius: 6 },
      label: {
        show: true,
        position: 'right',
        color: readToken('--foreground'),
        fontSize: 12,
        formatter: (item) => formatPercent(item.value, 0)
      },
      data: rows.map((category) => ({
        value: Number(capacityFactor(category).toFixed(1)),
        itemStyle: { color: fuelColor(category) }
      }))
    }]
  };
}

export function FuelBreakdown({ model, theme }) {
  const { power, powerValue, unitLabel } = useUnit();
  const [view, setView] = useState('share');
  const ordered = useMemo(() => sortByFuelOrder(model.categories), [model.categories]);
  const positive = ordered.filter((category) => category.netGenerationMw > 0);
  const total = positive.reduce((sum, category) => sum + category.netGenerationMw, 0);

  const option = useMemo(
    () => (view === 'share' ? donutOption(positive, total, power) : factorOption(positive, power)),
    // theme is a dependency so colours are re-read from CSS tokens on switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, model, theme, power]
  );

  return (
    <ChartCard
      id="mix"
      title="發電結構"
      summary="依燃料別彙整台電各機組的即時淨發電量。切換「容量使用率」可看各燃料別目前發出的電佔其裝置容量的比例。"
      controls={(
        <Segmented
          label="圖表內容"
          value={view}
          onChange={setView}
          options={[{ value: 'share', label: '輸出占比' }, { value: 'factor', label: '容量使用率' }]}
        />
      )}
      csv={{
        filename: 'taipower-fuel-mix.csv',
        header: ['燃料別', '淨發電(MW)', '占比(%)', '裝置容量(MW)', '運轉機組', '機組數'],
        rows: ordered.map((category) => [
          category.labelZh,
          category.netGenerationMw,
          category.sharePercent,
          category.capacityMw ?? '',
          category.activeUnitCount,
          category.unitCount
        ])
      }}
      meta={`機組資料時間 ${model.generation?.updatedAt?.replace('T', ' ').slice(0, 16) || '--'}`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="relative h-[260px] self-center sm:h-[300px]">
          <Suspense fallback={<div className="mx-auto aspect-square h-full animate-pulse rounded-full bg-muted" />}>
            <EChart
              option={option}
              className="h-full w-full"
              ariaLabel={view === 'share' ? '燃料別輸出占比圓環圖' : '燃料別容量使用率長條圖'}
            />
          </Suspense>
          {view === 'share' && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-xs text-muted-foreground">正輸出合計</div>
                <div className="num text-2xl font-bold tracking-tight">{powerValue(total)}</div>
                <div className="text-xs text-muted-foreground">{unitLabel}</div>
              </div>
            </div>
          )}
        </div>

        <div className="-mx-5 overflow-x-auto sm:mx-0" role="region" aria-label="燃料別發電明細（可捲動表格）" tabIndex={0}>
          <table className="w-full min-w-[520px] text-[13px]">
            <caption className="sr-only">燃料別發電明細</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pl-5 pr-2 font-medium sm:pl-0">燃料別</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">淨發電</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">占比</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">裝置容量</th>
                <th scope="col" className="py-2 pl-2 pr-5 text-right font-medium sm:pr-0">運轉機組</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((category) => {
                const negative = category.netGenerationMw < 0;
                return (
                  <tr key={category.key} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-2.5 pl-5 pr-2 text-left font-medium sm:pl-0">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: fuelColor(category) }} aria-hidden="true" />
                        {category.labelZh}
                      </span>
                    </th>
                    <td className={cn('num px-2 py-2.5 text-right font-semibold', negative && 'text-muted-foreground')}>
                      {power(category.netGenerationMw)}
                    </td>
                    <td className="num px-2 py-2.5 text-right">
                      {negative ? '—' : formatPercent(category.sharePercent)}
                    </td>
                    <td className="num px-2 py-2.5 text-right text-muted-foreground">{power(category.capacityMw)}</td>
                    <td className="num py-2.5 pl-2 pr-5 text-right text-muted-foreground sm:pr-0">
                      {category.activeUnitCount}/{category.unitCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 px-5 text-xs text-subtle-foreground sm:px-0">
            儲能充電負載為負值，表示電池正在充電吸收電力，不計入占比。部分機組未公布裝置容量，容量合計僅含已知值。
          </p>
        </div>
      </div>
    </ChartCard>
  );
}
