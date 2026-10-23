import { lazy, Suspense, useDeferredValue } from 'react';

import { describeTrustState } from '../js/dashboard-presenter.js';
import { taipeiDateKey } from '../js/power-curves.js';
import { MobileTabBar } from './components/mobile-tab-bar.jsx';
import { SiteHeader } from './components/site-header.jsx';
import { LoadingState, UnavailableState } from './components/states.jsx';
import { StatusHero } from './components/status-hero.jsx';
import { TooltipProvider } from './components/ui/tooltip.jsx';
import { useCurves } from './hooks/use-curves.js';
import { useDashboard } from './hooks/use-dashboard.js';
import { useTheme } from './hooks/use-theme.js';
import { UnitProvider } from './lib/units.jsx';

const BelowFold = lazy(() => import('./components/below-fold.jsx'));
const AboutSection = lazy(() => import('./components/below-fold.jsx').then((m) => ({ default: m.AboutSection })));
const ReserveTrendCard = lazy(() => import('./components/below-fold.jsx').then((m) => ({ default: m.ReserveTrendCard })));
const SiteFooter = lazy(() => import('./components/below-fold.jsx').then((m) => ({ default: m.SiteFooter })));

function Dashboard() {
  const { result, loading, ready, refresh, autoRefresh, setAutoRefresh } = useDashboard();
  const { theme, toggle } = useTheme();
  const trust = ready && result ? describeTrustState(result) : null;
  const model = result?.model;
  // Everything below the first screen renders in a deferred, time-sliced pass
  // so the status answer paints first and the main thread never blocks long.
  const restModel = useDeferredValue(model ?? null, null);
  const freshness = result?.freshness;
  const timeLabel = freshness?.state === 'live' ? '目前' : '當時';
  const supplyObservedAt = model?.feeds?.supply?.observedAt;
  const { curves } = useCurves(model?.fetchedAt?.getTime?.() || null);
  const todayKey = supplyObservedAt ? taipeiDateKey(supplyObservedAt) : null;
  // Curves only describe "today" when they are for the same Taipei date as
  // the validated snapshot.
  const curvesForToday = curves && curves.todayKey === todayKey ? curves : null;

  return (
    <div id="top" className="min-h-screen lg:pl-[208px]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-3 focus:shadow-lg"
      >
        跳至主要內容
      </a>
      <SiteHeader
        loading={loading}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={toggle}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
      />

      <main id="main-content" tabIndex={-1} className="px-3 pb-24 pt-3 outline-none lg:pb-12">
        {!trust ? (
          <LoadingState />
        ) : model ? (
          <>
            {/* The reference's first screen: a 458px panel of stacked cards
                beside one large canvas (its map; our reserve-rate chart). */}
            <div className="grid gap-3 lg:grid-cols-[458px_minmax(0,1fr)] lg:items-start">
              <div className="lg:rounded-panel lg:border lg:border-border lg:bg-panel lg:p-3">
                <StatusHero model={model} freshness={freshness} trust={trust} timeLabel={timeLabel} />
              </div>
              <div className="relative lg:sticky lg:top-3 lg:h-[calc(100vh-24px)]">
                <Suspense fallback={<div className="h-[420px] rounded-panel border border-border bg-card lg:h-full" />}>
                  {restModel ? (
                    <ReserveTrendCard
                      curves={curves}
                      model={restModel}
                      todayKey={todayKey}
                      theme={theme}
                      className="lg:h-full"
                      chartClassName="h-[300px] lg:h-auto lg:min-h-[320px] lg:flex-1"
                    />
                  ) : (
                    <div className="h-[420px] rounded-panel border border-border bg-card lg:h-full" />
                  )}
                </Suspense>
              </div>
            </div>

            {restModel && (
              <Suspense fallback={null}>
                <BelowFold curvesForToday={curvesForToday} model={restModel} theme={theme} />
              </Suspense>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <h1 className="px-1 pt-3 text-base font-medium">台灣現在的電夠不夠？</h1>
            <UnavailableState onRetry={refresh} loading={loading} />
            <Suspense fallback={null}>
              <AboutSection />
            </Suspense>
          </div>
        )}
      </main>
      {/* Held back until the page below the fold exists, so it never jumps. */}
      {trust && (restModel || !model) && (
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
      )}
      <MobileTabBar />
    </div>
  );
}

export function App() {
  return (
    <TooltipProvider>
      <UnitProvider>
        <Dashboard />
      </UnitProvider>
    </TooltipProvider>
  );
}
