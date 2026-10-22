import { describeReserveStatus, formatNumber } from '../../js/dashboard-presenter.js';
import { levelFor, RESERVE_LEVELS } from '../lib/status.js';
import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';

// Lamp colours are fixed: the housing is always dark, like a real signal head,
// so the lamps read the same in light and dark themes.
const LAMP = {
  g: '#3ddc84',
  y: '#ffd23f',
  o: '#ff8a3d',
  r: '#ff4f4f',
  b: '#f1f5f9'
};
const SHORT = { G: '綠', Y: '黃', O: '橘', R: '紅', B: '黑' };

function Lamp({ level, active, snapshot }) {
  const color = LAMP[level.token];
  const Icon = level.icon;
  const lit = active && !snapshot;
  return (
    <li className="flex min-w-0 flex-col items-center gap-2">
      <span
        className={cn(
          'relative grid aspect-square w-full max-w-[64px] place-items-center rounded-full transition-[box-shadow,background] duration-500',
          !active && 'bg-[#1a2633] ring-1 ring-inset ring-white/[0.06]',
          lit && 'animate-lamp-on'
        )}
        style={
          active
            ? {
                background: level.token === 'b'
                  ? 'radial-gradient(circle at 50% 40%, #2b3440, #05080c 70%)'
                  : `radial-gradient(circle at 40% 35%, #ffffffcc 0%, ${color} 38%, ${color} 70%, color-mix(in srgb, ${color} 60%, #000) 100%)`,
                boxShadow: lit
                  ? `0 0 0 3px ${level.token === 'b' ? '#f1f5f9' : `color-mix(in srgb, ${color} 35%, transparent)`}, 0 0 36px 4px color-mix(in srgb, ${color} 55%, transparent)`
                  : `0 0 0 3px ${level.token === 'b' ? '#94a3b8' : `color-mix(in srgb, ${color} 30%, transparent)`}`,
                opacity: snapshot ? 0.55 : 1
              }
            : undefined
        }
      >
        {active && snapshot && (
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: 'repeating-linear-gradient(135deg, rgb(11 19 28 / 0.55) 0 3px, transparent 3px 7px)' }}
          />
        )}
        {active && (
          <Icon
            className={cn('relative size-[42%]', level.token === 'b' ? 'text-white' : 'text-[#0b131c]/80')}
            strokeWidth={2.4}
          />
        )}
      </span>
      <span className={cn('text-[12px] font-semibold', active ? 'text-white' : 'text-white/45')}>{SHORT[level.code]}燈</span>
    </li>
  );
}

