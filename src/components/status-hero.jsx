import { describeReserveStatus, formatNumber, formatPercent, getPositiveCategories } from '../../js/dashboard-presenter.js';
import { fuelColor } from '../lib/fuel.js';
import { levelFor } from '../lib/status.js';
import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';
import { DataTime } from './data-time.jsx';
import { LampLegend } from './lamp-legend.jsx';

const SHORT_LABEL = { 'other-renewable': '其他再生', cogeneration: '汽電共生' };

function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-panel border border-border bg-card px-4 py-3', className)} {...props}>
      {children}
    </div>
  );
}

// Three tiles in a row: the official light as a solid colour square, then
// utilisation and renewable share as ring gauges.
function LampTile({ level, snapshot }) {
  const Icon = level?.icon;
  const key = snapshot || !level ? 'off' : level.token;
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="grid size-[76px] place-items-center rounded-panel"
        style={{ background: `var(--status-${key}-bg)`, color: `var(--status-${key}-on)` }}
      >
        {Icon && <Icon className="size-6" aria-hidden="true" />}
      </span>
      <span className="text-sm font-semibold text-muted-foreground">{level ? level.name : '燈號'}</span>
    </div>
  );
}

function RingTile({ value, label, color }) {
  const size = 76;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = 0.75; // open at the bottom
  const fraction = Math.max(0, Math.min(1, value / 100));
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="relative grid size-[76px] place-items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 rotate-[135deg]" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference * sweep} ${circumference}`} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference * sweep * fraction} ${circumference}`} />
        </svg>
        <span className="num text-base font-semibold">{formatPercent(value, 0)}</span>
      </span>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

// Fuel list: colour square, label, then a bar on a shared scale with its value.
function MixList({ model }) {
  const { power, powerValue, unitLabel } = useUnit();
  const categories = getPositiveCategories(model)
    .sort((a, b) => b.netGenerationMw - a.netGenerationMw);
  const max = Math.max(...categories.map((category) => category.netGenerationMw), 1);
  const total = categories.reduce((sum, category) => sum + category.netGenerationMw, 0);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-medium">電從哪裡來</h2>
        <p className="num text-sm text-muted-foreground">合計 {power(total)}</p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">目前淨發電（{unitLabel}）與占比</p>
      <ul className="mt-3 space-y-1">
        {categories.map((category) => {
          const share = total > 0 ? (category.netGenerationMw / total) * 100 : 0;
          return (
            <li key={category.key} className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-4 shrink-0 rounded-[4px]" style={{ background: fuelColor(category) }} aria-hidden="true" />
                <span className="truncate">{SHORT_LABEL[category.key] || category.labelZh}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-4 shrink-0 rounded-[3px]" style={{ width: `${Math.max(1, (category.netGenerationMw / max) * 60)}%`, background: fuelColor(category) }} aria-hidden="true" />
                <span className="num whitespace-nowrap text-muted-foreground">{powerValue(category.netGenerationMw)} · {formatPercent(share, 1)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="num mt-1 truncate text-base font-semibold">{value}</dd>
    </div>
  );
}

// The status panel: stacked cards with hairline borders and 16px corners. The
// reserve rate is the focal point; the official light and two gauges sit in a
// tile row, and the lamp scale is the panel's legend card.
export function StatusHero({ model, freshness, trust, timeLabel }) {
  const { power } = useUnit();
  const status = describeReserveStatus(model, freshness);
  const level = levelFor(status.indicator);
  const Icon = level?.icon;
  const snapshot = status.muted;
  const { metrics, supply } = model;
  const capacityMw = supply.realHourMaxSupplyCapacityMw ?? metrics.forecastMaxSupplyCapacityMw;

  return (
    <section id="status" aria-labelledby="hero-title" className="scroll-mt-20 space-y-3">
      <Card className="pb-4">
        <h1 id="hero-title" className="text-base font-medium">台灣現在的電夠不夠？</h1>
        <DataTime freshness={freshness} trust={trust} />

        <p className="mt-4 text-sm text-muted-foreground">{status.contextLabel}</p>
        <p className="mt-1 flex items-center gap-2 text-base font-semibold">
          {Icon && <Icon className="size-4" aria-hidden="true" />}
          <span>{level ? `${level.name} · ${model.health.labelZh}` : model.health.labelZh}</span>
        </p>
        <div
          role="meter"
          aria-label="今日尖峰預估備轉容量率"
          aria-valuemin={0}
          aria-valuemax={Math.max(30, Math.ceil(metrics.forecastReserveRatePercent))}
          aria-valuenow={Math.max(0, metrics.forecastReserveRatePercent)}
          aria-valuetext={status.ariaValueText}
          className="num mt-2 text-6xl font-semibold tracking-[-0.03em]"
          style={{ color: snapshot || !level ? undefined : `var(--status-${level.token}-text)` }}
        >
          {status.rateText}
        </div>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">今日尖峰預估備轉容量率，{status.summary}。</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <LampTile level={level} snapshot={snapshot} />
          <RingTile value={metrics.currentUtilizationPercent} label="使用率" color="var(--accent)" />
          <RingTile value={metrics.renewableSharePercent} label="再生能源" color="var(--status-g)" />
        </div>
      </Card>

      <LampLegend level={level} snapshot={snapshot} rate={metrics.forecastReserveRatePercent} />

      <Card>
        <h2 className="text-base font-medium">{timeLabel === '目前' ? '此刻的電網' : '最後更新時的電網'}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label={`${timeLabel}用電`} value={power(metrics.currentLoadMw)} />
          <Stat label="最大供電能力" value={power(capacityMw)} />
          <Stat label="備轉容量" value={power(metrics.forecastReserveCapacityMw)} />
          <Stat label="預估尖峰負載" value={power(metrics.forecastPeakDemandMw)} />
          <Stat label="尖峰時段" value={supply.forecastPeakHourRange || '--'} />
          <Stat label="昨日尖峰備轉" value={`${formatNumber(supply.yesterdayReserveRatePercent, 2)}%`} />
        </dl>
      </Card>

      <MixList model={model} />
    </section>
  );
}
