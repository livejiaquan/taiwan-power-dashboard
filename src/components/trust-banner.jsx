import { AlertTriangle, CheckCircle2, CloudOff, Clock3, ExternalLink } from 'lucide-react';

import { formatAge, formatClockTime } from '../../js/dashboard-presenter.js';
import { cn } from '../lib/utils.js';

const TAIPOWER_LIVE = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html';

const TONE = {
  success: { icon: CheckCircle2, box: 'bg-card ring-border', icon_: 'text-status-g', dot: 'bg-status-g' },
  warning: { icon: Clock3, box: 'bg-status-y/[0.10] ring-status-y/35', icon_: 'text-status-y-strong', dot: 'bg-status-y' },
  stale: { icon: AlertTriangle, box: 'bg-card ring-foreground/25', icon_: 'text-foreground', dot: 'bg-muted-foreground' },
  error: { icon: CloudOff, box: 'bg-status-r/[0.07] ring-status-r/30', icon_: 'text-status-r', dot: 'bg-status-r' }
};

function OfficialLink({ className }) {
  return (
    <a
      href={TAIPOWER_LIVE}
      target="_blank"
      rel="noreferrer"
      className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background transition hover:opacity-90', className)}
    >
      看台電官網最新數字
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function SourceTime({ label, source, dot }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="num flex items-center gap-1.5 whitespace-nowrap text-[15px] font-semibold" title={source.text}>
        <span className={cn('size-1.5 shrink-0 -translate-y-px rounded-full', dot)} aria-hidden="true" />
        {source.observedAt ? `${formatClockTime(source.observedAt)}（${formatAge(source.ageMinutes)}）` : '--'}
      </dd>
    </div>
  );
}

// Freshness travels with the numbers: a thin strip that sits above the hero so
// "is this now?" is answered before any figure. It is a live region so
// re-aging is announced.
export function TrustBanner({ trust }) {
  const tone = TONE[trust.tone] || TONE.error;
  const Icon = tone.icon;
  const behind = trust.tone !== 'success';

  return (
    <section
      aria-live="polite"
      aria-labelledby="trust-title"
      className={cn('rounded-[20px] px-5 py-3.5 ring-1 sm:px-6', tone.box)}
    >
      <div className="flex flex-col gap-x-8 gap-y-2.5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Icon className={cn('size-[18px] shrink-0', tone.icon_)} aria-hidden="true" />
          <h2 id="trust-title" className="text-[15px] font-bold">{trust.title}</h2>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5 pl-[30px] lg:pl-0">
          <SourceTime label="供需" source={trust.sources.supply} dot={tone.dot} />
          <SourceTime label="機組" source={trust.sources.generation} dot={tone.dot} />
        </dl>
        {behind && trust.state !== 'unavailable' && <OfficialLink className="hidden lg:inline-flex" />}
      </div>
      <p className={cn('mt-1.5 max-w-3xl pl-[30px] text-pretty text-[13px] leading-5 text-muted-foreground', !behind && 'hidden sm:block')}>
        {trust.message} <span className="whitespace-nowrap">來源：{trust.sourceText.replace('台電官方資料 · ', '')}</span>
      </p>
      {behind && trust.state !== 'unavailable' && <OfficialLink className="ml-[30px] mt-3 lg:hidden" />}
    </section>
  );
}
