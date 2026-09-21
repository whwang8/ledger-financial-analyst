import InvestigationWorkspace from '@/components/investigations';
import { datasets } from '@/lib/catalog';
import definition from '@/data/metrics/cost-to-revenue.json';
export default function Investigations() {
  return (
    <InvestigationWorkspace
      datasets={datasets.map((d) => ({
        id: d.id,
        name: d.name,
        synthetic: d.synthetic,
      }))}
      definition={definition}
    />
  );
}
