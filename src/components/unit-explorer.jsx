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
        'inline-flex h-9 shrink-0 items-center pointer-coarse:h-11 gap-2 rounded-full border px-4 text-sm font-semibold transition',
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
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setExpanded(false); }}
              placeholder="搜尋機組名稱，例如 大潭、台中"
              className="h-11 w-full rounded-control border border-border bg-card pl-12 pr-3 text-sm placeholder:text-subtle-foreground focus:outline-2 focus:outline-ring"
            />
          </label>
          <div className="flex items-center gap-2 lg:ml-auto">
            <ArrowDownWideNarrow className="size-4 text-subtle-foreground" aria-hidden="true" />
            <label className="sr-only" htmlFor="unit-sort">排序</label>
            <select
              id="unit-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-11 rounded-control border border-border bg-card px-3 text-sm"
            >
              {Object.entries(SORTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
            <FilterChip active={notesOnly} onClick={() => { setNotesOnly((value) => !value); setExpanded(false); }}>
              <Wrench className="size-4" aria-hidden="true" />
              有備註 {noteCount}
            </FilterChip>
          </div>
        </div>

        <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="燃料別篩選">
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

        {/* Phones get a card list; the wide table starts at the sm breakpoint. */}
        <ul className="mt-6 divide-y divide-border sm:hidden" aria-label="機組即時發電量">
          {visible.map((unit, index) => {
            const factor = Number.isFinite(unit.utilizationPercent) ? Math.min(100, Math.max(0, unit.utilizationPercent)) : null;
            const color = fuelColor({ key: unit.categoryKey, color: unit.color });
            return (
              <li key={`${unit.name}-${index}`} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-base font-bold">{unit.name}</p>
                  <p className="num shrink-0 text-base font-bold">{power(unit.netGenerationMw)}</p>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                    <span className="truncate">{unit.type}</span>
                    {hasNote(unit) && <span className="truncate">· {unit.note}</span>}
                  </span>
                  <span className="num shrink-0">{factor === null ? '' : `使用率 ${formatPercent(unit.utilizationPercent, 0)}`}</span>
                </div>
                {factor !== null && (
                  <span className="mt-2 block h-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${factor}%`, background: color }} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="-mx-4 mt-6 hidden overflow-x-auto sm:mx-0 sm:block" role="region" aria-label="機組即時發電量（可捲動表格）" tabIndex={0}>
          <table className="w-full min-w-[680px] text-sm">
            <caption className="sr-only">機組即時發電量（共 {filtered.length} 筆符合）</caption>
            <thead>
              <tr className="border-b border-border text-left text-sm text-muted-foreground">
                <th scope="col" className="py-3 pl-4 pr-3 font-semibold sm:pl-0">機組</th>
                <th scope="col" className="px-2 py-2 font-semibold">燃料別</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">淨發電</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">裝置容量</th>
                <th scope="col" className="w-40 px-2 py-2 font-semibold">使用率</th>
                <th scope="col" className="py-2 pl-2 pr-4 font-semibold sm:pr-0">備註</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((unit, index) => {
                const factor = Number.isFinite(unit.utilizationPercent) ? Math.min(100, Math.max(0, unit.utilizationPercent)) : null;
                const color = fuelColor({ key: unit.categoryKey, color: unit.color });
                return (
                  <tr key={`${unit.name}-${index}`} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
                    <th scope="row" className="max-w-[220px] truncate py-4 pl-4 pr-2 text-left font-semibold sm:pl-0" title={unit.name}>
                      {unit.name}
                    </th>
                    <td className="whitespace-nowrap px-2 py-4 text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                        {unit.type}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-2 py-4 text-right font-bold">{power(unit.netGenerationMw)}</td>
                    <td className="num whitespace-nowrap px-2 py-4 text-right text-muted-foreground">{power(unit.capacityMw)}</td>
                    <td className="px-2 py-4">
                      {factor === null ? (
                        <span className="text-subtle-foreground">--</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                            <span className="block h-full rounded-full" style={{ width: `${factor}%`, background: color }} />
                          </span>
                          <span className="num w-11 text-right text-sm text-muted-foreground">{formatPercent(unit.utilizationPercent, 0)}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 pl-2 pr-4 sm:pr-0">
                      {hasNote(unit) ? (
                        <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground" title={unit.note}>
                          <Wrench className="size-4 shrink-0" aria-hidden="true" />
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
            <p className="py-12 text-center text-base text-muted-foreground">沒有符合條件的機組。</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="num">顯示 {visible.length} / {filtered.length} 筆</span>
          {filtered.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="h-11 rounded-control border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              {expanded ? '收合' : `顯示全部 ${filtered.length} 筆`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
