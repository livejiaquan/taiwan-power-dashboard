import { Moon, RefreshCw, Sun, Zap } from 'lucide-react';

import { cn } from '../lib/utils.js';

const TONE_DOT = {
  success: 'bg-status-g',
  warning: 'bg-status-y',
  stale: 'bg-subtle-foreground',
  error: 'bg-status-r'
};

export function SiteHeader({ trust, loading, onRefresh, theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <a href="#top" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background">
            <Zap className="size-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
          </span>
          <span className="truncate text-[15px] font-semibold tracking-tight">台灣電力即時看板</span>
        </a>

        <nav aria-label="頁內導覽" className="ml-4 hidden items-center gap-1 text-[13px] text-muted-foreground md:flex">
          <a className="rounded-md px-2.5 py-1.5 hover:bg-muted hover:text-foreground" href="#status">供電狀態</a>
          <a className="rounded-md px-2.5 py-1.5 hover:bg-muted hover:text-foreground" href="#mix">發電結構</a>
          <a className="rounded-md px-2.5 py-1.5 hover:bg-muted hover:text-foreground" href="#units">機組</a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {trust && (
            <span
              className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex"
              title={trust.title}
            >
              <span className={cn('size-2 rounded-full', TONE_DOT[trust.tone], trust.tone === 'success' && 'animate-pulse')} aria-hidden="true" />
              <span>資料時間</span>
              <span className="num font-medium text-foreground">{trust.oldestObservedText}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} aria-hidden="true" />
            <span className="hidden sm:inline">重新檢查</span>
            <span className="sr-only sm:hidden">重新檢查資料</span>
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="grid size-8 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
            aria-label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
          >
            {theme === 'dark' ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
