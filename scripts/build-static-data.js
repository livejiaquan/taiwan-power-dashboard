import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GENERATION_ENDPOINT,
  SUPPLY_ENDPOINT
} from '../js/power-data.js';
import { buildStaticDataPayload } from './static-data.js';

function getOutputPath(argv = process.argv) {
  const outIndex = argv.indexOf('--out');
  if (outIndex !== -1 && argv[outIndex + 1]) {
    return resolve(argv[outIndex + 1]);
  }

  return resolve('api/power-data.json');
}

async function fetchJson(url, { fetchImpl, attempts, retryDelayMs, requestTimeoutMs }) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(requestTimeoutMs),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'taiwan-power-dashboard/0.1'
        }
      });

      if (!response.ok) {
        throw new Error(`Taipower responded with HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * retryDelayMs));
      }
    }
  }

  throw lastError;
}

export async function runBuild({
  fetchImpl = globalThis.fetch,
  outputPath = getOutputPath(),
  now = () => new Date(),
  attempts = 3,
  retryDelayMs = 1500,
  requestTimeoutMs = 15_000
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('runBuild requires a fetch implementation');
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new TypeError('runBuild attempts must be a positive integer');
  }
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new TypeError('runBuild retryDelayMs must be non-negative');
  }
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new TypeError('runBuild requestTimeoutMs must be positive');
  }

  const fetchOptions = { fetchImpl, attempts, retryDelayMs, requestTimeoutMs };
  const [supplyPayload, generationPayload] = await Promise.all([
    fetchJson(SUPPLY_ENDPOINT, fetchOptions),
    fetchJson(GENERATION_ENDPOINT, fetchOptions)
  ]);
  const generatedAt = typeof now === 'function' ? now() : now;
  const payload = buildStaticDataPayload({
    supplyPayload,
    generationPayload,
    generatedAt
  });

  const resolvedOutputPath = resolve(outputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(payload, null, 2)}\n`);

  return {
    outputPath: resolvedOutputPath,
    payload
  };
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  try {
    const result = await runBuild();
    console.log(`Wrote static power data to ${result.outputPath}`);
  } catch (error) {
    console.error(`Static data build failed; previous deployment remains untouched: ${error.message}`);
    process.exitCode = 1;
  }
}
