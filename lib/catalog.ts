import raw from './generated/catalog.json';
import type { Dataset, Fact, FactSet } from './types';
export const datasets = raw.datasets as Dataset[];
export const getDataset = (id: string) => {
  const d = datasets.find((x) => x.id === id);
  if (!d) throw new Error('Unknown dataset');
  return d;
};
export const metricNames = [
  'revenue',
  'cogs',
  'operating_expenses',
  'gross_profit',
  'operating_profit',
  'gross_margin',
  'operating_margin',
];
export const metricLabel = (name: string) =>
  name.replaceAll('_', ' ').replace(/^./, (x) => x.toUpperCase());
export const displayFact = (f: Fact) =>
  f.value === null
    ? 'Unavailable'
    : f.unit === 'USD'
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        }).format(f.value)
      : `${f.value.toFixed(2)}${f.unit === 'percentage_points' ? ' pp' : '%'}`;
export const getFact = (d: Dataset, p: string, m: string) =>
  d.periods[p]?.facts.find((f) => f.metric === m);
export const getSet = (sets: Record<string, FactSet>, key: string) => {
  const s = sets[key];
  if (!s)
    throw new Error(
      'Unsupported period. Use inspect_dataset to see available periods.',
    );
  return s;
};
