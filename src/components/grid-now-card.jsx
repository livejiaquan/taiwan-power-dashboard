import { formatMw, formatNumber, formatPercent, getPositiveCategories } from '../../js/dashboard-presenter.js';
import { fuelColor, fuelStyle, GROUP_LABEL, sortByFuelOrder } from '../lib/fuel.js';
import { Card } from './ui/card.jsx';
import { Tooltip } from './ui/tooltip.jsx';

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

// The "where is the power coming from right now" view: one 100% bar ordered
// fossil → nuclear → renewables → storage, the convention used by most grid
// dashboards, so the clean share reads as the right-hand portion of the bar.
export function GridNowCard({ model, timeLabel }) {
  const { metrics, supply } = model;
  const categories = sortByFuelOrder(getPositiveCategories(model));
  const total = categories.reduce((sum, category) => sum + category.netGenerationMw, 0);
  const groups = groupShares(categories, total);
  const utilization = Math.min(100, Math.max(0, metrics.currentUtilizationPercent));

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{timeLabel}用電負載</p>
          <p className="num mt-1 text-4xl font-bold tracking-tight sm:text-[44px]">
            {formatNumber(metrics.currentLoadMw, 0)}
            <span className="ml-1.5 text-lg font-semibold text-muted-foreground">MW</span>
          </p>
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>使用率（負載 ÷ 當下最大供電能力）</span>
              <span className="num font-semibold text-foreground">{formatPercent(metrics.currentUtilizationPercent, 0)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full bg-accent" style={{ width: `${utilization}%` }} />
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-4">
          <div>
            <dt className="text-xs text-muted-foreground">{timeLabel}淨發電</dt>
            <dd className="num mt-1 text-[15px] font-semibold">{formatMw(metrics.totalGenerationMw, 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">再生能源占比</dt>
            <dd className="num mt-1 text-[15px] font-semibold text-status-g">{formatPercent(metrics.renewableSharePercent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">低碳占比</dt>
            <dd className="num mt-1 text-[15px] font-semibold">{formatPercent(metrics.lowCarbonSharePercent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">今日最大供電能力</dt>
            <dd className="num mt-1 text-[15px] font-semibold">{formatMw(metrics.forecastMaxSupplyCapacityMw, 0)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight">電從哪裡來</h3>
          <p className="text-xs text-muted-foreground">機組淨發電占比 · 正輸出合計 {formatMw(total, 0)}</p>
        </div>

        <div className="mt-3 flex h-9 w-full overflow-hidden rounded-lg" role="img" aria-label={`發電結構：${categories.map((c) => `${c.labelZh} ${formatPercent(share(c.netGenerationMw, total))}`).join('、')}`}>
          {categories.map((category) => (
            <Tooltip
              key={category.key}
              content={(
                <span className="num">
                  <strong>{category.labelZh}</strong> {formatMw(category.netGenerationMw)} · {formatPercent(share(category.netGenerationMw, total))}
                </span>
              )}
            >
              <span
                tabIndex={0}
                className="h-full min-w-[2px] border-r border-card last:border-r-0 focus-visible:outline-offset-[-2px]"
                style={{ width: `${share(category.netGenerationMw, total)}%`, background: fuelColor(category) }}
                aria-label={`${category.labelZh} ${formatPercent(share(category.netGenerationMw, total))}`}
              />
            </Tooltip>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {groups.map((group) => (
            <span key={group.group}>
              {group.label} <span className="num font-semibold text-foreground">{formatPercent(group.percent)}</span>
            </span>
          ))}
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          {categories.map((category) => (
            <li key={category.key} className="flex min-w-0 items-center gap-2 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: fuelColor(category) }} aria-hidden="true" />
              <span className="truncate">{category.labelZh}</span>
              <span className="num ml-auto font-medium">{formatPercent(share(category.netGenerationMw, total))}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-subtle-foreground">
          占比以正輸出合計為分母，不含儲能充電負載；與官方燈號同一份資料時間為 {supply.publishTimeText}。
        </p>
      </div>
    </Card>
  );
}
