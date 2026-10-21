import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCurvesPayload, SECTION_ENDPOINTS, taipeiDateKey } from '../js/power-curves.js';

// The loadGraph host sits behind CloudFront and is known to filter some
// clients, so ask like a browser would. Text is decoded as UTF-8 (the files
// are ASCII digits plus an optional BOM).
const REQUEST_HEADERS = {
  Accept: 'text/csv,text/plain,*/*',
  'User-Agent': 'Mozilla/5.0 (compatible; taiwan-power-dashboard/0.2; +https://github.com/livejiaquan/taiwan-power-dashboard)'
};

async function fetchText(url, { fetchImpl, requestTimeoutMs, attempts }) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Taipower curve request timed out', 'TimeoutError')),
      requestTimeoutMs
    );
    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: REQUEST_HEADERS });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error('回應超過 2 MB 上限');
      return text;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return lastError instanceof Error ? lastError : new Error(String(lastError));
}

// Never throws for upstream problems: each section records its own error and
// the core snapshot publishes regardless.
export async function runCurveBuild({
  fetchImpl = globalThis.fetch,
  outputPath = resolve('api/curves.json'),
  todayKey,
  now = () => new Date(),
  requestTimeoutMs = 15_000,
  attempts = 2
} = {}) {
  const generatedAt = now();
  const key = todayKey || taipeiDateKey(generatedAt);
  const entries = await Promise.all(Object.entries(SECTION_ENDPOINTS).map(async ([section, url]) => [
    section,
    await fetchText(url, { fetchImpl, requestTimeoutMs, attempts })
  ]));
  const payload = buildCurvesPayload({ texts: Object.fromEntries(entries), todayKey: key, generatedAt });

  const resolvedOutputPath = resolve(outputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(payload)}\n`);
  return { outputPath: resolvedOutputPath, payload };
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { outputPath, payload } = await runCurveBuild();
  const failed = Object.entries(payload.errors);
  console.log(`Wrote curve data to ${outputPath}`);
  for (const [section, message] of failed) console.warn(`  ${section} unavailable: ${message}`);
}
