import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBuild as buildStaticData } from './build-static-data.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function buildStaticSite({
  outputDir = resolve(projectRoot, 'dist'),
  buildData = buildStaticData,
  dataBuildAttempts = 3,
  dataBuildRetryDelayMs = 10_000,
  waitImpl = (delayMs) => new Promise((resolveWait) => setTimeout(resolveWait, delayMs))
} = {}) {
  const resolvedOutputDir = resolve(outputDir);
  if (resolvedOutputDir === projectRoot || !resolvedOutputDir.startsWith(`${projectRoot}/`)) {
    throw new TypeError('Static build output must be a dedicated directory inside this repository');
  }
  if (!Number.isInteger(dataBuildAttempts) || dataBuildAttempts < 1 || dataBuildAttempts > 3) {
    throw new TypeError('Static data build attempts must be an integer between 1 and 3');
  }
  if (!Number.isFinite(dataBuildRetryDelayMs) || dataBuildRetryDelayMs < 0) {
    throw new TypeError('Static data build retry delay must be non-negative');
  }
  if (typeof waitImpl !== 'function') {
    throw new TypeError('Static data build wait implementation must be a function');
  }

  await rm(resolvedOutputDir, { recursive: true, force: true });
  await mkdir(resolvedOutputDir, { recursive: true });
  await Promise.all([
    cp(resolve(projectRoot, 'index.html'), resolve(resolvedOutputDir, 'index.html')),
    cp(resolve(projectRoot, 'css'), resolve(resolvedOutputDir, 'css'), { recursive: true }),
    cp(resolve(projectRoot, 'js'), resolve(resolvedOutputDir, 'js'), { recursive: true }),
    writeFile(resolve(resolvedOutputDir, '.nojekyll'), '')
  ]);

  const dataOutputPath = resolve(resolvedOutputDir, 'api/power-data.json');
  let lastError = null;
  for (let attempt = 1; attempt <= dataBuildAttempts; attempt += 1) {
    try {
      await buildData({ outputPath: dataOutputPath });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < dataBuildAttempts) {
        console.warn(
          `Static data build attempt ${attempt}/${dataBuildAttempts} failed; retrying: ${error.message}`
        );
        await waitImpl(attempt * dataBuildRetryDelayMs);
      }
    }
  }
  if (lastError) {
    throw lastError;
  }
  return resolvedOutputDir;
}
const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  try {
    const outputDir = await buildStaticSite();
    console.log(`Built production site in ${outputDir}`);
  } catch (error) {
    console.error(`Production build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
