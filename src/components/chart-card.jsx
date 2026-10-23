import * as TabsPrimitive from '@radix-ui/react-tabs';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { useId, useState } from 'react';

import { downloadCsv } from '../lib/csv.js';
import { cn } from '../lib/utils.js';

// Every chart ships with the same furniture (NESO/OWID practice): a one-line
// plain-language summary, its data time, a table view of the exact numbers and
// a CSV download. The frame follows the reference's cards: title and controls
// inside one hairline card, 16px corners.
export function ChartCard({
  id,
  title,
  summary,
  meta,
  controls,
  table,
  csv,
  className,
  bodyClassName,
  children,
  footnote
}) {
  const [view, setView] = useState('chart');
  const headingId = useId();

  return (
    <section
      id={id}
      className={cn('scroll-mt-20 rounded-panel border border-border bg-card px-4 py-4 sm:px-5', className)}
      aria-labelledby={headingId}
    >
      <TabsPrimitive.Root value={view} onValueChange={setView} className={cn('flex h-full flex-col', bodyClassName)}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="max-w-2xl">
            <h2 id={headingId} className="text-base font-medium">{title}</h2>
            {summary && <p className="mt-1 text-pretty text-sm text-muted-foreground">{summary}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {table && (
              <TabsPrimitive.List aria-label={`${title}檢視方式`} className="inline-flex rounded-full border border-border bg-panel p-1">
                <TabsPrimitive.Trigger
                  value="chart"
                  className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground pointer-coarse:h-11 data-[state=active]:bg-muted data-[state=active]:text-foreground"
                >
                  <BarChart3 className="size-3.5" aria-hidden="true" />圖表
                </TabsPrimitive.Trigger>
                <TabsPrimitive.Trigger
                  value="table"
                  className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground pointer-coarse:h-11 data-[state=active]:bg-muted data-[state=active]:text-foreground"
                >
                  <Table2 className="size-3.5" aria-hidden="true" />表格
                </TabsPrimitive.Trigger>
              </TabsPrimitive.List>
            )}
            {csv && (
              <button
                type="button"
                onClick={() => downloadCsv(csv.filename, csv.header, csv.rows)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-panel px-4 text-sm font-medium hover:bg-muted pointer-coarse:h-11"
              >
                <Download className="size-3.5" aria-hidden="true" />
                CSV<span className="sr-only">下載{title}資料</span>
              </button>
            )}
          </div>
        </div>

        <TabsPrimitive.Content value="chart" forceMount hidden={view !== 'chart'} className="mt-4 flex min-h-0 flex-1 flex-col outline-none">
          {children}
        </TabsPrimitive.Content>
        {table && (
          <TabsPrimitive.Content value="table" className="mt-4 outline-none">
            <DataTable caption={title} {...table} />
          </TabsPrimitive.Content>
        )}
        {(meta || footnote) && (
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-border pt-3 text-sm text-muted-foreground">
            {footnote && <p className="max-w-3xl">{footnote}</p>}
            {meta && <p className="num ml-auto">{meta}</p>}
          </div>
        )}
      </TabsPrimitive.Root>
    </section>
  );
}

export function DataTable({ caption, columns, rows, maxHeight = 420 }) {
  return (
    <div className="-mx-4 overflow-auto sm:mx-0" style={{ maxHeight }} role="region" aria-label={`${caption}（可捲動表格）`} tabIndex={0}>
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
                  index === 0 && 'pl-4 sm:pl-0',
                  index === columns.length - 1 && 'pr-4 sm:pr-0'
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
                      index === 0 && 'pl-4 font-semibold sm:pl-0',
                      index === columns.length - 1 && 'pr-4 sm:pr-0'
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
