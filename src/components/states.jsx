import { CloudOff, ExternalLink, RefreshCw } from 'lucide-react';

import { Card } from './ui/card.jsx';

export function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-12" aria-busy="true" aria-label="正在驗證台電資料">
      <div className="h-24 animate-pulse rounded-2xl bg-muted lg:col-span-12" />
      <div className="h-[420px] animate-pulse rounded-2xl bg-muted lg:col-span-5" />
      <div className="h-[420px] animate-pulse rounded-2xl bg-muted lg:col-span-7" />
      <p className="sr-only">正在驗證台電資料時間與來源…</p>
    </div>
  );
}

export function UnavailableState({ onRetry, loading }) {
  return (
    <Card className="px-6 py-12 text-center">
      <CloudOff className="mx-auto size-10 text-status-r" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold">目前無法確認供電狀態</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted-foreground">
        未取得兩份可驗證的台電官方資料。為避免誤導，這裡不顯示舊數字或示範資料。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-[13px] font-semibold text-background disabled:opacity-60"
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
          重新檢查
        </button>
        <a
          href="https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold hover:bg-muted"
        >
          台電今日電力資訊
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}
