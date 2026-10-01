import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPositiveMix, getRefreshFeedback, getRefreshOutcome } from "../js/presentation.js";
import { ChartManager } from "../js/charts.js";

const categories = [
  { key: "gas", labelZh: "燃氣", netGenerationMw: 80, sharePercent: 64 },
  { key: "solar", labelZh: "太陽能", netGenerationMw: 20, sharePercent: 16 },
  { key: "storage-load", labelZh: "儲能負載", netGenerationMw: -15, sharePercent: 0 },
  { key: "other", labelZh: "未知", netGenerationMw: null, sharePercent: null },
  { key: "oil", labelZh: "燃油", netGenerationMw: 0, sharePercent: 0 },
];
const usable = { model: {}, freshness: { usable: true }, transport: "static-snapshot" };

test("refresh feedback distinguishes unchanged, newer, older, fallback and unavailable results", () => {
  assert.match(getRefreshFeedback({ ...usable, refreshOutcome: "unchanged" }), /尚未更新/);
  assert.match(getRefreshFeedback({ ...usable, refreshOutcome: "updated" }), /較新的官方來源時間/);
  assert.match(getRefreshFeedback({ ...usable, refreshOutcome: "regressed" }), /保留較新的/);
  assert.match(getRefreshFeedback({ ...usable, metadata: { preventedRegression: true } }), /保留較新的/);
  assert.match(getRefreshFeedback({ ...usable, transport: "browser-cache", metadata: { reason: "offline" }, refreshOutcome: "unchanged" }), /連線未取得資料/);
  assert.match(getRefreshFeedback({ ...usable, model: null }), /暫停顯示數字/);
  assert.match(getRefreshFeedback({ ...usable, freshness: { usable: false }, refreshOutcome: "updated" }), /暫停顯示數字/);
  assert.match(getRefreshFeedback(usable), /已取得可驗證資料/);
});

test("refresh outcome compares both feeds and never treats missing timestamps as unchanged", () => {
  const resultAt = (supply, generation) => ({ model: { feeds: {
    supply: { observedAt: supply }, generation: { observedAt: generation },
  } } });
  const previous = resultAt("2026-09-30T08:00:00Z", "2026-09-30T08:05:00Z");
  assert.equal(getRefreshOutcome(previous, resultAt("2026-09-30T08:00:00Z", "2026-09-30T08:10:00Z")), "updated");
  assert.equal(getRefreshOutcome(previous, resultAt("2026-09-30T08:01:00Z", "2026-09-30T08:05:00Z")), "updated");
  assert.equal(getRefreshOutcome(previous, resultAt("2026-09-30T07:59:00Z", "2026-09-30T08:10:00Z")), "regressed");
  assert.equal(getRefreshOutcome(previous, previous), "unchanged");
  assert.equal(getRefreshOutcome(null, previous), "checked");
  assert.equal(getRefreshOutcome(previous, resultAt(null, "invalid")), "checked");
  assert.equal(getRefreshOutcome(previous, { ...previous, metadata: { preventedRegression: true } }), "regressed");
});

test("positive category normalization preserves signed source values and handles an empty mix", () => {
  const original = structuredClone(categories);
  assert.deepEqual(getPositiveMix(categories).map((c) => c.positiveShare), [80, 20]);
  assert.deepEqual(categories, original);
  assert.deepEqual(getPositiveMix(categories.slice(2)), []);
  assert.deepEqual(getPositiveMix([{ netGenerationMw: NaN }, { netGenerationMw: Infinity }]), []);
});

test("overview and full doughnut share the same positive-category geometry and tooltip percentages", (t) => {
  const originals = { document: globalThis.document, window: globalThis.window, Chart: globalThis.Chart };
  t.after(() => Object.assign(globalThis, originals));
  class FakeChart {
    constructor(context, config) { this.config = config; }
    destroy() {}
  }
  globalThis.Chart = FakeChart;
  globalThis.window = { Chart: FakeChart };
  globalThis.document = { getElementById: () => ({ getContext: () => ({}) }) };
  const manager = new ChartManager();
  const glance = manager.createGlanceMixChart("glance", getPositiveMix(categories));
  const full = manager.createFuelMixChart("full", categories);
  assert.deepEqual(glance.config.data.datasets[0].data, [80, 20]);
  assert.deepEqual(full.config.data.datasets[0].data, [80, 20]);
  assert.equal(glance.config.options.plugins.tooltip.callbacks.label({ dataIndex: 0 }), "燃氣: 80.0%");
  assert.equal(full.config.options.plugins.tooltip.callbacks.label({ dataIndex: 0 }), "燃氣: 80 MW (80.0%)");
  assert.deepEqual(manager.createCategoryBarChart("bar", categories).config.data.datasets[0].data, [80, 20]);
});

