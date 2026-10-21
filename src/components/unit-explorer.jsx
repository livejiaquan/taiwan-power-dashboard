import { ArrowDownWideNarrow, Search, Wrench } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

import { formatPercent } from '../../js/dashboard-presenter.js';
import { useUnit } from '../lib/units.jsx';
import { fuelColor, sortByFuelOrder } from '../lib/fuel.js';
import { cn } from '../lib/utils.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';

const PAGE_SIZE = 15;

const SORTS = {
  output: { label: '依淨發電', compare: (a, b) => (b.netGenerationMw ?? -Infinity) - (a.netGenerationMw ?? -Infinity) },
  capacity: { label: '依裝置容量', compare: (a, b) => (b.capacityMw ?? -Infinity) - (a.capacityMw ?? -Infinity) },
  factor: { label: '依使用率', compare: (a, b) => (b.utilizationPercent ?? -Infinity) - (a.utilizationPercent ?? -Infinity) }
};

function hasNote(unit) {
  return Boolean(unit.note && unit.note !== '-');
}

function FilterChip({ active, onClick, color, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition',
        active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground'
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function UnitExplorer({ model }) {
  const { power } = useUnit();
  const units = useMemo(() => model.generation?.units || [], [model.generation]);
  const categories = useMemo(() => sortByFuelOrder(model.categories), [model.categories]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('output');
  const [notesOnly, setNotesOnly] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());

  const filtered = useMemo(() => units
    .filter((unit) => category === 'all' || unit.categoryKey === category)
    .filter((unit) => !notesOnly || hasNote(unit))
    .filter((unit) => !deferredQuery || unit.name.includes(deferredQuery) || unit.type.includes(deferredQuery))
    .sort(SORTS[sort].compare), [units, category, notesOnly, deferredQuery, sort]);

  const visible = expanded ? filtered : filtered.slice(0, PAGE_SIZE);
  const noteCount = units.filter(hasNote).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h3">機組查詢</CardTitle>
          <CardDescription>
            台電公布的 {units.length} 筆機組即時淨發電量；可依燃料別、關鍵字與檢修/限制備註篩選。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block lg:w-72">
            <span className="sr-only">搜尋機組</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setExpanded(false); }}
              placeholder="搜尋機組名稱，例如 大潭、台中"
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm placeholder:text-subtle-foreground focus:outline-2 focus:outline-ring"
            />
          </label>
          <div className="flex items-center gap-2 lg:ml-auto">
            <ArrowDownWideNarrow className="size-4 text-subtle-foreground" aria-hidden="true" />
            <label className="sr-only" htmlFor="unit-sort">排序</label>
            <select
              id="unit-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm"
            >
              {Object.entries(SORTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
            <FilterChip active={notesOnly} onClick={() => { setNotesOnly((value) => !value); setExpanded(false); }}>
              <Wrench className="size-3" aria-hidden="true" />
              有備註 {noteCount}
            </FilterChip>
          </div>
        </div>

        <div className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="燃料別篩選">
          <FilterChip active={category === 'all'} onClick={() => { setCategory('all'); setExpanded(false); }}>全部</FilterChip>
          {categories.map((item) => (
            <FilterChip
              key={item.key}
              active={category === item.key}
              color={fuelColor(item)}
              onClick={() => { setCategory(item.key); setExpanded(false); }}
            >
              {item.labelZh}
            </FilterChip>
          ))}
        </div>

        <div className="-mx-6 mt-6 overflow-x-auto sm:mx-0" role="region" aria-label="機組即時發電量（可捲動表格）" tabIndex={0}>
          <table className="w-full min-w-[680px] text-sm">
            <caption className="sr-only">機組即時發電量（共 {filtered.length} 筆符合）</caption>
            <thead>
              <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                <th scope="col" className="py-3 pl-6 pr-3 font-medium sm:pl-0">機組</th>
                <th scope="col" className="px-2 py-2 font-medium">燃料別</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">淨發電</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">裝置容量</th>
                <th scope="col" className="w-40 px-2 py-2 font-medium">使用率</th>
                <th scope="col" className="py-2 pl-2 pr-5 font-medium sm:pr-0">備註</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((unit, index) => {
                const factor = Number.isFinite(unit.utilizationPercent) ? Math.min(100, Math.max(0, unit.utilizationPercent)) : null;
                const color = fuelColor({ key: unit.categoryKey, color: unit.color });
                return (
                  <tr key={`${unit.name}-${index}`} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
                    <th scope="row" className="max-w-[220px] truncate py-3.5 pl-5 pr-2 text-left font-medium sm:pl-0" title={unit.name}>
                      {unit.name}
                    </th>
                    <td className="whitespace-nowrap px-2 py-3.5 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                        {unit.type}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-2 py-3.5 text-right font-semibold">{power(unit.netGenerationMw)}</td>
                    <td className="num whitespace-nowrap px-2 py-3.5 text-right text-muted-foreground">{power(unit.capacityMw)}</td>
                    <td className="px-2 py-3.5">
                      {factor === null ? (
                        <span className="text-subtle-foreground">--</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                            <span className="block h-full rounded-full" style={{ width: `${factor}%`, background: color }} />
                          </span>
                          <span className="num w-11 text-right text-xs text-muted-foreground">{formatPercent(unit.utilizationPercent, 0)}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-2 pr-5 sm:pr-0">
                      {hasNote(unit) ? (
                        <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" title={unit.note}>
                          <Wrench className="size-3 shrink-0" aria-hidden="true" />
                          {unit.note}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-10 text-center text-[13px] text-muted-foreground">沒有符合條件的機組。</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <span className="num">顯示 {visible.length} / {filtered.length} 筆</span>
          {filtered.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="h-10 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              {expanded ? '收合' : `顯示全部 ${filtered.length} 筆`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
