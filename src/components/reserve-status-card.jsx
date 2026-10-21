import { Info } from 'lucide-react';

import { describeReserveStatus, formatMw, formatNumber } from '../../js/dashboard-presenter.js';
import { cn } from '../lib/utils.js';
import { Badge } from './ui/badge.jsx';
import { Card } from './ui/card.jsx';
import { Tooltip } from './ui/tooltip.jsx';

const LIGHTS = [
  { code: 'G', label: '充裕', className: 'bg-status-g shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-g)_22%,transparent)]' },
  { code: 'Y', label: '稍緊', className: 'bg-status-y shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-y)_25%,transparent)]' },
  { code: 'O', label: '吃緊', className: 'bg-status-o shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-o)_22%,transparent)]' },
  { code: 'R', label: '警戒', className: 'bg-status-r shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-r)_22%,transparent)]' },
  { code: 'B', label: '限電', className: 'bg-status-b shadow-[0_0_0_4px_color-mix(in_oklab,var(--status-b)_22%,transparent)]' }
];

const SCALE_MAX = 25;

function SignalLights({ indicator, muted }) {
  return (
    <ol className="flex items-end gap-3 sm:gap-4" aria-label="台電供電燈號">
      {LIGHTS.map((light) => {
        const active = light.code === indicator;
        return (
          <li key={light.code} className="flex flex-col items-center gap-1.5" aria-current={active ? 'true' : undefined}>
            <span
              className={cn(
                'block rounded-full transition',
                active ? 'size-5' : 'size-3.5 bg-status-off',
                active && (muted ? 'bg-subtle-foreground' : light.className)
              )}
              aria-hidden="true"
            />
            <span className={cn('text-[11px]', active ? 'font-semibold text-foreground' : 'text-subtle-foreground')}>
              {light.label}
            </span>
            <span className="sr-only">{active ? `目前燈號 ${light.code}` : light.code}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ThresholdScale({ rate, muted }) {
  const position = Math.min(100, Math.max(0, (rate / SCALE_MAX) * 100));
  const at = (value) => `${(value / SCALE_MAX) * 100}%`;

  return (
    <div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-track">
        <div className={cn('absolute inset-y-0 left-0', muted ? 'bg-subtle-foreground/30' : 'bg-status-o/70')} style={{ width: at(6) }} />
        <div className={cn('absolute inset-y-0', muted ? 'bg-subtle-foreground/40' : 'bg-status-y/70')} style={{ left: at(6), width: at(4) }} />
        <div className={cn('absolute inset-y-0 right-0', muted ? 'bg-subtle-foreground/50' : 'bg-status-g/75')} style={{ left: at(10) }} />
      </div>
      <div className="relative h-7">
        <div className="absolute top-0 -translate-x-1/2" style={{ left: `${position}%` }} aria-hidden="true">
          <div className="mx-auto -mt-[14px] h-[18px] w-[3px] rounded-full bg-foreground ring-2 ring-card" />
        </div>
        {[0, 6, 10, 20].map((tick) => (
          <span key={tick} className="num absolute top-1 -translate-x-1/2 text-[11px] text-subtle-foreground" style={{ left: at(tick) }}>
            {tick}%
          </span>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <button type="button" className="text-subtle-foreground hover:text-foreground" aria-label={`${label}說明`}>
              <Info className="size-3" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </dt>
      <dd className="num mt-1 text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

export function ReserveStatusCard({ model, freshness, trust }) {
  const status = describeReserveStatus(model, freshness);
  const { metrics, supply } = model;

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{status.contextLabel}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]" style={{ color: status.color }}>
            {status.headline}
          </h2>
        </div>
        <Badge tone={trust.tone}>{status.modeLabel}</Badge>
      </div>

      <div className="mt-5">
        <SignalLights indicator={status.indicator} muted={status.muted} />
      </div>

      <div className="mt-6 flex items-end gap-3">
        <div
          role="meter"
          aria-label="今日尖峰預估備轉容量率"
          aria-valuemin={0}
          aria-valuemax={Math.max(30, Math.ceil(metrics.forecastReserveRatePercent))}
          aria-valuenow={Math.max(0, metrics.forecastReserveRatePercent)}
          aria-valuetext={status.ariaValueText}
          className="num text-5xl font-bold leading-none tracking-tight sm:text-6xl"
        >
          {status.rateText}
        </div>
        <div className="pb-1 text-[13px] leading-5 text-muted-foreground">
          <div>尖峰預估備轉容量率</div>
          <div className="num font-medium text-foreground">{status.marginText} vs 10% 門檻</div>
        </div>
      </div>

      <div className="mt-5">
        <ThresholdScale rate={metrics.forecastReserveRatePercent} muted={status.muted} />
      </div>
      <p className="mb-6 text-[13px] text-muted-foreground">
        {status.summary}。官方燈號依據：{status.criterion}。
      </p>

      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
        <Fact label="尖峰時段" value={supply.forecastPeakHourRange || '--'} />
        <Fact label="預估尖峰負載" value={formatMw(metrics.forecastPeakDemandMw, 0)} />
        <Fact
          label="備轉容量"
          value={formatMw(metrics.forecastReserveCapacityMw, 0)}
          hint="R（警戒）與 B（限電警戒）燈號以備轉容量 900 MW、500 MW 判定，不是百分比。"
        />
        <Fact
          label="昨日尖峰備轉"
          value={`${formatNumber(supply.yesterdayReserveRatePercent)}%`}
          hint={`${supply.yesterdayDateText} 尖峰負載 ${formatMw(supply.yesterdayPeakDemandMw, 0)}`}
        />
      </dl>
    </Card>
  );
}
