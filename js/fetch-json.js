const DEFAULT_TIMEOUT_MS = 8 * 1000;

export async function fetchJsonWithTimeout(url, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headers
} = {}) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      ...(headers ? { headers } : {})
    });
    if (!response.ok) {
      throw new Error(`Upstream responded with HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
