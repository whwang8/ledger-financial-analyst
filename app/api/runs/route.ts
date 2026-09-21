import { recordedExamples } from '@/lib/historical';
import { runMetadata } from '@/lib/store';
import { ownerFor, storage } from '@/lib/store';
export async function GET(request: Request) {
  try {
    const s = await storage(ownerFor(request));
    return Response.json(
      {
        runs: [
          ...recordedExamples.map((r) => ({
            ...runMetadata(r),
            example: true,
          })),
          ...(await s.list('run'))
            .filter((r) => !recordedExamples.some((x) => x.id === r.id))
            .map((r) => JSON.parse(r.metadata)),
        ],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
