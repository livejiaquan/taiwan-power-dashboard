import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ChartManager } from "../js/charts.js";
import { getCapacityBalance, getPositiveMix } from "../js/presentation.js";

// These are source/configuration contracts, not rendered-browser assertions.
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const mainCss = await readFile(new URL("../css/main.css", import.meta.url), "utf8");
const css = await readFile(new URL("../css/components.css", import.meta.url), "utf8");

test("readability contract keeps body text at one rem and removes sub-13px declarations", () => {
  assert.match(mainCss, /body\s*\{[^}]*font: 1rem\/1\.75 var\(--sans\)/);
  for (const sheet of [mainCss, css]) {
    for (const declaration of sheet.matchAll(/font(?:-size)?\s*:\s*([^;]+)/g)) {
      for (const dimension of declaration[1].matchAll(/([\d.]+)(px|rem)\b/g)) {
        const pixels = Number(dimension[1]) * (dimension[2] === "rem" ? 16 : 1);
        assert.ok(pixels >= 13, `Small font declaration: ${declaration[0]}`);
      }
    }
  }
  assert.match(css, /--text-meta: 0\.8125rem/);
  assert.match(css, /--text-label: 0\.875rem/);
  assert.doesNotMatch(mainCss, /body\s*\{[^}]*font-size:/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=/);
});

test("forecast, actual load and generation follow the same un-duplicated source order", () => {
  const forecast = html.indexOf('class="peak-panel"');
  const actual = html.indexOf('class="now-strip"');
  const generation = html.indexOf('class="mix-glance"');
  const explanation = html.indexOf('class="reserve-explainer"');
  assert.ok(forecast > 0 && forecast < actual && actual < generation && generation < explanation);
  for (const id of ["current-load", "current-output", "peak-demand"]) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1);
  }
  assert.doesNotMatch(css, /\border\s*:|display:\s*contents/);
  assert.match(css, /grid-template-areas: "peak mix" "now mix"/);
  assert.match(css, /@media \(max-width: 62\.5em\)\s*\{\s*\.balance-stage \{ display: block;/);
});

test("narrow layouts give the forecast canvas a dedicated ratio box and move text below it", () => {
  assert.match(html, /class="balance-canvas">\s*<canvas\s+id="peak-balance-chart"[^>]*><\/canvas>\s*<\/div>\s*<section\s+class="health-block"/);
  assert.match(css, /\.balance-canvas\s*\{\s*position: relative;\s*aspect-ratio: 2\/1;/);
  const narrow = css.slice(css.indexOf("@media (max-width: 30em)"));
  assert.match(narrow, /\.health-block \{ position: relative; inset: auto;/);
  assert.match(narrow, /\.balance-endpoints,\s*\.reserve-rate-group \{ grid-template-columns: 1fr;/);
  assert.match(narrow, /\.category-grid \{ grid-template-columns: 1fr;/);
  assert.match(css, /width: min\(1480px, calc\(100% - var\(--gutter\) \* 2\)\)/);
});

test("chart-unavailable messages sit outside graphic boxes without covering headline values", () => {
  assert.match(html, /<\/section>\s*<\/div>\s*<p id="balance-chart-fallback"/);
  assert.match(html, /id="current-output"[\s\S]*?<\/div>\s*<\/div>\s*<p id="glance-chart-fallback"/);
  assert.match(css, /\.status-hero \.chart-fallback\s*\{[^}]*font-size: var\(--text-label\)/);
  assert.doesNotMatch(css, /\.status-hero \.chart-fallback\s*\{[^}]*position: absolute/);
  assert.match(css, /\.balance-frame:has\(\+ \.chart-fallback:not\(\[hidden\]\)\) \.health-block\s*\{\s*position: static;/);
});

test("the health region and its heading retain accessible freshness context", () => {
  assert.match(html, /class="health-block"\s+aria-labelledby="health-context-label health-label"\s+aria-describedby="health-mode"/);
  assert.match(html, /<h3 id="health-label" aria-describedby="health-mode">/);
  assert.match(html, /id="health-context-label"/);
  assert.match(html, /id="health-mode"/);
});

test("larger default text can trigger reflow and number-unit wrapping", () => {
  assert.doesNotMatch(css, /@media[^\{]*max-width:\s*[\d.]+px/);
  assert.match(css, /\.now-strip strong\s*\{[^}]*white-space: normal/);
  assert.match(css, /\.generation-center strong\s*\{[^}]*white-space: normal/);
  assert.match(css, /\.balance-endpoints strong\s*\{[^}]*white-space: normal/);
  const compact = css.slice(css.lastIndexOf("@media (max-width: 22.5em)"));
  assert.match(compact, /\.generation-center \{ position: relative; inset: auto; padding: 16px 0 0;/);
  assert.match(css, /\.generation-canvas\s*\{\s*position: relative;\s*aspect-ratio: 1;/);
});

test("charts use readable labels, sparse horizontal ticks and explicit tooltip type sizes", (t) => {
  const original = { document: globalThis.document, window: globalThis.window, Chart: globalThis.Chart };
  t.after(() => Object.assign(globalThis, original));
  let destroyed = 0;
  class FakeChart {
    constructor(context, config) { this.config = config; }
    destroy() { destroyed += 1; }
  }
  globalThis.Chart = FakeChart;
  globalThis.window = { Chart: FakeChart };
  globalThis.document = { getElementById: () => ({ getContext: () => ({}) }) };
  const manager = new ChartManager();
  const categories = [
    { key: "gas", labelZh: "燃氣", netGenerationMw: 800 },
    { key: "solar", labelZh: "太陽能", netGenerationMw: 200 },
    { key: "storage-load", labelZh: "儲能負載", netGenerationMw: -50 },
  ];
  const build = () => [
    manager.createPeakBalanceChart("peak", getCapacityBalance({ forecastPeakDemandMw: 900, forecastMaxSupplyCapacityMw: 1100, forecastReserveCapacityMw: 200 })),
    manager.createGlanceMixChart("glance", getPositiveMix(categories)),
    manager.createFuelMixChart("mix", categories),
    manager.createCategoryBarChart("bar", categories),
  ];
  const charts = build();
  for (const chart of charts) {
    assert.ok(chart);
    assert.equal(chart.config.options.maintainAspectRatio, false);
    assert.equal(chart.config.options.plugins.tooltip.bodyFont.size, 14);
    assert.equal(chart.config.options.plugins.tooltip.titleFont.size, 14);
  }
  const legend = charts[2].config.options.plugins.legend.labels;
  assert.equal(legend.font.size, 14);
  assert.equal(legend.boxWidth, 12);
  const scales = charts[3].config.options.scales;
  assert.equal(scales.x.ticks.font.size, 13);
  assert.equal(scales.x.ticks.maxTicksLimit, 5);
  assert.equal(scales.x.ticks.maxRotation, 0);
  assert.equal(scales.y.ticks.font.size, 14);
  assert.equal(scales.x.ticks.callback(15000), "15,000");
  assert.deepEqual(charts[2].config.data.datasets[0].data, [800, 200]);
  build();
  assert.equal(destroyed, 4);
  assert.equal(manager.charts.size, 4);
});
