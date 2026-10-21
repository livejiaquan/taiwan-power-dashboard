import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '../../lib/utils.js';

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = 'top' }) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-72 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-lg'
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-popover" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
