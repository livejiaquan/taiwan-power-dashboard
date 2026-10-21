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
      <div className="relative flex h-2.5 gap-[3px] overflow-hidden rounded-full">
        <div className="h-full rounded-l-full" style={{ ...segment('o'), width: at(6) }} />
        <div className="h-full" style={{ ...segment('y'), width: at(4) }} />
        <div className="h-full flex-1 rounded-r-full" style={segment('g')} />
      </div>
      <div className="relative h-8">
        <div className="absolute -top-[17px] -translate-x-1/2" style={{ left: `${position}%` }}>
          <div className="h-[22px] w-[5px] rounded-full bg-foreground ring-[3px] ring-card" />
        </div>
        {[0, 6, 10, 20].map((tick) => (
          <span key={tick} className="num absolute top-2 -translate-x-1/2 text-xs text-muted-foreground" style={{ left: at(tick) }}>
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
    <ol className="grid gap-2" aria-label="台電供電燈號分級">
      {RESERVE_LEVELS.map((level) => {
        const active = level.code === current;
        const Icon = level.icon;
        return (
          <li
            key={level.code}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
              active ? 'bg-muted ring-1 ring-border' : 'text-muted-foreground'
            )}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full"
              style={active ? statusSurface(level.token, muted) : { background: 'var(--status-off)', color: 'var(--muted-foreground)' }}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span className={cn('w-16 shrink-0 font-medium', active && 'text-foreground')}>{level.label}</span>
            <span className="num min-w-0 truncate text-[13px]">{level.rule}</span>
            {active && <span className="ml-auto hidden shrink-0 text-[13px] font-semibold text-foreground min-[420px]:inline">目前</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="num mt-1.5 text-lg font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

export function ReserveStatusCard({ model, freshness }) {
  const { power } = useUnit();
  const status = describeReserveStatus(model, freshness);
  const level = levelFor(status.indicator);
  const Icon = level?.icon;
  const { metrics, supply } = model;

  return (
    <Card className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          {level && (
            <span
              className="inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-4 text-base font-semibold"
              style={statusSurface(level.token, status.muted)}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {level.name} · {model.health.labelZh}
            </span>
          )}
          {status.modeLabel !== '來源已確認' && (
            <span className="rounded-full border border-border px-3 py-1 text-[13px] font-medium text-muted-foreground">
              {status.modeLabel}
            </span>
          )}
        </div>
        <p className="mt-4 text-[15px] text-muted-foreground">{status.contextLabel}</p>

        <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div
            role="meter"
            aria-label="今日尖峰預估備轉容量率"
            aria-valuemin={0}
            aria-valuemax={Math.max(30, Math.ceil(metrics.forecastReserveRatePercent))}
            aria-valuenow={Math.max(0, metrics.forecastReserveRatePercent)}
            aria-valuetext={status.ariaValueText}
            className="num text-[64px] font-bold leading-[0.9] tracking-tight sm:text-[88px]"
          >
            {status.rateText}
          </div>
          <div className="pb-2 text-[15px] leading-7">
            <div className="text-muted-foreground">今日尖峰預估備轉容量率</div>
            <div className="num font-medium">{status.summary}</div>
          </div>
        </div>

        <div className="mt-10 max-w-xl">
          <ThresholdScale rate={metrics.forecastReserveRatePercent} muted={status.muted} />
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-8 sm:grid-cols-4">
          <Fact label="備轉容量" value={power(metrics.forecastReserveCapacityMw)} />
          <Fact label="預估尖峰負載" value={power(metrics.forecastPeakDemandMw)} />
          <Fact label="尖峰時段" value={supply.forecastPeakHourRange || '--'} />
          <Fact label="昨日尖峰備轉" value={`${formatNumber(supply.yesterdayReserveRatePercent, 2)}%`} />
        </dl>
      </div>

      <div className="min-w-0 lg:border-l lg:border-border lg:pl-14">
        <h3 className="text-[15px] font-semibold">燈號怎麼看</h3>
        <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">台電依當日尖峰備轉狀況公布，本站直接採用官方燈號。</p>
        <div className="mt-5">
          <LevelLegend current={status.indicator} muted={status.muted} />
        </div>
      </div>
    </Card>
  );
}
