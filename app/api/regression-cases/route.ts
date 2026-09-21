import { ownerFor, storage } from '@/lib/store';
import { activeReviews } from '@/lib/reports';
import { builtInRun } from '@/lib/historical';
import type { Review } from '@/lib/types';
export async function GET(request: Request) {
  try {
    const s = await storage(ownerFor(request));
    const records = await s.list('review');
    const reviews = (
      await Promise.all(records.map((r) => s.read<Review>(r.id)))
    ).filter((r): r is Review => !!r);
    const cases = [];
    for (const r of activeReviews(reviews).filter((r) => r.approved_test)) {
      const run = builtInRun(r.run_id) ?? (await s.run(r.run_id));
      if (!run) continue;
      cases.push({
        id: 'review-' + r.id,
        dataset_id: run.dataset_id,
        dataset_hash: run.dataset_hash,
        question: run.question,
        history: run.journal?.history ?? [],
        expected_behavior: r.expected,
        expected_facts: [],
        original_run_id: run.id,
        review_id: r.id,
        reviewer: r.reviewer,
        role: r.role,
        rubric: r.rubric,
        source_snapshot: run.journal?.source ?? null,
      });
    }
    return Response.json(
      {
        version: 'regression-cases-1',
        created_at: new Date().toISOString(),
        note: 'Human-approved expected behavior. Empty expected_facts means arithmetic coverage is not applicable; semantic grading remains separate.',
        cases,
      },
      {
        headers: {
          'Content-Disposition':
            'attachment; filename="ledger-regression-cases.json"',
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
