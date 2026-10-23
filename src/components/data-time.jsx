import { ChevronDown, ExternalLink } from 'lucide-react';
import { useId, useState } from 'react';

import { describeDataTime, formatClockTime, formatDataAge } from '../../js/dashboard-presenter.js';
import { cn } from '../lib/utils.js';

const TAIPOWER_LIVE = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html';
const OFFICIAL = '台電官網';

function SourceTime({ label, source }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num font-semibold">
        {source.observedAt ? `${formatClockTime(source.observedAt)}（${formatDataAge(source.ageMinutes)}）` : '--'}
      </dd>
    </div>
  );
}

// The note ends by pointing at 台電官網; those words become the link so the
// sentence is not followed by a second, redundant link.
function Note({ text }) {
  const at = text.lastIndexOf(OFFICIAL);
  return (
    <p className="mt-2 max-w-xl text-pretty text-sm text-muted-foreground">
      {at < 0 ? text : text.slice(0, at)}
      {at >= 0 && (
        <a
          href={TAIPOWER_LIVE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-4 hover:text-accent"
        >
          {OFFICIAL}
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">（另開新視窗）</span>
        </a>
      )}
      {at >= 0 && text.slice(at + OFFICIAL.length)}
    </p>
  );
}

// The data time sits beside the answer, not in a banner above it: neutral
// when fresh, amber when old, and only past six hours does it add a sentence
// and the official link. Both feeds collapse into one label keyed to the
// older one; the per-feed times live behind 資料說明. It is a live region so the
// label re-ages audibly.
export function DataTime({ freshness, trust }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const time = describeDataTime(freshness);
  if (!time) return null;
  const amber = time.tone === 'amber';

  return (
    <div aria-live="polite" className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3">
        <p
          className={cn(
            'num inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-sm font-semibold',
            amber ? 'bg-status-y/15 text-status-y-text ring-1 ring-inset ring-status-y/40' : 'bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn('size-2 shrink-0 rounded-full', amber ? 'bg-status-y' : 'bg-status-g')}
            aria-hidden="true"
          />
          <span className="sr-only">{time.tierLabel}，</span>
          {time.label}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          資料說明
          <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>

      {time.note && <Note text={time.note} />}

      <div id={detailsId} hidden={!open} className="mt-2 max-w-xl rounded-control bg-muted px-4 py-3 text-sm">
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <SourceTime label="供需資料" source={trust.sources.supply} />
          <SourceTime label="機組資料" source={trust.sources.generation} />
        </dl>
        <p className="mt-2 text-pretty text-muted-foreground">
          {trust.message} 來源：{trust.sourceText.replace('台電官方資料 · ', '')}。
        </p>
      </div>
    </div>
  );
}
