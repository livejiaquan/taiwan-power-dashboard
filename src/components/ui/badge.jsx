import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        success: 'border-status-g/25 bg-status-g/10 text-status-g',
        warning: 'border-status-y/30 bg-status-y/10 text-status-y-strong',
        stale: 'border-border bg-muted text-muted-foreground',
        error: 'border-status-r/25 bg-status-r/10 text-status-r'
      }
    },
    defaultVariants: { tone: 'neutral' }
  }
);

export function Badge({ className, tone, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
