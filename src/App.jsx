import { describeReserveStatus, describeTrustState } from '../js/dashboard-presenter.js';
import { taipeiDateKey } from '../js/power-curves.js';
import { AboutSection } from './components/about-section.jsx';
import { ConstrainedUnits } from './components/constrained-units.jsx';
import { FuelBreakdown } from './components/fuel-breakdown.jsx';
import { GridNowCard } from './components/grid-now-card.jsx';
import { ReserveStatusCard } from './components/reserve-status-card.jsx';
import { ReserveTrendCard } from './components/reserve-trend-card.jsx';
import { Section } from './components/section.jsx';
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
import { levelFor } from './lib/status.js';
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
  const reserve = model ? describeReserveStatus(model, freshness) : null;
  const answer = reserve
    ? `${freshness?.state === 'live' ? `目前是${levelFor(reserve.indicator)?.name ?? ''}・${model.health.labelZh}` : reserve.headline}。今日尖峰預估備轉容量率 ${reserve.rateText}，${reserve.summary}。`
    : trust ? '目前無法確認供電狀態，因此不顯示任何數字。' : null;

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

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 pb-8 outline-none sm:px-8">
        <div className="pb-10 pt-12 sm:pb-14 sm:pt-20">
          <p className="text-sm font-medium text-accent">台電官方開放資料 · 每個數字都標示資料時間</p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.15] tracking-tight sm:text-5xl">台灣現在的電夠不夠？</h1>
          <p className="mt-5 max-w-3xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">
            {answer || '正在確認台電官方燈號、備轉容量與即時發電資料。延遲或過期的資料一定會先標示出來。'}
          </p>
        </div>

        {!trust ? (
          <LoadingState />
        ) : (
          <div className="space-y-14 sm:space-y-20">
            <TrustBanner trust={trust} />
            {model ? (
              <>
                <Section
                  id="status"
                  title="今日供電狀態"
                  summary="台電依當日尖峰時段的備轉容量公布燈號，綠燈代表備轉容量率在 10% 以上。"
                >
                  <ReserveStatusCard model={model} freshness={freshness} />
                </Section>
                <Section
                  id="now"
                  title={`${timeLabel}用電`}
                  summary="現在用了多少電、離供電上限還有多遠，以及這些電由哪些能源發出。"
                >
                  <GridNowCard model={model} timeLabel={timeLabel} areas={curvesForToday?.areas} />
                </Section>
                <TodayCurveCard curves={curvesForToday} model={model} theme={theme} />
                <ReserveTrendCard curves={curves} model={model} todayKey={todayKey} theme={theme} />
                <FuelBreakdown model={model} theme={theme} />
                <Section
                  id="units"
                  title="機組"
                  summary="台電公布的每一部機組即時淨發電量，以及目前檢修或運轉受限的大型機組。"
                >
                  <div className="grid gap-6 lg:gap-8 xl:grid-cols-12">
                    <div className="min-w-0 xl:col-span-8">
                      <UnitExplorer model={model} />
                    </div>
                    <div className="xl:col-span-4">
                      <ConstrainedUnits model={model} />
                    </div>
                  </div>
                </Section>
              </>
            ) : (
              <UnavailableState onRetry={refresh} loading={loading} />
            )}
            <AboutSection />
          </div>
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
