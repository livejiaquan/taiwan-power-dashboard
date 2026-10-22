import { Moon, Pause, Play, RefreshCw, Sun, Zap } from 'lucide-react';

import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';

const NAV = [
  ['#status', '供電狀態'],
  ['#today', '今日曲線'],
  ['#trend', '備轉趨勢'],
  ['#mix', '發電結構'],
  ['#units', '機組'],
  ['#about', '說明']
];

function IconButton({ label, onClick, disabled, pressed, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full text-foreground/80 transition hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}

// Apple-style global bar: translucent, hairline separator, quiet controls.
export function SiteHeader({ loading, onRefresh, theme, onToggleTheme, autoRefresh, onToggleAutoRefresh }) {
  const { unit, setUnit } = useUnit();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/72 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-12 max-w-[1120px] items-center gap-2 px-4 sm:h-14 sm:px-6">
        <a href="#top" className="flex min-w-0 items-center gap-2" aria-label="台灣電力即時看板，回到頁首">
          <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-foreground text-background">
            <Zap className="size-3.5 fill-[#ffd60a] text-[#ffd60a]" aria-hidden="true" />
          </span>
          <span className="truncate text-[15px] font-bold tracking-tight">台灣電力</span>
        </a>

        <nav aria-label="頁內導覽" className="mx-auto hidden items-center gap-1 text-[13px] text-foreground/70 lg:flex">
          {NAV.map(([href, label]) => (
            <a key={href} className="rounded-full px-3 py-1.5 transition hover:bg-foreground/[0.06] hover:text-foreground" href={href}>{label}</a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <div className="mr-1 inline-flex rounded-full bg-foreground/[0.06] p-0.5" role="group" aria-label="功率單位">
            {[['wan', '萬瓩'], ['mw', 'MW']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={unit === value}
                onClick={() => setUnit(value)}
                className={cn(
                  'h-7 rounded-full px-2.5 text-[12px] font-bold transition',
                  unit === value ? 'bg-card text-foreground shadow-sm' : 'text-foreground/75 hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <IconButton label={autoRefresh ? '暫停自動更新' : '恢復自動更新'} onClick={onToggleAutoRefresh} pressed={!autoRefresh}>
            {autoRefresh ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          </IconButton>
          <IconButton label="立即重新檢查資料" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden="true" />
          </IconButton>
          <IconButton label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'} onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
          </IconButton>
        </div>
      </div>
    </header>
  );
}
