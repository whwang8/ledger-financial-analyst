import Ledger from '@/components/ledger';
import overview from '@/lib/generated/overview.json';
import type { Dataset } from '@/lib/types';
export default function Home() {
  return <Ledger datasets={overview.datasets as Dataset[]} />;
}
