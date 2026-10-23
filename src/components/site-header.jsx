import { BarChart3, BookOpen, Cpu, ExternalLink, Gauge, LineChart, Moon, Pause, PieChart, Play, RefreshCw, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useUnit } from '../lib/units.jsx';
import { cn } from '../lib/utils.js';

const NAV = [
  ['status', '供電狀態', Gauge],
  ['today', '今日曲線', LineChart],
  ['trend', '備轉趨勢', BarChart3],
  ['mix', '發電結構', PieChart],
  ['units', '機組', Cpu],
  ['about', '說明', BookOpen]
];

const SOURCES = [
  ['台電今日電力資訊', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html'],
  ['今日電力資訊資料集', 'https://data.gov.tw/dataset/162595'],
  ['各機組發電量資料集', 'https://data.gov.tw/dataset/8931']
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
      className="grid size-11 place-items-center rounded-full text-foreground/80 transition hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}

// Brand mark (public/brand/mark.svg) plus wordmark: the same structure across
// the author's dashboards, only the icon and accent change.
function Brand({ subtitle = true }) {
  return (
    <a href="#top" className="flex min-h-11 shrink-0 items-center gap-[10px]">
      <img src="brand/mark.svg" alt="" width="32" height="32" className="size-8 shrink-0" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-base font-semibold tracking-[-0.01em]">台灣電力</span>
        {subtitle && <span className="block truncate text-xs font-medium text-muted-foreground">即時供電看板</span>}
      </span>
      <span className="sr-only">，回到頁首</span>
    </a>
  );
}

function UnitToggle({ className }) {
  const { unit, setUnit } = useUnit();
  return (
    <div className={cn('inline-flex rounded-full border border-border bg-panel p-1', className)} role="group" aria-label="功率單位">
      {[['wan', '萬瓩'], ['mw', 'MW']].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={unit === value}
          onClick={() => setUnit(value)}
          className={cn(
            'h-9 flex-1 whitespace-nowrap rounded-full px-2 text-sm font-medium transition pointer-coarse:h-11 lg:px-3',
            unit === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Controls({ loading, onRefresh, theme, onToggleTheme, autoRefresh, onToggleAutoRefresh }) {
  return (
    <>
      <IconButton label={autoRefresh ? '暫停自動更新' : '恢復自動更新'} onClick={onToggleAutoRefresh} pressed={!autoRefresh}>
        {autoRefresh ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
      </IconButton>
      <IconButton label="立即重新檢查資料" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={cn('size-5', loading && 'animate-spin')} aria-hidden="true" />
      </IconButton>
      <IconButton label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'} onClick={onToggleTheme}>
        {theme === 'dark' ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
      </IconButton>
    </>
  );
}

// Highlights the section in view, like the reference's current-page pill.
function useActiveSection() {
  const [active, setActive] = useState('status');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    // The canvas is sticky beside the panel, so several sections can be in
    // view at once; the first one in page order wins.
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id)));
      const first = NAV.find(([id]) => visible.has(id));
      if (first) setActive(first[0]);
    }, { rootMargin: '-20% 0px -60% 0px' });
    const watch = () => NAV.forEach(([id]) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    watch();
    // Sections below the fold mount later; pick them up once they exist.
    const mutation = new MutationObserver(watch);
    mutation.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);
  return active;
}

// Wide screens get the reference's left rail (208px: brand, page sections,
// a reference list, controls at the foot). Phones keep a slim top bar.
export function SiteHeader(props) {
  const active = useActiveSection();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[208px] flex-col border-r border-border bg-sidebar px-4 pb-4 pt-2 lg:flex">
        <Brand />
        <nav aria-label="頁內導覽" className="mt-4">
          <ul className="space-y-1">
            {NAV.map(([id, label, Icon]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'location' : undefined}
                  className={cn(
                    'flex h-8 items-center gap-2 rounded-[6px] px-2 text-sm font-semibold transition pointer-coarse:h-11',
                    active === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <Icon className="size-6" aria-hidden="true" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-6 px-2 text-xs font-medium text-muted-foreground">資料來源</p>
        <ul className="mt-2 space-y-1">
          {SOURCES.map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer" className="flex min-h-8 items-center gap-2 rounded-[6px] px-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground pointer-coarse:min-h-11">
                <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                {label}
                <span className="sr-only">（另開新視窗）</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-2">
          <UnitToggle className="flex w-full" />
          <div className="flex items-center justify-between">
            <Controls {...props} />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-border bg-sidebar lg:hidden">
        <div className="flex h-14 items-center gap-1 px-3">
          <Brand subtitle={false} />
          <div className="ml-auto flex items-center gap-1">
            <UnitToggle />
            <Controls {...props} />
          </div>
        </div>
      </header>
    </>
  );
}
