import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { sampleGenerationPayload, sampleSupplyPayload } from '../data/sample-power-data.js';
import { validateSameOriginPayload } from '../js/api.js';
import { GENERATION_ENDPOINT, SUPPLY_ENDPOINT } from '../js/power-data.js';
import { runBuild } from '../scripts/build-static-data.js';
import { buildStaticSite } from '../scripts/build-static-site.js';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIXTURE_SOURCE_TIME = '2026-05-29T16:10:00.000Z';
const FIXTURE_FETCH_TIME = new Date('2026-05-29T16:15:00.000Z');

test('static site build assembles assets and validated fixture data without publishing a live snapshot', async (t) => {
  const outputDir = await mkdtemp(join(REPO_ROOT, '.test-build-ci-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const requests = [];

  const result = await buildStaticSite({
    outputDir,
    dataBuildAttempts: 1,
    buildData: ({ outputPath }) => runBuild({
      outputPath,
      now: () => FIXTURE_FETCH_TIME,
      attempts: 1,
      fetchImpl: async (url) => {
        requests.push(url);
        assert.ok([SUPPLY_ENDPOINT, GENERATION_ENDPOINT].includes(url));
        return {
          ok: true,
          json: async () => structuredClone(
            url === SUPPLY_ENDPOINT ? sampleSupplyPayload : sampleGenerationPayload
          )
        };
      }
    })
  });

  assert.equal(result, outputDir);
  assert.deepEqual(requests.sort(), [SUPPLY_ENDPOINT, GENERATION_ENDPOINT].sort());
  assert.deepEqual((await readdir(outputDir)).sort(), ['.nojekyll', 'api', 'css', 'index.html', 'js']);
  assert.equal(await readFile(join(outputDir, '.nojekyll'), 'utf8'), '');
  assert.equal(
    await readFile(join(outputDir, 'index.html'), 'utf8'),
    await readFile(join(REPO_ROOT, 'index.html'), 'utf8')
  );

  for (const directory of ['css', 'js']) {
    const sourceFiles = (await readdir(join(REPO_ROOT, directory), { recursive: true })).sort();
    assert.deepEqual((await readdir(join(outputDir, directory), { recursive: true })).sort(), sourceFiles);
    for (const file of sourceFiles) {
      assert.deepEqual(
        await readFile(join(outputDir, directory, file)),
        await readFile(join(REPO_ROOT, directory, file)),
        `${directory}/${file} must be copied without changes`
      );
    }
  }

  assert.deepEqual(await readdir(join(outputDir, 'api')), ['power-data.json']);
  const payload = JSON.parse(await readFile(join(outputDir, 'api', 'power-data.json'), 'utf8'));
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.model.feeds.supply.observedAt, FIXTURE_SOURCE_TIME);
  assert.equal(payload.model.feeds.generation.observedAt, FIXTURE_SOURCE_TIME);
  assert.equal(payload.model.feeds.supply.fetchedAt, FIXTURE_FETCH_TIME.toISOString());
  assert.equal(validateSameOriginPayload(payload, { now: FIXTURE_FETCH_TIME }).freshness.state, 'live');
  // Fixed fixture times must never be rewritten to appear fresh at a later time.
  assert.throws(
    () => validateSameOriginPayload(payload, { now: new Date('2026-05-31T16:15:00.000Z') }),
    /超過 24 小時/
  );
});
