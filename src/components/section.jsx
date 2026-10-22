import { useId } from 'react';

import { cn } from '../lib/utils.js';

// Editorial section: the heading and one-line explanation sit on the page,
// not inside the card, so each block reads as a short story with room to
// breathe (grid.iamkate / Our World in Data practice).
export function Section({ id, title, summary, actions, children, className }) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn('scroll-mt-24', className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-6">
        <div className="max-w-2xl">
          <h2 id={headingId} className="display text-[24px] font-bold sm:text-[32px]">{title}</h2>
          {summary && <p className="mt-2 text-pretty text-[15px] leading-7 text-muted-foreground sm:text-[17px]">{summary}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
