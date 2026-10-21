export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 text-sm leading-7 text-muted-foreground sm:px-8 md:grid-cols-3">
        <div>
          <p className="font-semibold text-foreground">台灣電力即時看板</p>
          <p className="mt-2 leading-6">
            以台電官方開放資料呈現供電燈號、備轉容量與發電結構。網站約每 10 分鐘嘗試更新快照，屬 best effort；請以來源時間與台電公告為準。
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">資料來源</p>
          <ul className="mt-2 space-y-1.5">
            <li><a className="hover:text-foreground hover:underline" href="https://data.gov.tw/dataset/162595" target="_blank" rel="noreferrer">台灣電力公司今日電力資訊</a></li>
            <li><a className="hover:text-foreground hover:underline" href="https://data.gov.tw/dataset/8931" target="_blank" rel="noreferrer">台灣電力公司各機組發電量即時資訊</a></li>
            <li><a className="hover:text-foreground hover:underline" href="https://data.gov.tw/license" target="_blank" rel="noreferrer">依政府資料開放授權條款第 1 版使用</a></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground">說明</p>
          <p className="mt-2 leading-6">
            資料提供：台灣電力股份有限公司。本產品與資料提供機關無隸屬關係，亦不代表台電背書。原始碼以 MIT License 公開於
            {' '}<a className="underline hover:text-foreground" href="https://github.com/livejiaquan/taiwan-power-dashboard" target="_blank" rel="noreferrer">GitHub</a>。
          </p>
        </div>
      </div>
    </footer>
  );
}
