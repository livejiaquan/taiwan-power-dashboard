import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, Download, ExternalLink } from 'lucide-react';

import { RESERVE_LEVELS, statusSurface } from '../lib/status.js';
import { Card } from './ui/card.jsx';

const FAQ = [
  {
    id: 'reserve',
    question: '備轉容量率是什麼？',
    answer: (
      <>
        <p>備轉容量是「當天尖峰時段，供電能力扣掉用電後還剩下多少可以臨時調度的電」。備轉容量率是這個餘裕佔尖峰負載的比例：</p>
        <p className="num rounded-lg bg-muted px-3 py-2 text-foreground">備轉容量率 ＝（最大供電能力 − 尖峰負載）÷ 尖峰負載 × 100%</p>
        <p>本站首頁顯示的是台電公布的「今日尖峰預估」值，尖峰過後台電會改公布實績。</p>
      </>
    )
  },
  {
    id: 'lights',
    question: '五種燈號怎麼判斷？',
    answer: (
      <>
        <p>燈號由台電依備轉狀況公布，本站直接採用官方燈號，不自行判斷。綠、黃、橘看百分比；紅、黑看絕對容量。</p>
        <ul className="grid gap-2">
          {RESERVE_LEVELS.map((level) => {
            const Icon = level.icon;
            return (
              <li key={level.code} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full" style={statusSurface(level.token)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="w-24 shrink-0 font-semibold text-foreground">{level.name}・{level.label}</span>
                <span className="num">{level.rule}</span>
              </li>
            );
          })}
        </ul>
        <p>年度規劃常提到的 15% 是「備用容量率」，與當日的備轉容量率是不同指標，本站不用它判斷今日供電。</p>
      </>
    )
  },
  {
    id: 'freshness',
    question: '「資料時間」旁的顏色是什麼意思？',
    answer: (
      <>
        <p>台電約每 10 分鐘更新一次資料，但本站透過 GitHub Actions 排程抓取，實際大約每 3–4 小時才更新一次。本站一律以台電資料本身的時間（兩份來源取較舊的一份）在你的瀏覽器裡計算資料有多舊：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong className="text-foreground">即時</strong>：90 分鐘內，資料時間旁是綠點。</li>
          <li><strong className="text-foreground">稍舊</strong>：90 分鐘到 6 小時，資料時間改為琥珀色，數字與燈號照常呈現。</li>
          <li><strong className="text-foreground">過舊</strong>：6 到 24 小時，另外說明最後成功更新的時間並附台電官網連結；燈號與數字改為中性色，但仍保留。</li>
          <li><strong className="text-foreground">超過 24 小時</strong>：仍顯示最後一筆官方資料，並標明是一天以前的數字。</li>
          <li><strong className="text-foreground">無法確認</strong>：來源時間缺漏或位於未來時，才不顯示任何數字。</li>
        </ul>
        <p>頁面每 15 秒自行重算資料年齡，就算暫停自動更新也一樣。</p>
      </>
    )
  },
  {
    id: 'units',
    question: '萬瓩和 MW 怎麼換算？',
    answer: (
      <p>1 萬瓩 ＝ 10,000 kW ＝ 10 MW（百萬瓦）。台電與新聞多用萬瓩，可在頁首切換。這些都是「功率」（瞬間的用電量）；電費帳單上的「度」是「電量」（kWh），兩者不能直接比較。</p>
    )
  },
  {
    id: 'method',
    question: '本站如何處理與驗證資料？',
    answer: (
      <>
        <p>每次抓取都會檢查欄位、數值範圍、來源時間，以及機組發電總量與負載是否對得上；任何一項不通過就不發布，也不會以示範資料替代。今日曲線與每日備轉為補充資訊，取得失敗時只會隱藏該區塊。</p>
        <p>燃料別占比以「正輸出合計」為分母，儲能充電（負值）不計入。燃氣、燃煤含民營電廠。</p>
      </>
    )
  }
];

const DATASETS = [
  ['今日電力資訊', 'https://data.gov.tw/dataset/162595', '約每 10 分鐘'],
  ['各機組發電量即時資訊', 'https://data.gov.tw/dataset/8931', '約每 10 分鐘'],
  ['今日用電曲線（燃料別、區域別）', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/load_briefing3.html', '每 10 分鐘'],
  ['本年度每日尖峰備轉容量率', 'https://service.taipower.com.tw/data/opendata/apply/file/d006002/001.csv', '每日'],
  ['未來一週電力供需預測', 'https://service.taipower.com.tw/data/opendata/apply/file/d006007/001.csv', '每日']
];

export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-title" className="grid scroll-mt-24 gap-6 lg:grid-cols-12 lg:gap-8">
      <Card className="p-5 sm:p-8 lg:col-span-7">
        <h2 id="about-title" className="text-xl font-bold tracking-tight">名詞與資料說明</h2>
        <Accordion.Root type="multiple" className="mt-3 divide-y divide-border">
          {FAQ.map((item) => (
            <Accordion.Item key={item.id} value={item.id}>
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold hover:text-accent">
                  {item.question}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" aria-hidden="true" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="space-y-3 pb-6 text-base text-muted-foreground">
                {item.answer}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Card>

      <Card className="p-5 sm:p-8 lg:col-span-5">
        <h2 className="text-xl font-bold tracking-tight">資料來源與下載</h2>
        <p className="mt-2 text-base text-muted-foreground">
          資料提供：台灣電力股份有限公司，依政府資料開放授權條款第 1 版使用。即時資料為速報，台電可能事後修正，正式數據請以台電公告為準。
        </p>
        <ul className="mt-6 divide-y divide-border text-sm">
          {DATASETS.map(([name, url, cadence]) => (
            <li key={url} className="flex items-center justify-between gap-4 py-2">
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-2 font-semibold hover:text-accent hover:underline">
                <span className="truncate">{name}</span>
                <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">（另開新視窗）</span>
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">{cadence}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="api/power-data.json" className="inline-flex h-9 items-center gap-2 rounded-lg pointer-coarse:h-11 border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
            <Download className="size-3.5" aria-hidden="true" />本站快照 JSON
          </a>
          <a href="api/curves.json" className="inline-flex h-9 items-center gap-2 rounded-lg pointer-coarse:h-11 border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
            <Download className="size-3.5" aria-hidden="true" />曲線資料 JSON
          </a>
        </div>
      </Card>
    </section>
  );
}
