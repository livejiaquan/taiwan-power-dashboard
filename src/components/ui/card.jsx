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
  return <header className={cn('flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-8', className)} {...props} />;
}

export function CardTitle({ className, as: Tag = 'h2', ...props }) {
  return <Tag className={cn('text-lg font-bold tracking-tight text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-2 text-base text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 pb-5 pt-6 sm:px-8 sm:pb-8', className)} {...props} />;
}
