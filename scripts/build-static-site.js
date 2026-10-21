import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBuild as buildStaticData } from './build-static-data.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function buildStaticSite({
  outputDir = resolve(projectRoot, 'dist'),
  assetsDir = resolve(projectRoot, 'build/web'),
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

  const resolvedAssetsDir = resolve(assetsDir);
  try {
    if (!(await stat(join(resolvedAssetsDir, 'index.html'))).isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`Missing built web app at ${resolvedAssetsDir}; run "vite build" first`);
  }

  const stagingRoot = await mkdtemp(join(projectRoot, '.power-site-build-'));
  const stagedSite = join(stagingRoot, 'site');
  const previousSite = join(stagingRoot, 'previous');
  let movedPrevious = false;
  let preservePrevious = false;
  try {
    await mkdir(stagedSite);
    await cp(resolvedAssetsDir, stagedSite, { recursive: true });
    await writeFile(join(stagedSite, '.nojekyll'), '');

    const dataOutputPath = join(stagedSite, 'api/power-data.json');
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
    if (lastError) throw lastError;

    await mkdir(dirname(resolvedOutputDir), { recursive: true });
    try {
      await rename(resolvedOutputDir, previousSite);
      movedPrevious = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await rename(stagedSite, resolvedOutputDir);
    } catch (error) {
      if (movedPrevious) {
        try {
          await rename(previousSite, resolvedOutputDir);
        } catch (restoreError) {
          preservePrevious = true;
          throw new AggregateError([error, restoreError], `Previous site preserved at ${previousSite}`);
        }
      }
      throw error;
    }
  } finally {
    if (!preservePrevious) await rm(stagingRoot, { recursive: true, force: true });
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
