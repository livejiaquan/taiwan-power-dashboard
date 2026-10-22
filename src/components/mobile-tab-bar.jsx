import { Activity, BarChart3, Cpu, Info } from 'lucide-react';

const TABS = [
  ['#status', '狀態', Activity],
  ['#trend', '趨勢', BarChart3],
  ['#units', '機組', Cpu],
  ['#about', '說明', Info]
];

// iOS-style floating tab bar for phones: thumb-reachable section jumps.
// Desktop keeps the inline navigation in the header instead.
export function MobileTabBar() {
  return (
    <nav
      aria-label="快速前往"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-4 pt-2 lg:hidden"
    >
      <ul className="mx-auto flex max-w-sm items-center justify-around rounded-full bg-card/80 px-2 py-2 shadow-[0_8px_30px_rgb(0_0_0/0.12)] ring-1 ring-border backdrop-blur-xl backdrop-saturate-150">
        {TABS.map(([href, label, Icon]) => (
          <li key={href}>
            <a href={href} className="flex min-w-14 flex-col items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-foreground/70 transition active:scale-95">
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
