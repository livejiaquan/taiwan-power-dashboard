import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  GENERATION_ENDPOINT,
  SUPPLY_ENDPOINT
} from '../js/power-data.js';
import { buildStaticDataPayload } from './static-data.js';

function getOutputPath() {
  const outIndex = process.argv.indexOf('--out');
  if (outIndex !== -1 && process.argv[outIndex + 1]) {
    return resolve(process.argv[outIndex + 1]);
  }

  return resolve('api/power-data.json');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'taiwan-power-dashboard/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`Taipower responded with HTTP ${response.status}`);
  }

  return response.json();
}

const outputPath = getOutputPath();
const [supplyPayload, generationPayload] = await Promise.all([
  fetchJson(SUPPLY_ENDPOINT),
  fetchJson(GENERATION_ENDPOINT)
]);
const payload = buildStaticDataPayload({ supplyPayload, generationPayload });

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Wrote static power data to ${outputPath}`);
