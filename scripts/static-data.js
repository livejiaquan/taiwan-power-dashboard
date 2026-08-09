import {
  buildDashboardModel,
  GENERATION_ENDPOINT,
  SUPPLY_ENDPOINT
} from '../js/power-data.js';

export function buildStaticDataPayload({
  supplyPayload,
  generationPayload,
  generatedAt = new Date(),
  source = 'taipower-static',
  degradedReason = null
}) {
  const generatedDate = new Date(generatedAt);
  const metadata = degradedReason
    ? {
        degraded: true,
        reason: degradedReason
      }
    : {};
  const model = buildDashboardModel({
    supplyPayload,
    generationPayload,
    fetchedAt: generatedDate,
    source
  });

  return {
    schemaVersion: 2,
    model,
    rawUpdatedAt: {
      supply: model.supply.publishTimeText,
      generation: model.generation.updatedAt
    },
    observedAt: {
      supply: model.feeds.supply.observedAt,
      generation: model.feeds.generation.observedAt
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
    generatedFor: 'github-pages',
    ...metadata,
    metadata
  };
}
