import { BarChart3, BookOpen, Cpu, Gauge } from 'lucide-react';

const TABS = [
  ['#status', '狀態', Gauge],
  ['#trend', '趨勢', BarChart3],
  ['#units', '機組', Cpu],
  ['#about', '說明', BookOpen]
];

// Flat bottom bar for phones: thumb-reachable section jumps.
// Desktop keeps the inline navigation in the header instead.
export function MobileTabBar() {
  return (
    <nav
      aria-label="快速前往"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-center justify-around px-2">
        {TABS.map(([href, label, Icon]) => (
          <li key={href}>
            <a href={href} className="flex min-w-14 flex-col items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground">
              <Icon className="size-6" aria-hidden="true" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
