import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { cn } from '../lib/utils.js';

const EChart = lazy(() => import('./echart.jsx'));

// ECharts is the heaviest chunk and no chart sits in the first screen, so it is
// fetched only when a chart comes within a screen of the viewport. Until then
// the placeholder already carries the chart's accessible description.
export function DeferredChart({ placeholderClassName, ...props }) {
  const ref = useRef(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (near) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '100% 0px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near]);

  const placeholder = (
    <div
      ref={near ? undefined : ref}
      role="img"
      aria-label={props.ariaLabel}
      className={cn('h-full animate-pulse rounded-xl bg-muted', placeholderClassName)}
    />
  );

  if (!near) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <EChart {...props} />
    </Suspense>
  );
}
