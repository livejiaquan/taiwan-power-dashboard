import { cn } from '../../lib/utils.js';

// A pressed-button group for switching what a chart shows. Unlike tabs it does
// not imply separate panels, so it carries no aria-controls.
export function Segmented({ label, value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-8 rounded-lg px-3 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
            value === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
