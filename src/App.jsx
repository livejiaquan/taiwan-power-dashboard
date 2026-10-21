import { describeTrustState } from '../js/dashboard-presenter.js';
import { ConstrainedUnits } from './components/constrained-units.jsx';
import { FuelBreakdown } from './components/fuel-breakdown.jsx';
import { GridNowCard } from './components/grid-now-card.jsx';
import { ReserveStatusCard } from './components/reserve-status-card.jsx';
import { SiteFooter } from './components/site-footer.jsx';
import { SiteHeader } from './components/site-header.jsx';
import { LoadingState, UnavailableState } from './components/states.jsx';
import { TrustBanner } from './components/trust-banner.jsx';
import { TooltipProvider } from './components/ui/tooltip.jsx';
import { UnitExplorer } from './components/unit-explorer.jsx';
import { useDashboard } from './hooks/use-dashboard.js';
import { useTheme } from './hooks/use-theme.js';

export function App() {
  const { result, loading, ready, refresh } = useDashboard();
  const { theme, toggle } = useTheme();
  const trust = ready && result ? describeTrustState(result) : null;
  const model = result?.model;
  const freshness = result?.freshness;
  const timeLabel = freshness?.state === 'live' ? '目前' : '快照';

  return (
    <TooltipProvider>
      <div id="top" className="min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
          跳至主要內容
        </a>
        <SiteHeader trust={trust} loading={loading} onRefresh={refresh} theme={theme} onToggleTheme={toggle} />

        <main id="main-content" className="mx-auto max-w-7xl space-y-4 px-4 pt-6 sm:px-6 lg:pt-8">
          <div className="mb-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">台灣現在的電夠不夠？</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              台電官方供電燈號、備轉容量率與即時發電結構。每個數字都標示官方資料時間，延遲或過期時會明確提示。
            </p>
          </div>

          {!trust ? (
            <LoadingState />
          ) : (
            <>
              <TrustBanner trust={trust} />
              {model ? (
                <>
                  <div id="status" className="grid scroll-mt-20 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                      <ReserveStatusCard model={model} freshness={freshness} trust={trust} />
                    </div>
                    <div className="lg:col-span-7">
                      <GridNowCard model={model} timeLabel={timeLabel} />
                    </div>
                  </div>
                  <FuelBreakdown model={model} theme={theme} />
                  <div className="grid gap-4 xl:grid-cols-12">
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
            </>
          )}
        </main>
        <SiteFooter />
      </div>
    </TooltipProvider>
  );
}
