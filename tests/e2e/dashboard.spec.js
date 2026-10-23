import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { minutesAfterSource, mockData } from './fixtures.js';

async function expectNoAxeViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([]);
}

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('live data shows the official light, curves and passes axe', async ({ page }) => {
  await mockData(page, { now: minutesAfterSource(5) });
  await page.goto('/');

  await expect(page.locator('#status')).toContainText(/資料時間 00:10 · [56] 分鐘前/);
  await expect(page.getByText('綠燈 · 供電充裕')).toBeVisible();
  await expect(page.getByRole('meter', { name: '今日尖峰預估備轉容量率' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日用電曲線' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '備轉容量率：近期實績與未來一週' })).toBeVisible();
  await expect(page.locator('#today [role="img"]').first()).toBeVisible();

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});

test('dark theme also passes axe', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockData(page, { now: minutesAfterSource(5) });
  await page.goto('/');
  await expect(page.getByText('綠燈 · 供電充裕')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('older data keeps the answer on screen and is labelled beside it', async ({ page }) => {
  await mockData(page, { now: minutesAfterSource(3 * 60) });
  await page.goto('/');
  const hero = page.locator('#status');
  // 稍舊: amber label only, the light keeps its colour and no extra sentence.
  await expect(hero).toContainText('資料時間 00:10 · 3 小時前');
  await expect(page.getByText('台電今日供電燈號')).toBeVisible();
  await expect(page.getByRole('link', { name: /^台電官網/ })).toHaveCount(0);
  await expect(page.getByText(/非即時|已過期|延遲資料/)).toHaveCount(0);

  // 過舊: one sentence plus the official link; the number stays.
  await page.clock.fastForward('05:00:00');
  await expect(hero).toContainText('資料時間 00:10 · 8 小時前');
  await expect(hero).toContainText('GitHub 排程延遲，最後成功更新 00:10');
  await expect(page.getByRole('link', { name: /^台電官網/ })).toBeVisible();
  await expect(page.getByText('最後更新時的台電供電燈號')).toBeVisible();
  await expect(page.getByRole('meter', { name: '今日尖峰預估備轉容量率' })).toBeVisible();
});

test('data over 24 hours old is still shown, labelled as day-old', async ({ page }) => {
  await mockData(page, { now: minutesAfterSource(30 * 60) });
  await page.goto('/');
  const hero = page.locator('#status');
  await expect(hero).toContainText('資料時間 5/30 00:10 · 30 小時前');
  await expect(hero).toContainText('這是 24 小時前的資料');
  await expect(page.getByRole('meter')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '今日用電曲線' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('untrustworthy timestamps show an error card but keep the page around it', async ({ page }) => {
  // The source claims to be from the future, so nothing can be trusted.
  await mockData(page, { now: minutesAfterSource(-10) });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '目前無法確認供電狀態' }).first()).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /回到頁首/ })).toBeVisible();
  await expect(page.locator('#about')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('missing curve data degrades only the curve section', async ({ page }) => {
  await mockData(page, { now: minutesAfterSource(5), curves: null });
  await page.goto('/');
  await expect(page.getByText('綠燈 · 供電充裕')).toBeVisible();
  await expect(page.getByRole('link', { name: /台電今日用電曲線/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '備轉容量率：近期實績與未來一週' })).toBeVisible();
});

test('power unit toggle switches between 萬瓩 and MW', async ({ page }) => {
  await mockData(page, { now: minutesAfterSource(5) });
  await page.goto('/');
  const unitGroup = page.getByRole('group', { name: '功率單位' });
  await expect(page.locator('#status').getByText('萬瓩').first()).toBeVisible();
  await unitGroup.getByRole('button', { name: 'MW' }).click();
  await expect(unitGroup.getByRole('button', { name: 'MW' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#status').getByText('MW').first()).toBeVisible();
});

test('every chart offers an accessible table view', async ({ page }) => {
  await mockData(page, { now: minutesAfterSource(5) });
  await page.goto('/');
  const card = page.locator('#today');
  await card.getByRole('tab', { name: '表格' }).click();
  const table = card.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('rowheader', { name: '00:10' })).toBeVisible();
});

test('auto refresh can be paused from the header', async ({ page }) => {
  await mockData(page, { now: minutesAfterSource(5) });
  await page.goto('/');
  const pause = page.getByRole('button', { name: '暫停自動更新' });
  await pause.click();
  await expect(page.getByRole('button', { name: '恢復自動更新' })).toHaveAttribute('aria-pressed', 'true');
});

test('the page never requests anything outside its own origin besides fonts', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(baseURL).origin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      external.push(request.url());
    }
  });
  await mockData(page, { now: minutesAfterSource(5) });
  await page.goto('/');
  await expect(page.getByRole('meter')).toBeVisible();
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(page.locator('#units')).toBeVisible();
  expect(external).toEqual([]);
});
