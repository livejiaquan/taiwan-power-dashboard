import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }) {
  return (
    <section
      className={cn('rounded-panel bg-card text-card-foreground ring-1 ring-border', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <header className={cn('flex flex-wrap items-start justify-between gap-4 px-4 pt-4 sm:px-5', className)} {...props} />;
}

export function CardTitle({ className, as: Tag = 'h2', ...props }) {
  return <Tag className={cn('text-base font-medium text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-4 pb-4 pt-4 sm:px-5', className)} {...props} />;
}
