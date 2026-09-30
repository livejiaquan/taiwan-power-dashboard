import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSourceDate,
  formatRocDate,
  getPeakVisual,
  getPositiveMix,
  getCapacityBalance,
} from "../js/presentation.js";

test("source-day labels use Taiwan midnight, independently of reader timezone", () => {
  assert.equal(formatSourceDate("2026-09-29T15:59:00Z"), "2026/09/29");
  assert.equal(formatSourceDate("2026-09-29T16:00:00Z"), "2026/09/30");
  assert.equal(formatSourceDate("2025-12-31T16:00:00Z"), "2026/01/01");
  assert.equal(formatSourceDate("not a timestamp"), "--");
});

test("historical peak date is the provided ROC date, not yesterday relative to the reader", () => {
  assert.equal(formatRocDate("115.09.28"), "2026/09/28");
  assert.equal(formatRocDate("114-12-31"), "2025/12/31");
  assert.equal(formatRocDate(""), "--");
});

test("peak graphic uses forecast values, never current load or generation", () => {
  const v = getPeakVisual({
    forecastMaxSupplyCapacityMw: 48000,
    forecastPeakDemandMw: 40000,
    forecastReserveCapacityMw: 8000,
    currentLoadMw: 30000,
    totalGenerationMw: 32000,
  });
  assert.equal(v.supplyWidth, 100);
  assert.equal(v.demandWidth, (40000 / 48000) * 100);
  assert.equal(v.reserve, 8000);
});
test("shared scale preserves excess demand and rejects unknown capacity", () => {
  const v = getPeakVisual({
    forecastMaxSupplyCapacityMw: 40000,
    forecastPeakDemandMw: 42000,
    forecastReserveCapacityMw: 0,
  });
  assert.equal(v.demandWidth, 100);
  assert.ok(v.supplyWidth < 100);
  assert.equal(getPeakVisual({}), null);
});
test("mix visual excludes charging and missing values and totals 100 percent", () => {
  const v = getPositiveMix([
    { netGenerationMw: 80 },
    { netGenerationMw: 20 },
    { netGenerationMw: -15 },
    { netGenerationMw: null },
  ]);
  assert.equal(v.length, 2);
  assert.deepEqual(
    v.map((x) => x.positiveShare),
    [80, 20],
  );
});

test("capacity arc gap uses capacity denominator, separately from official reserve rate", () => {
  const v = getCapacityBalance({
    forecastMaxSupplyCapacityMw: 48452,
    forecastPeakDemandMw: 40000,
    forecastReserveCapacityMw: 8452,
    forecastReserveRatePercent: 21.13,
  });
  assert.deepEqual(v.segments, [40000, 8452, 0]);
  assert.ok(Math.abs((v.gap / v.supply) * 100 - 17.443) < 0.01);
  assert.notEqual((v.gap / v.supply) * 100, 21.13);
});
test("capacity graphic does not invent a reserve reconciliation or clip excess demand", () => {
  const v = getCapacityBalance({
    forecastMaxSupplyCapacityMw: 48000,
    forecastPeakDemandMw: 40000,
    forecastReserveCapacityMw: 8100,
  });
  assert.equal(v.gap, 8000);
  assert.equal(v.reserve, 8100);
  const x = getCapacityBalance({
    forecastMaxSupplyCapacityMw: 40000,
    forecastPeakDemandMw: 42000,
    forecastReserveCapacityMw: 0,
  });
  assert.deepEqual(x.segments, [40000, 0, 2000]);
  assert.equal(x.gap, 0);
  assert.equal(getCapacityBalance({}), null);
});
