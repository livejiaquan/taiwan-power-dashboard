import { Divide, Equal } from 'lucide-react';

import { formatPercent, getPositiveCategories } from '../../js/dashboard-presenter.js';
import { AREA_KEYS } from '../../js/power-curves.js';
import { fuelColor, fuelStyle, GROUP_LABEL, sortByFuelOrder } from '../lib/fuel.js';
import { useUnit } from '../lib/units.jsx';
import { Card } from './ui/card.jsx';
import { Tooltip } from './ui/tooltip.jsx';

const AREA_LABEL = { north: '北部', central: '中部', south: '南部', east: '東部' };

function share(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function groupShares(categories, total) {
  const groups = {};
  for (const category of categories) {
    const group = fuelStyle(category.key).group;
    groups[group] = (groups[group] || 0) + category.netGenerationMw;
  }
  return ['renewable', 'lowCarbon', 'fossil', 'storage', 'other']
    .filter((group) => groups[group] > 0)
    .map((group) => ({ group, label: GROUP_LABEL[group], percent: share(groups[group], total) }));
}

function Term({ label, value, unit, emphasis }) {
  return (
    <dl className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={emphasis ? 'num mt-1 whitespace-nowrap text-[32px] font-bold leading-none tracking-tight sm:text-4xl' : 'num mt-1 whitespace-nowrap text-xl font-semibold leading-none tracking-tight sm:text-2xl'}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </dd>
    </dl>
  );
}

// "Demand ÷ capacity = utilisation" written as an equation (grid.iamkate
// practice) so the relationship between the three headline numbers is explicit.
export function GridNowCard({ model, timeLabel, areas }) {
  const { powerValue, unitLabel, power } = useUnit();
  const { metrics, supply } = model;
  const capacityMw = supply.realHourMaxSupplyCapacityMw ?? metrics.forecastMaxSupplyCapacityMw;
  const categories = sortByFuelOrder(getPositiveCategories(model));
  const total = categories.reduce((sum, category) => sum + category.netGenerationMw, 0);
  const groups = groupShares(categories, total);
  const latestArea = areas?.points?.at(-1);
  const areaTotal = latestArea ? AREA_KEYS.reduce((sum, key) => sum + latestArea.areas[key], 0) : 0;

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <p className="text-[13px] font-medium text-muted-foreground">{timeLabel}用電狀況</p>
      <div className="mt-3 grid grid-cols-2 items-end gap-x-4 gap-y-4 sm:grid-cols-[auto_auto_auto_auto_auto]">
        <div className="col-span-2 sm:col-span-1">
          <Term label={`${timeLabel}用電負載`} value={powerValue(metrics.currentLoadMw)} unit={unitLabel} emphasis />
        </div>
        <span className="mb-1.5 hidden text-subtle-foreground sm:block"><Divide className="size-4" aria-hidden="true" /><span className="sr-only">除以</span></span>
        <Term label="當下最大供電能力" value={powerValue(capacityMw)} unit={unitLabel} />
        <span className="mb-1.5 hidden text-subtle-foreground sm:block"><Equal className="size-4" aria-hidden="true" /><span className="sr-only">等於</span></span>
        <div>
          <Term label="使用率" value={formatPercent(metrics.currentUtilizationPercent, 0)} />
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, metrics.currentUtilizationPercent))}%` }} />
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight">電從哪裡來</h3>
          <p className="num text-xs text-muted-foreground">正輸出合計 {power(total)}</p>
        </div>

        <div
          className="mt-3 flex h-10 w-full overflow-hidden rounded-lg"
          role="img"
          aria-label={`發電結構：${categories.map((c) => `${c.labelZh} ${formatPercent(share(c.netGenerationMw, total))}`).join('、')}`}
        >
          {categories.map((category) => (
            <Tooltip
              key={category.key}
              content={<span className="num"><strong>{category.labelZh}</strong> {power(category.netGenerationMw)} · {formatPercent(share(category.netGenerationMw, total))}</span>}
            >
              <span
                className="h-full min-w-[2px] border-r-2 border-card last:border-r-0"
                style={{ width: `${share(category.netGenerationMw, total)}%`, background: fuelColor(category) }}
              />
            </Tooltip>
          ))}
        </div>

        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {groups.map((group) => (
            <span key={group.group}>
              {group.label} <span className="num font-semibold text-foreground">{formatPercent(group.percent)}</span>
            </span>
          ))}
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
          {categories.map((category) => (
            <li key={category.key} className="flex min-w-0 items-center gap-2 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: fuelColor(category) }} aria-hidden="true" />
              <span className="truncate">{category.labelZh}</span>
              <span className="num ml-auto font-medium">{formatPercent(share(category.netGenerationMw, total))}</span>
            </li>
          ))}
        </ul>
      </div>

      {latestArea && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight">各區用電</h3>
            <p className="num text-xs text-muted-foreground">{latestArea.time} · 台電區域別用電曲線</p>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['north', 'central', 'south', 'east'].map((key) => (
              <li key={key} className="rounded-xl bg-muted px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{AREA_LABEL[key]}</p>
                <p className="num mt-0.5 text-[15px] font-semibold">{power(latestArea.areas[key])}</p>
                <p className="num text-xs text-muted-foreground">{formatPercent(share(latestArea.areas[key], areaTotal))}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-auto pt-5 text-xs text-muted-foreground">
        資料時間 {supply.publishTimeText}。占比以正輸出合計為分母，不含儲能充電。
      </p>
    </Card>
  );
}
