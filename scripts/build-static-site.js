import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBuild as buildStaticData } from './build-static-data.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function buildStaticSite({
  outputDir = resolve(projectRoot, 'dist'),
  buildData = buildStaticData
} = {}) {
  const resolvedOutputDir = resolve(outputDir);
  if (resolvedOutputDir === projectRoot || !resolvedOutputDir.startsWith(`${projectRoot}/`)) {
    throw new TypeError('Static build output must be a dedicated directory inside this repository');
  }

  await rm(resolvedOutputDir, { recursive: true, force: true });
  await mkdir(resolvedOutputDir, { recursive: true });
  await Promise.all([
    cp(resolve(projectRoot, 'index.html'), resolve(resolvedOutputDir, 'index.html')),
    cp(resolve(projectRoot, 'css'), resolve(resolvedOutputDir, 'css'), { recursive: true }),
    cp(resolve(projectRoot, 'js'), resolve(resolvedOutputDir, 'js'), { recursive: true }),
    writeFile(resolve(resolvedOutputDir, '.nojekyll'), '')
  ]);

  await buildData({ outputPath: resolve(resolvedOutputDir, 'api/power-data.json') });
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
