import { describeReserveStatus, formatAge, formatClockTime, formatNumber } from '../../js/dashboard-presenter.js';
import { levelFor } from '../lib/status.js';
import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';

// One calm gradient per official light, like the sky in iOS Weather: the whole
// hero tells the status before any number is read. Stale snapshots turn grey.
const GRADIENT = {
  g: 'linear-gradient(155deg, #13804f 0%, #0d6a50 50%, #0a524b 100%)',
  y: 'linear-gradient(155deg, #a86c00 0%, #8f5a00 55%, #6e4500 100%)',
  o: 'linear-gradient(155deg, #c4520a 0%, #a33f07 55%, #7d3005 100%)',
  r: 'linear-gradient(155deg, #c42a1f 0%, #a01f17 55%, #7c1912 100%)',
  b: 'linear-gradient(155deg, #3a3a3c 0%, #1c1c1e 55%, #0a0a0b 100%)',
  off: 'linear-gradient(155deg, #6e6e73 0%, #57575c 55%, #3f3f43 100%)'
};

function GlassStat({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/15 backdrop-blur-md">
      <dt className="text-[12px] font-medium text-white/75">{label}</dt>
      <dd className="num mt-1 truncate text-[17px] font-semibold text-white">{value}</dd>
    </div>
  );
}

// A UV-index style scale: five official levels on one bar with a marker for
// today. The three percentage bands are drawn to scale; R/B are MW-based.
function LevelScale({ rate, muted }) {
  const position = Math.min(100, Math.max(0, (rate / 25) * 100));
  return (
    <div aria-hidden="true">
      <div
        className="relative h-[6px] rounded-full"
        style={{
          background: muted
            ? 'rgb(255 255 255 / 0.35)'
            : 'linear-gradient(90deg, #ff6b4a 0%, #ff9f0a 22%, #ffd60a 34%, #ffd60a 40%, #4cd97b 46%, #34c759 100%)'
        }}
      >
        <span
          className="absolute top-1/2 size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgb(0_0_0/0.18)]"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="num relative mt-2 h-4 text-[11px] font-medium text-white/70">
        {[0, 6, 10, 20].map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${(tick / 25) * 100}%` }}>{tick}%</span>
        ))}
      </div>
    </div>
  );
}

export function StatusHero({ model, freshness, trust }) {
  const { power } = useUnit();
  const status = describeReserveStatus(model, freshness);
  const level = levelFor(status.indicator);
  const Icon = level?.icon;
  const gradient = status.muted ? GRADIENT.off : GRADIENT[level?.token] || GRADIENT.off;
  const oldest = [trust.sources.supply, trust.sources.generation]
    .filter((source) => source.observedAt)
    .sort((a, b) => a.observedAt - b.observedAt)[0];
  const { metrics, supply } = model;

  return (
    <section
      id="status"
      aria-labelledby="hero-title"
      className="relative scroll-mt-24 overflow-hidden rounded-[32px] text-white shadow-[0_20px_60px_-24px_rgb(0_0_0/0.45)] sm:rounded-[36px]"
      style={{ background: gradient }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 90% -10%, rgb(255 255 255 / 0.16), transparent 55%), radial-gradient(80% 60% at -10% 110%, rgb(0 0 0 / 0.25), transparent 60%)' }}
        aria-hidden="true"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 pt-6 sm:px-10 sm:pt-9">
        <div className="contents">
          <h1 id="hero-title" className="text-[15px] font-semibold text-white/85 sm:text-[17px]">台灣現在的電夠不夠？</h1>
          {oldest && (
            <span className="num inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[12px] font-medium text-white/90 ring-1 ring-white/15 backdrop-blur">
              <span className={cn('size-1.5 rounded-full', trust.tone === 'success' ? 'bg-[#4cd97b]' : 'bg-[#ffd60a]')} aria-hidden="true" />
              {formatClockTime(oldest.observedAt)} · {formatAge(oldest.ageMinutes)}
            </span>
          )}
        </div>
      </div>
      <div className="relative grid gap-10 px-6 pb-6 pt-2 sm:px-10 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="min-w-0">
          <p className="mt-6 text-[15px] text-white/75 sm:mt-8">{status.contextLabel}</p>
          <div className="mt-1 flex items-center gap-2 text-2xl font-semibold sm:text-[28px]">
            {Icon && <Icon className="size-6 sm:size-7" aria-hidden="true" />}
            <span>{level ? `${level.name} · ${model.health.labelZh}` : model.health.labelZh}</span>
          </div>

          <div
            role="meter"
            aria-label="今日尖峰預估備轉容量率"
            aria-valuemin={0}
            aria-valuemax={Math.max(30, Math.ceil(metrics.forecastReserveRatePercent))}
            aria-valuenow={Math.max(0, metrics.forecastReserveRatePercent)}
            aria-valuetext={status.ariaValueText}
            className="num display mt-2 text-[104px] font-extralight leading-[0.95] sm:text-[148px]"
          >
            {status.rateText}
          </div>
          <p className="mt-3 max-w-md text-pretty text-[15px] leading-6 text-white/85">
            今日尖峰預估備轉容量率，{status.summary}。
            {status.modeLabel !== '來源已確認' && <span className="ml-1 rounded-full bg-black/20 px-2 py-0.5 text-[12px]">{status.modeLabel}</span>}
          </p>
        </div>

        <div className="flex flex-col justify-end gap-6">
          <LevelScale rate={metrics.forecastReserveRatePercent} muted={status.muted} />
          <dl className="grid grid-cols-2 gap-2.5">
            <GlassStat label="備轉容量" value={power(metrics.forecastReserveCapacityMw)} />
            <GlassStat label="預估尖峰負載" value={power(metrics.forecastPeakDemandMw)} />
            <GlassStat label="尖峰時段" value={supply.forecastPeakHourRange || '--'} />
            <GlassStat label="昨日尖峰備轉" value={`${formatNumber(supply.yesterdayReserveRatePercent, 2)}%`} />
          </dl>
        </div>
      </div>
    </section>
  );
}