// The official 0–25% band rule: orange ≤ 6%, yellow < 10%, green above. Red and
// black are judged on reserve megawatts, so they sit outside this ruler.
function ThresholdRuler({ rate, muted }) {
  const max = 25;
  const at = (value) => `${(Math.min(max, Math.max(0, value)) / max) * 100}%`;
  return (
    <div aria-hidden="true" className="mt-6">
      <div className="relative flex h-2 overflow-hidden rounded-full">
        <span style={{ width: at(6), background: LAMP.o }} />
        <span style={{ width: `calc(${at(10)} - ${at(6)})`, background: LAMP.y }} />
        <span className="flex-1" style={{ background: LAMP.g }} />
        {muted && <span className="absolute inset-0 bg-[#0e1823]/55" />}
      </div>
      <div className="relative h-5">
        <span
          className="absolute -top-[14px] size-4 -translate-x-1/2 rounded-full border-[3px] border-[#0e1823] bg-white"
          style={{ left: at(rate) }}
        />
        {[0, 6, 10, 20].map((tick) => (
          <span key={tick} className={cn('num absolute top-1.5 text-[12px] font-medium text-white/60', tick > 0 && '-translate-x-1/2')} style={{ left: at(tick) }}>
            {tick}%
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 truncate text-[22px] font-semibold leading-tight">{value}</dd>
    </div>
  );
}

export function StatusHero({ model, freshness }) {
  const { power } = useUnit();
  const status = describeReserveStatus(model, freshness);
  const level = levelFor(status.indicator);
  const Icon = level?.icon;
  const snapshot = status.muted;
  const { metrics, supply } = model;
  const qualifier = snapshot ? '非即時' : status.modeLabel === '延遲' ? '延遲資料' : null;

  return (
    <section
      id="status"
      aria-labelledby="hero-title"
      className="scroll-mt-24 overflow-hidden rounded-hero bg-card ring-1 ring-border"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 px-6 pb-7 pt-5 sm:px-9 sm:pb-9 sm:pt-8">
          <h1 id="hero-title" className="text-[15px] font-semibold text-muted-foreground">台灣現在的電夠不夠？</h1>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground sm:mt-8">
            {qualifier && (
              <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[12px] font-semibold text-background">{qualifier}</span>
            )}
            {status.contextLabel}
          </p>
          <p className="mt-1.5 flex items-center gap-2.5 text-[24px] font-bold sm:text-[28px]">
            {Icon && (
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full"
                style={{ background: `var(--status-${snapshot ? 'off' : level.token}-bg)`, color: `var(--status-${snapshot ? 'off' : level.token}-on)` }}
              >
                <Icon className="size-[18px]" aria-hidden="true" strokeWidth={2.4} />
              </span>
            )}
            <span>{level ? `${level.name} · ${model.health.labelZh}` : model.health.labelZh}</span>
          </p>

          <div
            role="meter"
            aria-label="今日尖峰預估備轉容量率"
            aria-valuemin={0}
            aria-valuemax={Math.max(30, Math.ceil(metrics.forecastReserveRatePercent))}
            aria-valuenow={Math.max(0, metrics.forecastReserveRatePercent)}
            aria-valuetext={status.ariaValueText}
            className="num mt-3 text-[104px] font-semibold leading-[0.9] tracking-[-0.02em] sm:text-[148px]"
          >
            {status.rateText}
          </div>
          <p className="mt-4 max-w-md text-pretty text-[16px] leading-7">
            今日尖峰預估備轉容量率，{status.summary}。
          </p>
        </div>

        <div className="flex flex-col justify-center bg-[#0e1823] px-6 dark:bg-[#08101a] dark:ring-1 dark:ring-inset dark:ring-white/[0.05] py-7 text-white sm:px-9 sm:py-9">
          <div
            role="img"
            aria-label={`台電官方五級燈號，${snapshot ? '最後快照時為' : '目前為'}${level ? level.name : '未知'}`}
          >
            <p className="text-[13px] font-medium text-white/65">台電供電燈號{snapshot && '（最後快照）'}</p>
            <ol className="mt-4 grid grid-cols-5 gap-3 rounded-[22px] bg-[#09111a] p-3.5 ring-1 ring-white/[0.06] sm:gap-4 sm:p-4">
              {RESERVE_LEVELS.map((item) => (
                <Lamp key={item.code} level={item} active={item.code === level?.code} snapshot={snapshot} />
              ))}
            </ol>
          </div>
          <ThresholdRuler rate={metrics.forecastReserveRatePercent} muted={snapshot} />
          <p className="mt-1 text-pretty text-[12px] leading-5 text-white/60">
            黃燈以下以百分比判定；紅、黑燈改看備轉容量是否降至 90 萬瓩、50 萬瓩以下。
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4 [&>*]:bg-card">
        <Stat label="備轉容量" value={power(metrics.forecastReserveCapacityMw)} />
        <Stat label="預估尖峰負載" value={power(metrics.forecastPeakDemandMw)} />
        <Stat label="尖峰時段" value={supply.forecastPeakHourRange || '--'} />
        <Stat label="昨日尖峰備轉" value={`${formatNumber(supply.yesterdayReserveRatePercent, 2)}%`} />
      </dl>
    </section>
  );
}
