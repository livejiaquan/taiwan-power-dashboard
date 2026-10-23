import { lazy, Suspense, useDeferredValue } from 'react';

import { describeTrustState } from '../js/dashboard-presenter.js';
import { taipeiDateKey } from '../js/power-curves.js';
import { MixTile, NowPanel, RegionTile, WeekTile } from './components/bento.jsx';
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
    <div id="top" className="min-h-screen">
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

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 pb-32 pt-4 outline-none sm:px-6 sm:pt-8 lg:pb-16">
        {!trust ? (
          <LoadingState />
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4">
              {model ? (
                <StatusHero model={model} freshness={freshness} trust={trust} />
              ) : (
                <h1 className="display px-1 pt-6 text-3xl font-semibold sm:text-5xl">台灣現在的電夠不夠？</h1>
              )}
              {model && (
                <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
                  <NowPanel model={model} timeLabel={timeLabel} />
                  <WeekTile curves={curves} model={model} todayKey={todayKey} />
                  <MixTile model={model} />
                  <RegionTile areas={curvesForToday?.areas} />
                </div>
              )}
            </div>

            {model ? restModel && (
              <Suspense fallback={null}>
                <BelowFold curves={curves} curvesForToday={curvesForToday} model={restModel} todayKey={todayKey} theme={theme} />
              </Suspense>
            ) : (
              <div className="mt-6 space-y-16">
                <UnavailableState onRetry={refresh} loading={loading} />
                <Suspense fallback={null}>
                  <AboutSection />
                </Suspense>
              </div>
            )}
          </>
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
