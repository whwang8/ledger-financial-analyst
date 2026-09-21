import { ownerFor, storage } from '@/lib/store';
import { getDataset } from '@/lib/catalog';
import { builtInRun } from '@/lib/historical';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const owner = ownerFor(request);
    const { id } = await context.params;
    const s = await storage(owner);
    const run = builtInRun(id) ?? (await s.run(id));
    if (!run)
      return Response.json(
        { error: 'Investigation not found.' },
        { status: 404 },
      );
    return Response.json(
      {
        run,
        reviews: await s.reviews(run.id),
        source:
          run.journal?.source ??
          (() => {
            const d = getDataset(run.dataset_id);
            return d.sha256 === run.dataset_hash
              ? {
                  id: d.id,
                  name: d.name,
                  sha256: d.sha256,
                  rows: d.rows,
                  synthetic: d.synthetic,
                }
              : null;
          })(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
