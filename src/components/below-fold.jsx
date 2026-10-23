import { AboutSection } from './about-section.jsx';
import { ConstrainedUnits } from './constrained-units.jsx';
import { FuelBreakdown } from './fuel-breakdown.jsx';
import { ReserveTrendCard } from './reserve-trend-card.jsx';
import { Section } from './section.jsx';
import { SiteFooter } from './site-footer.jsx';
import { TodayCurveCard } from './today-curve-card.jsx';
import { UnitExplorer } from './unit-explorer.jsx';

// Everything below the first screen lives in its own chunk, so the first
// screen's bundle stays small and this code loads while the status paints.
export default function BelowFold({ curvesForToday, model, theme }) {
  return (
    <div className="mt-3 space-y-3 lg:mt-4 lg:space-y-4">
      <TodayCurveCard curves={curvesForToday} model={model} theme={theme} />
      <FuelBreakdown model={model} theme={theme} />
      <Section
        id="units"
        title="機組"
        summary="台電公布的每一部機組即時淨發電量，以及目前檢修或運轉受限的大型機組。"
      >
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-12">
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
  );
}

export { AboutSection, ReserveTrendCard, SiteFooter };
