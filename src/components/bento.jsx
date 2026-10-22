import { CalendarDays, MapPin, PieChart, Zap } from 'lucide-react';

import { formatNumber, formatPercent, getPositiveCategories } from '../../js/dashboard-presenter.js';
import { AREA_KEYS } from '../../js/power-curves.js';
import { fuelColor, fuelStyle, sortByFuelOrder } from '../lib/fuel.js';
import { levelFor } from '../lib/status.js';
import { useUnit } from '../lib/units.jsx';
import { Tile } from './ui/tile.jsx';
import { Tooltip } from './ui/tooltip.jsx';

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const SHORT_LABEL = { 'other-renewable': '其他再生', cogeneration: '汽電共生' };

function share(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function BigValue({ value, unit }) {
  return (
    <p className="num text-3xl font-semibold leading-none sm:text-4xl">
      {value}
      {unit && <span className="ml-1 font-sans text-sm font-medium text-muted-foreground sm:text-base">{unit}</span>}
    </p>
  );
}

function Caption({ children }) {
  return <p className="mt-auto pt-4 text-pretty text-base text-muted-foreground">{children}</p>;
}

function Meter({ value, color }) {
  return (
    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </span>
  );
}

function NowCell({ label, children, note }) {
  return (
    <div className="flex min-w-0 flex-col px-5 py-5 sm:px-8 sm:py-6">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex min-w-0 flex-1 flex-col">{children}</dd>
      {note && <dd className="mt-3 text-pretty text-base text-muted-foreground">{note}</dd>}
    </div>
  );
}

// One instant, four readings: they share a panel and hairlines instead of four
// separate cards (GridStatus' KPI row), because they are the same moment.
export function NowPanel({ model, timeLabel }) {
  const { powerValue, unitLabel, power } = useUnit();
  const { metrics, supply } = model;
  const capacityMw = supply.realHourMaxSupplyCapacityMw ?? metrics.forecastMaxSupplyCapacityMw;
  const categories = getPositiveCategories(model);
  const total = categories.reduce((sum, category) => sum + category.netGenerationMw, 0);
  const top = categories
    .filter((category) => fuelStyle(category.key).group === 'renewable')
    .sort((a, b) => b.netGenerationMw - a.netGenerationMw)
    .slice(0, 2);

  return (
    <section id="now" aria-labelledby="now-title" className="scroll-mt-24 rounded-panel bg-card ring-1 ring-border lg:col-span-12">
      <h2 id="now-title" className="flex items-center gap-2 px-5 pt-5 text-sm font-semibold text-muted-foreground sm:px-8 sm:pt-8">
        <Zap className="size-3.5" aria-hidden="true" />
        {timeLabel === '目前' ? '此刻的電網' : '快照當下的電網'}
      </h2>
      <dl className="mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-b-panel bg-border lg:grid-cols-4 [&>*]:bg-card">
        <NowCell label={`${timeLabel}用電`} note={`最大供電能力 ${power(capacityMw)}`}>
          <BigValue value={powerValue(metrics.currentLoadMw)} unit={unitLabel} />
        </NowCell>
        <NowCell label="使用率" note="目前用電 ÷ 當下最大供電能力">
          <BigValue value={formatNumber(metrics.currentUtilizationPercent, 0)} unit="%" />
          <Meter value={metrics.currentUtilizationPercent} color="var(--accent)" />
        </NowCell>
        <NowCell
          label="再生能源"
          note={top.map((category) => `${category.labelZh} ${formatPercent(share(category.netGenerationMw, total))}`).join('、')}
        >
          <BigValue value={formatNumber(metrics.renewableSharePercent, 1)} unit="%" />
          <Meter value={metrics.renewableSharePercent} color="var(--status-g)" />
        </NowCell>
        <NowCell label="低碳占比" note="再生能源、核能與儲能放電">
          <BigValue value={formatNumber(metrics.lowCarbonSharePercent, 1)} unit="%" />
          <Meter value={metrics.lowCarbonSharePercent} color="#5fb3a1" />
        </NowCell>
      </dl>
    </section>
  );
}

export function MixTile({ model }) {
  const { power } = useUnit();
  const categories = sortByFuelOrder(getPositiveCategories(model));
  const total = categories.reduce((sum, category) => sum + category.netGenerationMw, 0);
  const ranked = [...categories].sort((a, b) => b.netGenerationMw - a.netGenerationMw);

  return (
    <Tile icon={PieChart} label="電從哪裡來" className="lg:col-span-7" aside={<span className="num text-sm text-muted-foreground">合計 {power(total)}</span>}>
      <div
        className="flex h-12 w-full overflow-hidden rounded-[12px]"
        role="img"
        aria-label={`發電結構：${ranked.map((c) => `${c.labelZh} ${formatPercent(share(c.netGenerationMw, total))}`).join('、')}`}
      >
        {categories.map((category) => (
          <Tooltip
            key={category.key}
            content={<span className="num"><strong>{category.labelZh}</strong> {power(category.netGenerationMw)} · {formatPercent(share(category.netGenerationMw, total))}</span>}
          >
            <span
              className="h-full min-w-[3px] border-r-2 border-card last:border-r-0"
              style={{ width: `${share(category.netGenerationMw, total)}%`, background: fuelColor(category) }}
            />
          </Tooltip>
        ))}
      </div>
      <ul className="mt-6 grid gap-x-8 sm:grid-cols-2">
        {ranked.map((category) => (
          <li key={category.key} className="flex min-w-0 items-center gap-3 border-b border-border py-3 text-base">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: fuelColor(category) }} aria-hidden="true" />
            <span className="truncate">{SHORT_LABEL[category.key] || category.labelZh}</span>
            <span className="num ml-auto text-sm text-muted-foreground">{power(category.netGenerationMw)}</span>
            <span className="num w-14 text-right text-base font-semibold">{formatPercent(share(category.netGenerationMw, total))}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

function dayName(dateKey, todayKey) {
  if (dateKey === todayKey) return '今天';
  const weekday = new Date(`${dateKey}T12:00:00+08:00`).getUTCDay();
  return `週${WEEKDAY[weekday]}`;
}

function tokenFor(rate, reserveMw) {
  if (Number.isFinite(reserveMw) && reserveMw <= 500) return 'B';
  if (Number.isFinite(reserveMw) && reserveMw <= 900) return 'R';
  if (rate <= 6) return 'O';
  if (rate < 10) return 'Y';
  return 'G';
}

// Modelled on the iOS Weather 10-day list: one row per day with the official
// light's icon and the forecast reserve rate on a shared 0–30% scale.
export function WeekTile({ curves, model, todayKey }) {
  const days = [
    model && {
      date: todayKey,
      reserveRatePercent: model.metrics.forecastReserveRatePercent,
      reserveMw: model.metrics.forecastReserveCapacityMw
    },
    ...(curves?.forecast || []).filter((day) => day.date > todayKey).slice(0, 6)
  ].filter(Boolean);

  return (
    <Tile id="week" icon={CalendarDays} label="未來一週備轉預估" className="lg:col-span-5">
      {days.length <= 1 ? (
        <p className="text-sm text-muted-foreground">台電一週預測暫時無法取得。</p>
      ) : (
        <ol className="divide-y divide-border">
          {days.map((day) => {
            const level = levelFor(tokenFor(day.reserveRatePercent, day.reserveMw));
            const Icon = level.icon;
            const position = Math.min(100, Math.max(0, (day.reserveRatePercent / 30) * 100));
            return (
              <li key={day.date} className="grid grid-cols-[44px_22px_56px_1fr] items-center gap-3 py-3 first:pt-1 last:pb-0">
                <span className="text-base font-bold">{dayName(day.date, todayKey)}</span>
                <span className="grid size-[22px] place-items-center rounded-full" style={{ background: `var(--status-${level.token}-bg)`, color: `var(--status-${level.token}-on)` }}>
                  <Icon className="size-3" aria-hidden="true" />
                  <span className="sr-only">{level.label}</span>
                </span>
                <span className="num text-right text-lg font-semibold">{formatNumber(day.reserveRatePercent, 1)}%</span>
                <span className="relative h-[5px] rounded-full bg-track" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${position}%`, background: `var(--status-${level.token}-bg)` }} />
                  <span className="absolute -top-1 h-[13px] w-px bg-muted-foreground/40" style={{ left: `${(10 / 30) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <Caption>今天為台電今日預估，其餘為台電「未來一週電力供需預測」。細線標示 10% 充裕門檻。</Caption>
    </Tile>
  );
}

export function RegionTile({ areas }) {
  const { power } = useUnit();
  const latest = areas?.points?.at(-1);
  if (!latest) return null;
  const total = AREA_KEYS.reduce((sum, key) => sum + latest.areas[key], 0);
  const labels = { north: '北部', central: '中部', south: '南部', east: '東部' };
  return (
    <Tile icon={MapPin} label={`各區用電 · ${latest.time}`} className="lg:col-span-12">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {['north', 'central', 'south', 'east'].map((key) => (
          <div key={key}>
            <dt className="text-sm text-muted-foreground">{labels[key]}</dt>
            <dd className="num mt-1 text-xl font-bold">{power(latest.areas[key])}</dd>
            <dd className="num text-sm text-muted-foreground">{formatPercent(share(latest.areas[key], total))}</dd>
          </div>
        ))}
      </dl>
    </Tile>
  );
}
