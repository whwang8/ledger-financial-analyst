import type { Fact } from './types';
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
export const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
