import { CalendarDays, Leaf, MapPin, PieChart, Zap } from 'lucide-react';

import { formatNumber, formatPercent, getPositiveCategories } from '../../js/dashboard-presenter.js';
import { AREA_KEYS } from '../../js/power-curves.js';
import { fuelColor, fuelStyle, sortByFuelOrder } from '../lib/fuel.js';
import { levelFor } from '../lib/status.js';
import { useUnit } from '../lib/units.jsx';
import { Ring } from './ui/ring.jsx';
import { Tile } from './ui/tile.jsx';
import { Tooltip } from './ui/tooltip.jsx';

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const SHORT_LABEL = { 'other-renewable': '其他再生', cogeneration: '汽電共生' };

function share(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function BigValue({ value, unit }) {
  return (
    <p className="num display text-[34px] font-semibold leading-none sm:text-[40px]">
      {value}
      {unit && <span className="ml-1 text-[15px] font-medium tracking-normal text-muted-foreground">{unit}</span>}
    </p>
  );
}

function Caption({ children }) {
  return <p className="mt-auto pt-4 text-pretty text-[13px] leading-5 text-muted-foreground">{children}</p>;
}

export function LoadTile({ model, timeLabel }) {
  const { powerValue, unitLabel, power } = useUnit();
  const { metrics, supply } = model;
  const capacityMw = supply.realHourMaxSupplyCapacityMw ?? metrics.forecastMaxSupplyCapacityMw;
  return (
    <Tile id="now" icon={Zap} label={`${timeLabel}用電`}>
      <BigValue value={powerValue(metrics.currentLoadMw)} unit={unitLabel} />
      <div className="mt-5 flex items-center gap-3.5">
        <Ring value={metrics.currentUtilizationPercent} size={52} stroke={7} />
        <div className="min-w-0 leading-tight">
          <p className="num text-[20px] font-semibold">{formatPercent(metrics.currentUtilizationPercent, 0)}<span className="ml-1 text-[13px] font-medium text-muted-foreground">使用率</span></p>
          <p className="num mt-0.5 truncate text-[13px] text-muted-foreground">供電能力 {power(capacityMw)}</p>
        </div>
      </div>
      <Caption>使用率＝目前用電 ÷ 當下最大供電能力。</Caption>
    </Tile>
  );
}

export function RenewableTile({ model }) {
  const { metrics } = model;
  const categories = getPositiveCategories(model);
  const total = categories.reduce((sum, category) => sum + category.netGenerationMw, 0);
  const top = categories
    .filter((category) => fuelStyle(category.key).group === 'renewable')
    .sort((a, b) => b.netGenerationMw - a.netGenerationMw)
    .slice(0, 2);
  return (
    <Tile icon={Leaf} label="再生能源">
      <div className="flex items-center justify-between gap-4">
        <BigValue value={formatNumber(metrics.renewableSharePercent, 1)} unit="%" />
        <Ring value={metrics.renewableSharePercent} size={64} stroke={8} color="#34c759" />
      </div>
      <Caption>
        {top.map((category) => `${category.labelZh} ${formatPercent(share(category.netGenerationMw, total))}`).join('、')}
        {top.length ? '。' : ''}低碳占比 {formatPercent(metrics.lowCarbonSharePercent)}。
      </Caption>
    </Tile>
  );
}

export function MixTile({ model }) {
  const { power } = useUnit();
  const categories = sortByFuelOrder(getPositiveCategories(model));
  const total = categories.reduce((sum, category) => sum + category.netGenerationMw, 0);
  const ranked = [...categories].sort((a, b) => b.netGenerationMw - a.netGenerationMw);

  return (
    <Tile icon={PieChart} label="電從哪裡來" className="sm:col-span-2" aside={<span className="num text-[12px] text-muted-foreground">合計 {power(total)}</span>}>
      <div
        className="flex h-11 w-full overflow-hidden rounded-[14px]"
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
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {ranked.map((category) => (
          <li key={category.key} className="flex min-w-0 items-center gap-2 text-[14px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: fuelColor(category) }} aria-hidden="true" />
            <span className="truncate">{SHORT_LABEL[category.key] || category.labelZh}</span>
            <span className="num ml-auto font-semibold">{formatPercent(share(category.netGenerationMw, total))}</span>
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
    <Tile id="week" icon={CalendarDays} label="未來一週備轉預估" className="sm:col-span-2 lg:row-span-2">
      {days.length <= 1 ? (
        <p className="text-[14px] text-muted-foreground">台電一週預測暫時無法取得。</p>
      ) : (
        <ol className="divide-y divide-border">
          {days.map((day) => {
            const level = levelFor(tokenFor(day.reserveRatePercent, day.reserveMw));
            const Icon = level.icon;
            const position = Math.min(100, Math.max(0, (day.reserveRatePercent / 30) * 100));
            return (
              <li key={day.date} className="grid grid-cols-[44px_22px_52px_1fr] items-center gap-3 py-3 first:pt-1 last:pb-0">
                <span className="text-[15px] font-semibold">{dayName(day.date, todayKey)}</span>
                <span className="grid size-[22px] place-items-center rounded-full" style={{ background: `var(--status-${level.token}-bg)`, color: `var(--status-${level.token}-on)` }}>
                  <Icon className="size-3" aria-hidden="true" />
                  <span className="sr-only">{level.label}</span>
                </span>
                <span className="num text-right text-[15px] font-semibold">{formatNumber(day.reserveRatePercent, 1)}%</span>
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
    <Tile icon={MapPin} label={`各區用電 · ${latest.time}`} className="sm:col-span-2 lg:col-span-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {['north', 'central', 'south', 'east'].map((key) => (
          <div key={key}>
            <dt className="text-[13px] text-muted-foreground">{labels[key]}</dt>
            <dd className="num mt-1 text-[20px] font-semibold">{power(latest.areas[key])}</dd>
            <dd className="num text-[13px] text-muted-foreground">{formatPercent(share(latest.areas[key], total))}</dd>
          </div>
        ))}
      </dl>
    </Tile>
  );
}
