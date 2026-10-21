import { Moon, Pause, Play, RefreshCw, Sun, Zap } from 'lucide-react';

import { formatAge, formatClockTime } from '../../js/dashboard-presenter.js';
import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';

const TONE_DOT = {
  success: 'bg-status-g',
  warning: 'bg-status-y',
  stale: 'bg-subtle-foreground',
  error: 'bg-status-r'
};

const NAV = [
  ['#status', '供電狀態'],
  ['#today', '今日曲線'],
  ['#trend', '備轉趨勢'],
  ['#mix', '發電結構'],
  ['#units', '機組'],
  ['#about', '資料說明']
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
      className="grid size-9 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function SiteHeader({ trust, loading, onRefresh, theme, onToggleTheme, autoRefresh, onToggleAutoRefresh }) {
  const { unit, setUnit } = useUnit();
  const oldest = trust?.sources
    ? [trust.sources.supply, trust.sources.generation]
      .filter((source) => source.observedAt)
      .sort((a, b) => a.observedAt - b.observedAt)[0]
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <a href="#top" className="flex min-w-0 items-center gap-2.5" aria-label="台灣電力即時看板，回到頁首">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background">
            <Zap className="size-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
          </span>
          <span className="hidden truncate text-[15px] font-semibold tracking-tight min-[400px]:inline">台灣電力即時看板</span>
        </a>

        <nav aria-label="頁內導覽" className="ml-3 hidden items-center gap-0.5 text-[13px] text-muted-foreground lg:flex">
          {NAV.map(([href, label]) => (
            <a key={href} className="rounded-md px-2.5 py-1.5 hover:bg-muted hover:text-foreground" href={href}>{label}</a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {trust && oldest && (
            <span
              className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:inline-flex"
              title={trust.title}
            >
              <span className={cn('size-2 rounded-full', TONE_DOT[trust.tone])} aria-hidden="true" />
              <span>資料時間</span>
              <span className="num font-semibold text-foreground">{formatClockTime(oldest.observedAt)}</span>
              <span className="num">{formatAge(oldest.ageMinutes)}</span>
            </span>
          )}

          <div className="inline-flex h-9 rounded-lg border border-border bg-card p-0.5" role="group" aria-label="功率單位">
            {[['wan', '萬瓩'], ['mw', 'MW']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={unit === value}
                onClick={() => setUnit(value)}
                className={cn(
                  'rounded-md px-2 text-xs font-medium',
                  unit === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <IconButton
            label={autoRefresh ? '暫停自動更新' : '恢復自動更新'}
            onClick={onToggleAutoRefresh}
            pressed={!autoRefresh}
          >
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
