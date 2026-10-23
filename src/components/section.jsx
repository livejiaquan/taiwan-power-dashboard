import { useId } from 'react';

import { cn } from '../lib/utils.js';

// A group of cards under one quiet heading, the same size as card titles so
// section heads never compete with the answer.
export function Section({ id, title, summary, actions, children, className }) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn('scroll-mt-20', className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1">
        <div className="max-w-2xl">
          <h2 id={headingId} className="text-base font-medium">{title}</h2>
          {summary && <p className="mt-1 text-pretty text-sm text-muted-foreground">{summary}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
