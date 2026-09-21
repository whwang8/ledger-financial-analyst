import buildInfo from '@/lib/generated/build-info.json';
import { datasets } from '@/lib/catalog';
import { IMPLEMENTATION_VERSION } from '@/lib/recorder';
import { providerStatus } from '@/lib/config';
export function GET() {
  return Response.json(
    {
      ...providerStatus(),
      implementation_version: IMPLEMENTATION_VERSION,
      source_hash: buildInfo.source_hash,
      datasets: datasets.map((d) => ({
        id: d.id,
        sha256: d.sha256,
        engine_hash: d.preparation?.engine_hash,
      })),
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
