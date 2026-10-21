import { AlertTriangle, CheckCircle2, CloudOff, Clock3 } from 'lucide-react';

import { formatClockTime } from '../../js/dashboard-presenter.js';
import { cn } from '../lib/utils.js';

const TONE = {
  success: {
    icon: CheckCircle2,
    box: 'border-status-g/20 bg-status-g/[0.06]',
    icon_: 'text-status-g'
  },
  warning: {
    icon: Clock3,
    box: 'border-status-y/30 bg-status-y/[0.08]',
    icon_: 'text-status-y-strong'
  },
  stale: {
    icon: AlertTriangle,
    box: 'border-border bg-muted',
    icon_: 'text-muted-foreground'
  },
  error: {
    icon: CloudOff,
    box: 'border-status-r/25 bg-status-r/[0.06]',
    icon_: 'text-status-r'
  }
};

function SourceChip({ label, source }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/80 bg-card/70 px-3 py-2">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 truncate text-[13px] font-medium" title={source.text}>
        {source.observedAt ? `${formatClockTime(source.observedAt)} · ${source.ageMinutes} 分鐘前` : '--'}
      </dd>
    </div>
  );
}

// Every page state leads with this strip: what the data is, how old it is, and
// whether it may be read as "now". It is a live region so re-aging is announced.
export function TrustBanner({ trust }) {
  const tone = TONE[trust.tone] || TONE.error;
  const Icon = tone.icon;

  return (
    <section
      aria-live="polite"
      aria-labelledby="trust-title"
      className={cn('rounded-2xl border px-4 py-3.5 sm:px-5', tone.box)}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <Icon className={cn('mt-0.5 size-5 shrink-0', tone.icon_)} aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="trust-title" className="text-sm font-semibold">{trust.title}</h2>
            <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{trust.message}</p>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[600px]">
          <SourceChip label="今日電力資訊" source={trust.sources.supply} />
          <SourceChip label="各機組發電量" source={trust.sources.generation} />
          <div className="col-span-2 min-w-0 rounded-lg border border-border/80 bg-card/70 px-3 py-2 sm:col-span-1">
            <dt className="text-[11px] font-medium text-muted-foreground">資料來源</dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium" title={trust.sourceText}>{trust.sourceText.replace('台電官方資料 · ', '')}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
