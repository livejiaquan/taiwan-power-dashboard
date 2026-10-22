import { CheckCircle2, Wrench } from 'lucide-react';


import { useUnit } from '../lib/units.jsx';
import { fuelColor } from '../lib/fuel.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';

export function ConstrainedUnits({ model }) {
  const { power, powerValue, unitLabel } = useUnit();
  const units = model.constrainedUnits || [];
  const idleCapacity = units.reduce(
    (sum, unit) => sum + Math.max(0, (unit.capacityMw ?? 0) - Math.max(0, unit.netGenerationMw ?? 0)),
    0
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div>
          <CardTitle as="h3">檢修與運轉限制</CardTitle>
          <CardDescription>依官方備註列出裝置容量最大的機組</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {units.length === 0 ? (
          <div className="grid h-full place-items-center py-12 text-center text-base text-muted-foreground">
            <div>
              <CheckCircle2 className="mx-auto mb-2 size-6 text-status-g" aria-hidden="true" />
              目前資料中沒有檢修或限制備註。
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-muted px-5 py-4">
              <p className="text-sm text-muted-foreground">下列機組未發出的容量合計</p>
              <p className="num mt-1 text-2xl font-bold tracking-tight">
                {powerValue(idleCapacity)} <span className="text-sm font-bold text-muted-foreground">{unitLabel}</span>
              </p>
            </div>
            <ul className="mt-4 divide-y divide-border/70">
              {units.map((unit, index) => {
                const output = Math.max(0, unit.netGenerationMw ?? 0);
                const percent = unit.capacityMw > 0 ? Math.min(100, (output / unit.capacityMw) * 100) : 0;
                return (
                  <li key={`${unit.name}-${index}`} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{unit.name}</p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="size-2 rounded-full" style={{ background: fuelColor({ key: unit.categoryKey, color: unit.color }) }} aria-hidden="true" />
                          {unit.type}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm font-semibold text-muted-foreground">
                        <Wrench className="size-3" aria-hidden="true" />
                        {unit.note}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                        <span className="block h-full rounded-full bg-foreground/60" style={{ width: `${percent}%` }} />
                      </span>
                      <span className="num whitespace-nowrap text-sm text-muted-foreground">
                        {power(unit.netGenerationMw)} / {power(unit.capacityMw)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
