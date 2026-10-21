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
    <Card id={id} className={cn('scroll-mt-20', className)} aria-labelledby={headingId}>
      <TabsPrimitive.Root value={view} onValueChange={setView}>
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0 max-w-2xl">
            <h2 id={headingId} className="text-base font-semibold tracking-tight">{title}</h2>
            {summary && <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{summary}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {table && (
              <TabsPrimitive.List aria-label={`${title}檢視方式`} className="inline-flex rounded-lg bg-muted p-1">
                <TabsPrimitive.Trigger
                  value="chart"
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="size-3.5" aria-hidden="true" />圖表
                </TabsPrimitive.Trigger>
                <TabsPrimitive.Trigger
                  value="table"
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Table2 className="size-3.5" aria-hidden="true" />表格
                </TabsPrimitive.Trigger>
              </TabsPrimitive.List>
            )}
            {csv && (
              <button
                type="button"
                onClick={() => downloadCsv(csv.filename, csv.header, csv.rows)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted"
              >
                <Download className="size-3.5" aria-hidden="true" />
                CSV<span className="sr-only">下載{title}資料</span>
              </button>
            )}
          </div>
        </header>

        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <TabsPrimitive.Content value="chart" forceMount hidden={view !== 'chart'} className="outline-none">
            {children}
          </TabsPrimitive.Content>
          {table && (
            <TabsPrimitive.Content value="table" className="outline-none">
              <DataTable caption={title} {...table} />
            </TabsPrimitive.Content>
          )}
          {(meta || footnote) && (
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {footnote && <p className="max-w-3xl leading-5">{footnote}</p>}
              {meta && <p className="num ml-auto whitespace-nowrap">{meta}</p>}
            </div>
          )}
        </div>
      </TabsPrimitive.Root>
    </Card>
  );
}

export function DataTable({ caption, columns, rows, maxHeight = 420 }) {
  return (
    <div className="-mx-5 overflow-auto sm:mx-0" style={{ maxHeight }} role="region" aria-label={`${caption}（可捲動表格）`} tabIndex={0}>
      <table className="w-full min-w-[480px] text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-xs text-muted-foreground">
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-2 py-2 font-medium',
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
                      'whitespace-nowrap px-2 py-2',
                      column.numeric ? 'num text-right' : 'text-left',
                      index === 0 && 'pl-5 font-medium sm:pl-0',
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
