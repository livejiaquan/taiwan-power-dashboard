import { useId } from 'react';

import { cn } from '../../lib/utils.js';

// Widget tile in the style of the iOS Weather/Health apps: a quiet caption
// with a small glyph, then the value. Tiles carry their own heading so each one
// is a landmark-free, self-describing unit for screen readers.
export function Tile({ icon: Icon, label, children, className, aside, id }) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('flex min-w-0 flex-col rounded-panel bg-card p-5 ring-1 ring-border sm:p-8', id && 'scroll-mt-24', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {Icon && <Icon className="size-3.5" aria-hidden="true" />}
          {label}
        </h2>
        {aside}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
