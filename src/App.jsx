import { describeTrustState } from '../js/dashboard-presenter.js';
import { taipeiDateKey } from '../js/power-curves.js';
import { AboutSection } from './components/about-section.jsx';
import { ConstrainedUnits } from './components/constrained-units.jsx';
import { FuelBreakdown } from './components/fuel-breakdown.jsx';
import { GridNowCard } from './components/grid-now-card.jsx';
import { ReserveStatusCard } from './components/reserve-status-card.jsx';
import { ReserveTrendCard } from './components/reserve-trend-card.jsx';
import { SiteFooter } from './components/site-footer.jsx';
import { SiteHeader } from './components/site-header.jsx';
import { LoadingState, UnavailableState } from './components/states.jsx';
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow-lg"
      >
        跳至主要內容
      </a>
      <SiteHeader
        trust={trust}
        loading={loading}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={toggle}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
      />

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl space-y-4 px-4 pb-4 pt-6 outline-none sm:px-6 lg:space-y-5 lg:pt-8">
        <div className="mb-1 max-w-3xl">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">台灣現在的電夠不夠？</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
            直接採用台電官方燈號、備轉容量與即時發電資料；每個數字都標示官方資料時間，延遲或過期時會明確提示。
          </p>
        </div>

        {!trust ? (
          <LoadingState />
        ) : (
          <>
            <TrustBanner trust={trust} />
            {model ? (
              <>
                <section id="status" aria-label="供電狀態" className="grid scroll-mt-20 gap-4 lg:grid-cols-12 lg:gap-5">
                  <div className="lg:col-span-5">
                    <ReserveStatusCard model={model} freshness={freshness} />
                  </div>
                  <div className="lg:col-span-7">
                    <GridNowCard model={model} timeLabel={timeLabel} areas={curvesForToday?.areas} />
                  </div>
                </section>
                <TodayCurveCard curves={curvesForToday} model={model} theme={theme} />
                <ReserveTrendCard curves={curves} model={model} todayKey={todayKey} theme={theme} />
                <FuelBreakdown model={model} theme={theme} />
                <div className="grid gap-4 lg:gap-5 xl:grid-cols-12">
                  <div className="min-w-0 xl:col-span-8">
                    <UnitExplorer model={model} />
                  </div>
                  <div className="xl:col-span-4">
                    <ConstrainedUnits model={model} />
                  </div>
                </div>
              </>
            ) : (
              <UnavailableState onRetry={refresh} loading={loading} />
            )}
            <AboutSection />
          </>
        )}
      </main>
      <SiteFooter />
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
