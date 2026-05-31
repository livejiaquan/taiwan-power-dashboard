import {
  buildDashboardModel,
  GENERATION_ENDPOINT,
  SUPPLY_ENDPOINT
} from '../js/power-data.js';

export function buildStaticDataPayload({ supplyPayload, generationPayload, generatedAt = new Date() }) {
  const generatedDate = new Date(generatedAt);

  return {
    model: buildDashboardModel({
      supplyPayload,
      generationPayload,
      fetchedAt: generatedDate,
      source: 'taipower-static'
    }),
    rawUpdatedAt: {
      supply: supplyPayload?.records?.[1]?.publish_time || null,
      generation: generationPayload?.DateTime || null
    },
    sources: {
      supply: SUPPLY_ENDPOINT,
      generation: GENERATION_ENDPOINT
    },
    cache: {
      hit: false,
      storedAt: generatedDate.toISOString(),
      ttlSeconds: 10 * 60
    },
    generatedFor: 'github-pages'
  };
}
