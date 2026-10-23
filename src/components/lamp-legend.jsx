import { RESERVE_LEVELS } from '../lib/status.js';
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
    <li className="flex min-w-0 flex-col items-center gap-1">
      <span
        className={cn(
          'relative grid aspect-square w-full max-w-[40px] place-items-center rounded-full transition-[box-shadow,background] duration-500',
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
            className={cn('relative size-4', level.token === 'b' ? 'text-white' : 'text-[#0b131c]/80')}
            aria-hidden="true"
          />
        )}
      </span>
      <span className={cn('text-sm font-semibold', active ? 'text-white' : 'text-white/60')}>{SHORT[level.code]}燈</span>
    </li>
  );
}

// The official 0–25% band rule: orange ≤ 6%, yellow < 10%, green above. Red and
// black are judged on reserve megawatts, so they sit outside this ruler.
function ThresholdRuler({ rate, muted }) {
  const max = 25;
  const at = (value) => `${(Math.min(max, Math.max(0, value)) / max) * 100}%`;
  return (
    <div aria-hidden="true" className="mt-4">
      <div className="relative flex h-2 overflow-hidden rounded-full">
        <span style={{ width: at(6), background: LAMP.o }} />
        <span style={{ width: `calc(${at(10)} - ${at(6)})`, background: LAMP.y }} />
        <span className="flex-1" style={{ background: LAMP.g }} />
        {muted && <span className="absolute inset-0 bg-card/60" />}
      </div>
      <div className="relative h-5">
        <span
          className="absolute -top-[14px] size-4 -translate-x-1/2 rounded-full border-[3px] border-card bg-foreground"
          style={{ left: at(rate) }}
        />
        {[0, 6, 10, 20].map((tick) => (
          <span key={tick} className={cn('num absolute top-1.5 text-xs font-medium text-muted-foreground', tick > 0 && '-translate-x-1/2')} style={{ left: at(tick) }}>
            {tick}%
          </span>
        ))}
      </div>
    </div>
  );
}

// The signal head and the official 0–25% ruler, read like a colour scale.
export function LampLegend({ level, snapshot, rate, className }) {
  return (
    <div className={cn('rounded-panel border border-border bg-card p-4', className)}>
      <div role="img" aria-label={`台電官方五級燈號，${snapshot ? '最後更新時為' : '目前為'}${level ? level.name : '未知'}`}>
        <p className="text-sm font-semibold">台電供電燈號{snapshot && '（最後更新時）'}</p>
        <ol className="mt-3 grid grid-cols-5 gap-2 rounded-control bg-[#0e1823] px-3 py-2 ring-1 ring-black/5 dark:bg-[#080c11] dark:ring-white/[0.06]">
          {RESERVE_LEVELS.map((item) => (
            <Lamp key={item.code} level={item} active={item.code === level?.code} snapshot={snapshot} />
          ))}
        </ol>
      </div>
      <ThresholdRuler rate={rate} muted={snapshot} />
      <p className="text-xs text-muted-foreground">紅、黑燈改看備轉容量：90／50 萬瓩以下</p>
    </div>
  );
}
