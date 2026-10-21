import { describeReserveStatus, formatNumber } from '../../js/dashboard-presenter.js';
import { levelFor, RESERVE_LEVELS, statusSurface } from '../lib/status.js';
import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';
import { Card } from './ui/card.jsx';

const SCALE_MAX = 25;

function ThresholdScale({ rate, muted }) {
  const position = Math.min(100, Math.max(0, (rate / SCALE_MAX) * 100));
  const at = (value) => `${(value / SCALE_MAX) * 100}%`;
  const segment = (token) => ({ background: muted ? 'var(--status-off)' : `var(--status-${token}-bg)` });

  return (
    <div aria-hidden="true">
      <div className="relative flex h-2 gap-[2px] overflow-hidden rounded-full">
        <div className="h-full rounded-l-full" style={{ ...segment('o'), width: at(6) }} />
        <div className="h-full" style={{ ...segment('y'), width: at(4) }} />
        <div className="h-full flex-1 rounded-r-full" style={segment('g')} />
      </div>
      <div className="relative h-6">
        <div className="absolute -top-[14px] -translate-x-1/2" style={{ left: `${position}%` }}>
          <div className="h-[18px] w-[4px] rounded-full bg-foreground ring-2 ring-card" />
        </div>
        {[0, 6, 10, 20].map((tick) => (
          <span key={tick} className="num absolute top-1.5 -translate-x-1/2 text-[11px] text-muted-foreground" style={{ left: at(tick) }}>
            {tick}%
          </span>
        ))}
      </div>
    </div>
  );
}

// Persistent legend of all five official lights (でんき予報 practice): the
// thresholds are always visible next to the number they classify.
function LevelLegend({ current, muted }) {
  return (
    <ol className="grid gap-1.5" aria-label="台電供電燈號分級">
      {RESERVE_LEVELS.map((level) => {
        const active = level.code === current;
        const Icon = level.icon;
        return (
          <li
            key={level.code}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px]',
              active ? 'bg-muted ring-1 ring-border' : 'text-muted-foreground'
            )}
          >
            <span
              className="grid size-6 shrink-0 place-items-center rounded-full"
              style={active ? statusSurface(level.token, muted) : { background: 'var(--status-off)', color: 'var(--muted-foreground)' }}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span className={cn('w-16 shrink-0 font-medium', active && 'text-foreground')}>{level.label}</span>
            <span className="num min-w-0 truncate text-xs">{level.rule}</span>
            {active && <span className="ml-auto shrink-0 text-xs font-semibold text-foreground">目前</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ReserveStatusCard({ model, freshness }) {
  const { power } = useUnit();
  const status = describeReserveStatus(model, freshness);
  const level = levelFor(status.indicator);
  const Icon = level?.icon;
  const { metrics, supply } = model;

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{status.contextLabel}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {level && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-[15px] font-semibold"
                style={statusSurface(level.token, status.muted)}
              >
                <Icon className="size-4" aria-hidden="true" />
                {level.name} · {model.health.labelZh}
              </span>
            )}
            {status.modeLabel !== '來源已確認' && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {status.modeLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-1">
        <div
          role="meter"
          aria-label="今日尖峰預估備轉容量率"
          aria-valuemin={0}
          aria-valuemax={Math.max(30, Math.ceil(metrics.forecastReserveRatePercent))}
          aria-valuenow={Math.max(0, metrics.forecastReserveRatePercent)}
          aria-valuetext={status.ariaValueText}
          className="num text-[56px] font-bold leading-none tracking-tight sm:text-[64px]"
        >
          {status.rateText}
        </div>
        <div className="pb-1.5 text-[13px] leading-5">
          <div className="text-muted-foreground">今日尖峰預估備轉容量率</div>
          <div className="num font-medium">{status.summary}</div>
        </div>
      </div>

      <div className="mt-5">
        <ThresholdScale rate={metrics.forecastReserveRatePercent} muted={status.muted} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-muted px-4 py-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">備轉容量</dt>
          <dd className="num mt-0.5 text-sm font-semibold">{power(metrics.forecastReserveCapacityMw)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">預估尖峰負載</dt>
          <dd className="num mt-0.5 text-sm font-semibold">{power(metrics.forecastPeakDemandMw)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">尖峰時段</dt>
          <dd className="num mt-0.5 text-sm font-semibold">{supply.forecastPeakHourRange || '--'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">昨日尖峰備轉</dt>
          <dd className="num mt-0.5 text-sm font-semibold">{formatNumber(supply.yesterdayReserveRatePercent, 2)}%</dd>
        </div>
      </dl>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">燈號分級（台電官方）</h3>
        <LevelLegend current={status.indicator} muted={status.muted} />
      </div>
    </Card>
  );
}
