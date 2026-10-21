import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }) {
  return (
    <section
      className={cn('rounded-2xl border border-border bg-card text-card-foreground shadow-card', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <header className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6', className)} {...props} />;
}

export function CardTitle({ className, as: Tag = 'h2', ...props }) {
  return <Tag className={cn('text-[15px] font-semibold tracking-tight text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-1 text-[13px] leading-5 text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 pb-5 pt-4 sm:px-6 sm:pb-6', className)} {...props} />;
}
