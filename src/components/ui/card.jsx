import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }) {
  return (
    <section
      className={cn('rounded-[20px] bg-card text-card-foreground ring-1 ring-border', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <header className={cn('flex flex-wrap items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8', className)} {...props} />;
}

export function CardTitle({ className, as: Tag = 'h2', ...props }) {
  return <Tag className={cn('text-lg font-bold tracking-tight text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-1.5 text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-6 pb-6 pt-6 sm:px-8 sm:pb-8', className)} {...props} />;
}
