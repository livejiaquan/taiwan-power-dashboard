# V3 design QA

Source visual truth: local-only generated reference (excluded from Git; retained in the original assessment workspace)
Implementation: output/playwright/v3-desktop-first.png; local http://127.0.0.1:4186/
Viewport: desktop1440×1024, mobile390×844; also320/768/1188. Source1487×1058; implementation1440×1024 CSS pixels, density1. Source is proportionally fitted/padded to1440×1024, never stretched. Both show successful official-source state; concept's15:10/39,338 example differs from real16:40/38,235 source by design.

Full comparison: output/playwright/v3-target-comparison-final.png. Focused forecast comparison: output/playwright/v3-target-balance-focused.png. Mobile: output/playwright/v3-mobile-first.png, v3-mobile-generation.png. Actual final real-clock screenshot inspected.

## Findings and comparison history
- [P2, resolved] Mobile retained desktop canvas height, creating large empty area above arc; evidence v3-mobile-initial.jpg. Fixed dedicated aspect-ratio canvas parent with absolutely positioned canvas. v3-mobile-first.png shows complete forecast arc, official reserve and observed use within first844px.
- [P2, resolved] Initial hero state and core labels too small versus target, actual use clipped below desktop viewport. Evidence v3-target-comparison-initial.png. Increased central state and major label hierarchy, made source notice one desktop row, moved actual load onto distinct light footer band. Final comparison verifies main arc is primary, and actual-use role remains distinct.
- [P2, resolved] Donut initially showed many small individually colored slices while one aggregate legend used gray. Grouped lower-share positive categories into one gray『其餘正輸出』sector; major identities match source categories and full charts. Final v3-mobile-generation.png shows matching labeled segments.
- No remaining actionable P0/P1/P2 findings.

## Required fidelity surfaces
- Fonts/typography: Noto Sans TC + IBM Plex Mono, loaded fonts before capture; central status carries hierarchy, source minor text stays secondary. Long delayed/stale headings wrap without viewport spill at320/390. Target's decorative enormous heading reduced intentionally to let chart dominate.
- Spacing/layout: two columns on desktop, forecast then observed use then actual-generation ring on mobile. Main rectangle stays on page canvas without card grid/shadows. Width320–1440 no horizontal page overflow. Source warning reserved above graph; dated forecast scope visible.
- Colors/tokens: midnight#0b1827, orange#ff855d forecast demand, mint#8ad6c3 capacity-demand gap. Official indicator color independent G/Y/O/R/B semantic text; stale gray. Gas orange, coal neutral gray, solar gold, cogeneration blue consistent in chart/table/full structure. No glow/particles; flat background intentionally replaces concept's subtle shading.
- Image/asset fidelity: no decorative asset exists in visual target. Both visible graphics are quantitative Chart.js Canvas using actual source quantities, per user's explicit SVG/Canvas scope. No rasterized mock in product, fake maps/flows, or handcrafted icon substitution. Existing Bootstrap icons used for refresh/status only. Native sharp canvases resize with layout.
- Copy/content: source timestamp and date roles preserved; arc gap denominator capacity; official reserve rate denominator demand. Arc gap not silently renamed official reserve. Center net output separate from positive-share denominator and available capacity. Corrected outdated V2 three-bar explanation. Differences in concept/example values expected and necessary.

## Functional evidence
56/56 Node tests; production build with official source succeeded; node --check and git diff --check pass. v3-interaction-qa.log verifies skip-link keyboard, source disclosure mouse/keyboard, refresh unchanged/new official source behavior, navigation hash, eight-unit table/remarks, all chart-CDN fallbacks, live/delayed/stale/unavailable and hidden numbers past retention. v3-browser-qa.log verifies final real-clock viewports. IAB console error log empty; IAB rendering checked, final exact-sized screenshots from dedicated isolated Playwright session because IAB viewport capture returned a clipped native panel image. No shared browser profile.

## Implementation checklist
Complete: source capture, single recommended visual target generation, meaningful geometry tests, main wiring, desktop/mobile, state/keyboard/fallback QA, normalized source/implementation combined comparison, final real-clock screenshots. No push/deploy.

## Follow-up polish / residual gaps
P3: optional leader labels around desktop generation ring; current direct legend remains readable without hover. No real-device Safari/VoiceOver or actual layperson study performed. Proposed 3-person 5-second test remains to be done.

final result: passed
