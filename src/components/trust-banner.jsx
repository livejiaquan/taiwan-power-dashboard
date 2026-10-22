import { AlertTriangle, CheckCircle2, ChevronDown, CloudOff, Clock3, ExternalLink } from 'lucide-react';

import { useId, useState } from 'react';

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
      className={cn('inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90', className)}
    >
      看台電官網最新數字
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function SourceTime({ label, source, dot }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="num flex items-center gap-2 whitespace-nowrap text-base font-semibold" title={source.text}>
        <span className={cn('size-1.5 shrink-0 -translate-y-px rounded-full', dot)} aria-hidden="true" />
        {source.observedAt ? `${formatClockTime(source.observedAt)}（${formatAge(source.ageMinutes)}）` : '--'}
      </dd>
    </div>
  );
}

// Freshness travels with the numbers: one line above the hero answers "is this
// now?" before any figure; the full explanation and source sit behind a
// toggle so the strip never outweighs the answer. It is a live region so
// re-aging is announced.
export function TrustBanner({ trust }) {
  const tone = TONE[trust.tone] || TONE.error;
  const Icon = tone.icon;
  const behind = trust.tone !== 'success';
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <section
      aria-live="polite"
      aria-labelledby="trust-title"
      className={cn('rounded-panel px-5 py-2 ring-1 sm:px-8', tone.box)}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
        <div className="flex min-h-11 items-center gap-3">
          <Icon className={cn('size-5 shrink-0', tone.icon_)} aria-hidden="true" />
          <h2 id="trust-title" className="text-base font-bold">{trust.title}</h2>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <SourceTime label="供需" source={trust.sources.supply} dot={tone.dot} />
          <SourceTime label="機組" source={trust.sources.generation} dot={tone.dot} />
        </dl>
        <div className="flex items-center gap-4 lg:ml-auto">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-foreground/80 hover:text-foreground"
          >
            說明
            <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} aria-hidden="true" />
          </button>
          {behind && trust.state !== 'unavailable' && <OfficialLink />}
        </div>
      </div>
      <p id={detailsId} hidden={!open} className="max-w-3xl pb-3 text-pretty text-base text-muted-foreground">
        {trust.message} <span className="whitespace-nowrap">來源：{trust.sourceText.replace('台電官方資料 · ', '')}</span>
      </p>
    </section>
  );
}
