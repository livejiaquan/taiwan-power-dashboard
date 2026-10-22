import * as TabsPrimitive from '@radix-ui/react-tabs';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { useId, useState } from 'react';

import { downloadCsv } from '../lib/csv.js';
import { cn } from '../lib/utils.js';
import { Card } from './ui/card.jsx';

// Every chart ships with the same furniture (NESO/OWID practice): a one-line
// plain-language summary, its data time, a table view of the exact numbers and
// a CSV download.
export function ChartCard({
  id,
  title,
  summary,
  meta,
  controls,
  table,
  csv,
  className,
  children,
  footnote
}) {
  const [view, setView] = useState('chart');
  const headingId = useId();

  return (
    <section id={id} className={cn('scroll-mt-24', className)} aria-labelledby={headingId}>
      <TabsPrimitive.Root value={view} onValueChange={setView}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-6">
          <div className="max-w-2xl">
            <h2 id={headingId} className="display text-2xl font-bold sm:text-3xl">{title}</h2>
            {summary && <p className="mt-2 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">{summary}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {table && (
              <TabsPrimitive.List aria-label={`${title}檢視方式`} className="inline-flex rounded-xl bg-muted p-1">
                <TabsPrimitive.Trigger
                  value="chart"
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm pointer-coarse:h-11 font-semibold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="size-3.5" aria-hidden="true" />圖表
                </TabsPrimitive.Trigger>
                <TabsPrimitive.Trigger
                  value="table"
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm pointer-coarse:h-11 font-semibold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Table2 className="size-3.5" aria-hidden="true" />表格
                </TabsPrimitive.Trigger>
              </TabsPrimitive.List>
            )}
            {csv && (
              <button
                type="button"
                onClick={() => downloadCsv(csv.filename, csv.header, csv.rows)}
                className="inline-flex h-11 items-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
              >
                <Download className="size-3.5" aria-hidden="true" />
                CSV<span className="sr-only">下載{title}資料</span>
              </button>
            )}
          </div>
        </div>

        <Card className="p-5 sm:p-8">
          <TabsPrimitive.Content value="chart" forceMount hidden={view !== 'chart'} className="outline-none">
            {children}
          </TabsPrimitive.Content>
          {table && (
            <TabsPrimitive.Content value="table" className="outline-none">
              <DataTable caption={title} {...table} />
            </TabsPrimitive.Content>
          )}
          {(meta || footnote) && (
            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-border pt-4 text-base text-muted-foreground">
              {footnote && <p className="max-w-3xl">{footnote}</p>}
              {meta && <p className="num ml-auto">{meta}</p>}
            </div>
          )}
        </Card>
      </TabsPrimitive.Root>
    </section>
  );
}

export function DataTable({ caption, columns, rows, maxHeight = 420 }) {
  return (
    <div className="-mx-5 overflow-auto sm:mx-0" style={{ maxHeight }} role="region" aria-label={`${caption}（可捲動表格）`} tabIndex={0}>
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-sm text-muted-foreground">
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-3 py-3 font-semibold',
                  column.numeric ? 'text-right' : 'text-left',
                  index === 0 && 'pl-5 sm:pl-0',
                  index === columns.length - 1 && 'pr-5 sm:pr-0'
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/60 last:border-0">
              {columns.map((column, index) => {
                const Cell = index === 0 ? 'th' : 'td';
                return (
                  <Cell
                    key={column.key}
                    scope={index === 0 ? 'row' : undefined}
                    className={cn(
                      'whitespace-nowrap px-3 py-3',
                      column.numeric ? 'num text-right' : 'text-left',
                      index === 0 && 'pl-5 font-semibold sm:pl-0',
                      index === columns.length - 1 && 'pr-5 sm:pr-0'
                    )}
                  >
                    {row[column.key]}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
