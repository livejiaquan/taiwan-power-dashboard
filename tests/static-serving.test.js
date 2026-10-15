import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

async function availablePort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  listener.close();
  await once(listener, 'close');
  return port;
}

async function rawStatus(port, path) {
  return new Promise((resolve, reject) => {
    const request = get({ hostname: '127.0.0.1', port, path, timeout: 1000 }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('timeout', () => request.destroy(new Error('Request timed out')));
    request.on('error', reject);
  });
}

test('development server serves public assets but never repository or runtime files', async () => {
  const port = await availablePort();
  const server = spawn(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const exited = new Promise((resolve) => server.once('exit', resolve));

  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (server.exitCode !== null) throw new Error('Development server exited before startup');
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(500) });
        if (response.ok) { ready = true; break; }
      } catch { /* Wait until the child binds its port. */ }
      await delay(20);
    }
    assert.ok(ready, 'development server did not start');

    for (const path of ['/', '/index.html', '/css/main.css', '/js/main.js']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200, `${path} should be public`);
    }
    for (const path of ['/server.js', '/package.json', '/.git/config', '/.github/workflows/pages.yml', '/data/sample-power-data.js', '/scripts/build-static-site.js', '/tests/power-data.test.js', '/docs/PRODUCT.md', '/css/../server.js']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 404, `${path} should not be public`);
    }
    for (const path of ['/js/%2e%2e/server.js', '/css/%2e%2e%2fserver.js', '/%2e%67it/config', '/js/%5cserver.js']) {
      assert.equal(await rawStatus(port, path), 404, `${path} should not be public`);
    }
    assert.equal(await rawStatus(port, '/js/%ZZ'), 400, 'malformed path escapes should not hang the request');
  } finally {
    server.kill();
    await Promise.race([exited, delay(1000).then(() => { throw new Error('Development server did not exit'); })]);
  }
});
