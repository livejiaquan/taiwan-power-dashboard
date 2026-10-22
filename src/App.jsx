import { describeTrustState } from '../js/dashboard-presenter.js';
import { taipeiDateKey } from '../js/power-curves.js';
import { AboutSection } from './components/about-section.jsx';
import { MixTile, NowPanel, RegionTile, WeekTile } from './components/bento.jsx';
import { ConstrainedUnits } from './components/constrained-units.jsx';
import { FuelBreakdown } from './components/fuel-breakdown.jsx';
import { MobileTabBar } from './components/mobile-tab-bar.jsx';
import { ReserveTrendCard } from './components/reserve-trend-card.jsx';
import { Section } from './components/section.jsx';
import { SiteFooter } from './components/site-footer.jsx';
import { SiteHeader } from './components/site-header.jsx';
import { LoadingState, UnavailableState } from './components/states.jsx';
import { StatusHero } from './components/status-hero.jsx';
import { TodayCurveCard } from './components/today-curve-card.jsx';
import { TrustBanner } from './components/trust-banner.jsx';
import { TooltipProvider } from './components/ui/tooltip.jsx';
import { UnitExplorer } from './components/unit-explorer.jsx';
import { useCurves } from './hooks/use-curves.js';
import { useDashboard } from './hooks/use-dashboard.js';
import { useTheme } from './hooks/use-theme.js';
import { UnitProvider } from './lib/units.jsx';

function Dashboard() {
  const { result, loading, ready, refresh, autoRefresh, setAutoRefresh } = useDashboard();
  const { theme, toggle } = useTheme();
  const trust = ready && result ? describeTrustState(result) : null;
  const model = result?.model;
  const freshness = result?.freshness;
  const timeLabel = freshness?.state === 'live' ? '目前' : '快照';
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg"
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

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1180px] px-4 pb-32 pt-4 outline-none sm:px-6 sm:pt-8 lg:pb-16">
        {!trust ? (
          <LoadingState />
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4">
              <TrustBanner trust={trust} />
              {model ? (
                <StatusHero model={model} freshness={freshness} />
              ) : (
                <h1 className="display px-1 pt-6 text-[32px] font-semibold sm:text-5xl">台灣現在的電夠不夠？</h1>
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

            {model ? (
              <div className="mt-16 space-y-16 sm:mt-24 sm:space-y-24">
                <TodayCurveCard curves={curvesForToday} model={model} theme={theme} />
                <ReserveTrendCard curves={curves} model={model} todayKey={todayKey} theme={theme} />
                <FuelBreakdown model={model} theme={theme} />
                <Section
                  id="units"
                  title="機組"
                  summary="台電公布的每一部機組即時淨發電量，以及目前檢修或運轉受限的大型機組。"
                >
                  <div className="grid gap-4 sm:gap-5 xl:grid-cols-12">
                    <div className="min-w-0 xl:col-span-8">
                      <UnitExplorer model={model} />
                    </div>
                    <div className="xl:col-span-4">
                      <ConstrainedUnits model={model} />
                    </div>
                  </div>
                </Section>
                <AboutSection />
              </div>
            ) : (
              <div className="mt-5 space-y-20">
                <UnavailableState onRetry={refresh} loading={loading} />
                <AboutSection />
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
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
