// Fuel palette follows the conventions shared by Electricity Maps, Open
// Electricity and grid.iamkate.com: fossil fuels in dark/warm tones, renewables
// in their natural colours, nuclear violet, storage green. Keys come from js/power-data.js.
export const FUEL_STYLE = {
  coal: { color: '#3f4450', group: 'fossil', order: 1 },
  gas: { color: '#e8833a', group: 'fossil', order: 2 },
  oil: { color: '#9b3d3d', group: 'fossil', order: 3 },
  cogeneration: { color: '#a47e5b', group: 'fossil', order: 4 },
  nuclear: { color: '#8b5cf6', group: 'lowCarbon', order: 5 },
  hydro: { color: '#2f6fd6', group: 'renewable', order: 6 },
  wind: { color: '#2bb3c0', group: 'renewable', order: 7 },
  solar: { color: '#f5c518', group: 'renewable', order: 8 },
  'other-renewable': { color: '#5fae57', group: 'renewable', order: 9 },
  storage: { color: '#10a37f', group: 'storage', order: 10 },
  'storage-load': { color: '#8fd3bd', group: 'storage', order: 11 },
  other: { color: '#94a3b8', group: 'other', order: 12 }
};

export const GROUP_LABEL = {
  fossil: '化石燃料',
  lowCarbon: '核能',
  renewable: '再生能源',
  storage: '儲能',
  other: '其它'
};

export function fuelStyle(key, fallbackColor = '#94a3b8') {
  return FUEL_STYLE[key] || { color: fallbackColor, group: 'other', order: 99 };
}

export function fuelColor(category) {
  return fuelStyle(category?.key, category?.color).color;
}

export function sortByFuelOrder(categories) {
  return [...categories].sort((a, b) => fuelStyle(a.key).order - fuelStyle(b.key).order);
}