test("refresh status lives outside collapsed details and controls retain explicit target and focus rules", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const mainCss = await readFile(new URL("../css/main.css", import.meta.url), "utf8");
  const css = await readFile(new URL("../css/components.css", import.meta.url), "utf8");
  const summaryStart = html.indexOf('<details class="source-details">');
  const summaryEnd = html.indexOf("</details>", summaryStart);
  const feedback = html.indexOf('id="refresh-feedback"');
  assert.ok(feedback > summaryEnd);
  assert.match(html.slice(feedback, html.indexOf("</p>", feedback)), /role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/);
  assert.match(css, /\.refresh-btn,\s*\.retry-data-btn\s*\{\s*min-width: 44px;\s*min-height: 44px;/);
  assert.match(css, /\.source-details summary,\s*\.reserve-explainer summary,\s*\.alerts-panel summary\s*\{\s*min-height: 44px;/);
  assert.match(mainCss, /outline: 2px solid var\(--focus-ring\)/);
  assert.match(css, /\.status-hero\s*\{\s*--focus-ring: #8ad6c3;/);
  assert.match(css, /\.now-strip,\s*\.reserve-explainer\s*\{\s*--focus-ring: var\(--accent\)/);
});

class FakeElement {
  constructor() {
    this.attributes = new Map(); this.dataset = {}; this.listeners = new Map();
    this.hidden = false; this.disabled = false; this.textContent = ""; this.innerHTML = "";
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.style = { setProperty() {} }; this.parentElement = { style: {} };
  }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  replaceChildren() {}
}

test("manual refresh announces pending and completion, ignores repeated clicks, and preserves signed details", async (t) => {
  const originals = { document: globalThis.document, window: globalThis.window, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  const { powerAPI } = await import("../js/api.js");
  const originalFetch = powerAPI.fetchDashboard;
  t.after(() => { Object.assign(globalThis, originals); powerAPI.fetchDashboard = originalFetch; });
  const ids = new Map();
  const element = (id) => {
    if (!ids.has(id)) ids.set(id, new FakeElement());
    return ids.get(id);
  };
  const content = [new FakeElement()];
  globalThis.document = {
    getElementById: element,
    querySelector: element,
    querySelectorAll: (selector) => selector === "[data-dashboard-content]" ? content : [],
    createElement: () => new FakeElement(), createTextNode: (text) => ({ textContent: text }),
    addEventListener() {},
  };
  globalThis.window = { Chart: undefined, addEventListener() {}, setTimeout: (fn) => fn(), setInterval: () => 1, clearInterval() {} };
  globalThis.setInterval = () => 1;
  globalThis.clearInterval = () => {};
  const { sampleSupplyPayload, sampleGenerationPayload } = await import("../data/sample-power-data.js");
  const { buildDashboardModel } = await import("../js/power-data.js");
  const { assessDataFreshness } = await import("../js/data-freshness.js");
  const model = buildDashboardModel({ supplyPayload: sampleSupplyPayload, generationPayload: sampleGenerationPayload, fetchedAt: new Date("2026-05-29T16:15:00Z") });
  model.categories = categories;
  const result = { model, freshness: assessDataFreshness(model, { now: new Date("2026-05-29T16:15:00Z") }), transport: "static-snapshot", metadata: {} };
  powerAPI.fetchDashboard = async () => structuredClone(result);
  await import("../js/main.js?polish-integration");
  await new Promise(setImmediate);
  const detail = element("category-grid").innerHTML;
  assert.match(detail, /正輸出占比 80\.0%/);
  assert.match(detail, /正輸出占比 20\.0%/);
  assert.doesNotMatch(detail, /64\.0%|16\.0%/);
  assert.match(detail, /-15\.0 MW/);
  assert.match(detail, /負載，不計入占比/);
  assert.match(detail, /輸出未知，不計入占比/);
  const button = element("refresh-btn");
  const feedback = element("refresh-feedback");
  let finish;
  let calls = 0;
  powerAPI.fetchDashboard = () => { calls += 1; return new Promise((resolve) => { finish = resolve; }); };
  const first = button.listeners.get("click")();
  assert.equal(feedback.hidden, false);
  assert.match(feedback.textContent, /正在重新檢查/);
  assert.equal(button.disabled, true);
  assert.equal(button.attributes.get("aria-busy"), "true");
  await button.listeners.get("click")();
  assert.equal(calls, 1);
  finish(structuredClone(result));
  await first;
  assert.match(feedback.textContent, /尚未更新/);
  assert.equal(button.disabled, false);
  assert.equal(button.attributes.get("aria-busy"), "false");
  const newer = structuredClone(result);
  newer.model.feeds.generation.observedAt = new Date(model.feeds.generation.observedAt.getTime() + 60_000);
  newer.freshness = assessDataFreshness(newer.model, { now: new Date("2026-05-29T16:15:00Z") });
  assert.equal(newer.freshness.oldestObservedAt.getTime(), result.freshness.oldestObservedAt.getTime());
  powerAPI.fetchDashboard = async () => structuredClone(newer);
  await button.listeners.get("click")();
  assert.match(feedback.textContent, /較新的官方來源時間/);
  powerAPI.fetchDashboard = async () => ({ ...structuredClone(newer), transport: "browser-cache", metadata: { reason: "offline" } });
  await button.listeners.get("click")();
  assert.match(feedback.textContent, /連線未取得資料/);
  const latest = structuredClone(newer);
  latest.model.feeds.generation.observedAt = new Date(newer.model.feeds.generation.observedAt.getTime() + 60_000);
  powerAPI.fetchDashboard = async () => structuredClone(latest);
  await button.listeners.get("click")();
  assert.match(feedback.textContent, /較新的官方來源時間/);
  const originalError = console.error;
  console.error = () => {};
  try {
    powerAPI.fetchDashboard = async () => { throw new Error("fetch failed"); };
    await button.listeners.get("click")();
  } finally {
    console.error = originalError;
  }
  assert.match(feedback.textContent, /暫停顯示數字/);
  assert.doesNotMatch(feedback.textContent, /較新的官方來源時間/);
  assert.equal(button.disabled, false);
  powerAPI.fetchDashboard = async () => ({ model: null, freshness: { state: "unavailable", usable: false }, metadata: {} });
  await button.listeners.get("click")();
  assert.match(feedback.textContent, /暫停顯示數字/);
  assert.ok(content.every((item) => item.hidden));
});
