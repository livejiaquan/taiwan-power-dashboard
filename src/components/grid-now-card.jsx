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
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd
        className={emphasis
          ? 'num mt-2 whitespace-nowrap text-[40px] font-bold leading-none tracking-tight sm:text-5xl'
          : 'num mt-2 whitespace-nowrap text-[28px] font-semibold leading-none tracking-tight sm:text-[32px]'}
      >
        {value}
        {unit && <span className="ml-1.5 text-base font-medium text-muted-foreground">{unit}</span>}
      </dd>
    </dl>
  );
}

function Operator({ icon: Icon, label }) {
  return (
    <span className="hidden pb-1.5 text-subtle-foreground sm:block">
      <Icon className="size-5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
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
    <Card className="p-6 sm:p-10">
      <div className="grid grid-cols-2 items-end gap-x-8 gap-y-8 sm:flex sm:flex-wrap sm:gap-x-10">
        <div className="col-span-2 sm:col-span-1">
          <Term label={`${timeLabel}用電負載`} value={powerValue(metrics.currentLoadMw)} unit={unitLabel} emphasis />
        </div>
        <Operator icon={Divide} label="除以" />
        <Term label="當下最大供電能力" value={powerValue(capacityMw)} unit={unitLabel} />
        <Operator icon={Equal} label="等於" />
        <Term label="使用率" value={formatPercent(metrics.currentUtilizationPercent, 0)} />
      </div>
      <div className="mt-8 h-2.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, metrics.currentUtilizationPercent))}%` }} />
      </div>

      <div className="mt-12 border-t border-border pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h3 className="text-lg font-semibold tracking-tight">電從哪裡來</h3>
          <p className="num text-[13px] text-muted-foreground">機組正輸出合計 {power(total)}</p>
        </div>

        <div
          className="mt-5 flex h-12 w-full overflow-hidden rounded-xl"
          role="img"
          aria-label={`發電結構：${categories.map((c) => `${c.labelZh} ${formatPercent(share(c.netGenerationMw, total))}`).join('、')}`}
        >
          {categories.map((category) => (
            <Tooltip
              key={category.key}
              content={<span className="num"><strong>{category.labelZh}</strong> {power(category.netGenerationMw)} · {formatPercent(share(category.netGenerationMw, total))}</span>}
            >
              <span
                className="h-full min-w-[3px] border-r-[3px] border-card last:border-r-0"
                style={{ width: `${share(category.netGenerationMw, total)}%`, background: fuelColor(category) }}
              />
            </Tooltip>
          ))}
        </div>

        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {groups.map((group) => (
            <span key={group.group}>
              {group.label} <span className="num font-semibold text-foreground">{formatPercent(group.percent)}</span>
            </span>
          ))}
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category.key} className="flex min-w-0 items-center gap-2.5 border-b border-border/70 pb-3 text-sm">
              <span className="size-3 shrink-0 rounded" style={{ background: fuelColor(category) }} aria-hidden="true" />
              <span className="truncate">{category.labelZh}</span>
              <span className="num ml-auto font-semibold">{formatPercent(share(category.netGenerationMw, total))}</span>
            </li>
          ))}
        </ul>
      </div>

      {latestArea && (
        <div className="mt-12 border-t border-border pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h3 className="text-lg font-semibold tracking-tight">各區用電</h3>
            <p className="num text-[13px] text-muted-foreground">{latestArea.time} · 台電區域別用電曲線</p>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
            {['north', 'central', 'south', 'east'].map((key) => (
              <div key={key}>
                <dt className="text-[13px] text-muted-foreground">{AREA_LABEL[key]}</dt>
                <dd className="num mt-1.5 text-xl font-semibold tracking-tight">{power(latestArea.areas[key])}</dd>
                <dd className="num mt-0.5 text-[13px] text-muted-foreground">{formatPercent(share(latestArea.areas[key], areaTotal))}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <p className="mt-10 text-[13px] leading-6 text-muted-foreground">
        資料時間 {supply.publishTimeText}。占比以機組正輸出合計為分母，不含儲能充電。
      </p>
    </Card>
  );
}
