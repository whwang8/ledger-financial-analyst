import saved from './generated/historical.json';
import example from './generated/recorded-example.json';
import failure from './generated/recorded-failure.json';
import type { Run } from './types';
export const historicalRun = saved as Run;
export const recordedExamples = [example as Run, failure as Run];
export const builtInRun = (id: string): Run | undefined =>
  id === 'recorded-example'
    ? recordedExamples[0]
    : id === historicalRun.id
      ? historicalRun
      : recordedExamples.find((r) => r.id === id);
