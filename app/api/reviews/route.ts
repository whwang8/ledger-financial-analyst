import { ownerFor, storage } from '@/lib/store';
import { readBoundedJson } from '@/lib/http';
import type { Review } from '@/lib/types';
import { builtInRun } from '@/lib/historical';
export async function POST(request: Request) {
  try {
    const owner = ownerFor(request),
      s = await storage(owner),
      b = (await readBoundedJson(request)) as Record<string, unknown>;
    if (!b || typeof b.run_id !== 'string')
      throw new Error('Select an investigation.');
    const run = builtInRun(b.run_id) ?? (await s.run(b.run_id));
    if (!run) throw new Error('Investigation not found.');
    const str = (k: string, max = 3000) => {
      const v = b[k];
      if (typeof v !== 'string' || v.length > max)
        throw new Error('Invalid ' + k);
      return v;
    };
    if (
      !['claim', 'run', 'adjustment'].includes(String(b.scope)) ||
      !['pass', 'fail', 'not_reviewed'].includes(String(b.verdict)) ||
      !['author', 'independent'].includes(String(b.role))
    )
      throw new Error('Invalid review selection.');
    const reviewer = str('reviewer', 120).trim();
    if (!reviewer) throw new Error('Enter the reviewer name.');
    const review: Review = {
      id: crypto.randomUUID(),
      run_id: b.run_id,
      anchor: str('anchor', 150),
      scope: b.scope as Review['scope'],
      category: str('category', 100),
      verdict: b.verdict as Review['verdict'],
      expected: str('expected'),
      comment: str('comment'),
      reviewer,
      role: b.role as Review['role'],
      rubric: 'ledger-review-v2',
      created_at: new Date().toISOString(),
      approved_test: b.approved_test === true,
    };
    if (review.approved_test && !review.expected.trim())
      throw new Error('A regression test needs an approved expected outcome.');
    if (
      review.scope === 'run' &&
      review.verdict === 'pass' &&
      run.journal &&
      run.journal.state !== 'completed'
    )
      throw new Error(
        'An incomplete or failed investigation cannot receive a whole-task pass.',
      );
    if (typeof b.supersedes === 'string') {
      const prev = await s.read<Review>(b.supersedes);
      if (
        !prev ||
        prev.run_id !== review.run_id ||
        prev.scope !== review.scope ||
        prev.anchor !== review.anchor ||
        prev.reviewer !== review.reviewer ||
        prev.role !== review.role
      )
        throw new Error('Previous review not found.');
      review.supersedes = b.supersedes;
    }
    if (
      review.scope === 'claim' &&
      !run.analysis.findings.some(
        (f, i) => (f.id ?? 'claim-' + (i + 1)) === review.anchor,
      ) &&
      review.anchor !== 'summary'
    )
      throw new Error('Claim not found.');
    if (review.scope === 'adjustment') {
      if (run.dataset_id !== 'apple-fy2025')
        throw new Error(
          'The adjustment pilot requires an Apple annual investigation.',
        );
      const a = b.adjustment as Review['adjustment'];
      if (
        !a ||
        !Number.isFinite(a.amount) ||
        a.amount < 0 ||
        ![1, -1].includes(a.sign) ||
        !['proposed', 'approved', 'rejected'].includes(a.status) ||
        ['tax_treatment', 'source', 'recurrence', 'rationale'].some(
          (k) =>
            typeof a[k as keyof typeof a] !== 'string' ||
            !String(a[k as keyof typeof a]).trim() ||
            String(a[k as keyof typeof a]).length > 1500,
        )
      )
        throw new Error(
          'Complete the amount, source, rationale, tax and recurrence fields.',
        );
      review.adjustment = a;
      review.approved_test = false;
    }
    await s.put(review.id, 'review', review.run_id, review, review);
    return Response.json(review);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
