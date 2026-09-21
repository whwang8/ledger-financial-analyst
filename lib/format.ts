import type { Fact } from './types';
export const metricLabel = (name: string) =>
  name.replaceAll('_', ' ').replace(/^./, (x) => x.toUpperCase());
export const displayFact = (f: Fact) =>
  f.value === null
    ? 'Unavailable'
    : f.unit === 'USD' || f.unit === 'USD_millions'
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        }).format(f.value) + (f.unit === 'USD_millions' ? 'm' : '')
      : `${f.value.toFixed(2)}${f.unit === 'percentage_points' ? ' pp' : f.unit === 'ratio' ? '×' : '%'}`;
export const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
