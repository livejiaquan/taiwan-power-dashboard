import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchJsonWithTimeout } from '../js/fetch-json.js';

test('official feed timeout remains active while the response body stalls', async () => {
  let requestSignal;
  const fetchImpl = async (_url, { signal }) => {
    requestSignal = signal;
    return {
      ok: true,
      async json() {
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        });
      }
    };
  };

  await assert.rejects(
    fetchJsonWithTimeout('https://example.test/feed.json', {
      fetchImpl,
      timeoutMs: 10
    }),
    { name: 'AbortError' }
  );
  assert.equal(requestSignal.aborted, true);
});
