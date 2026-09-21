import { ownerFor, storage } from '@/lib/store';
import {
  buildReport,
  reportMarkdown,
  financialMemo,
  htmlReport,
} from '@/lib/reports';
import { hash } from '@/lib/recorder';
import { readBoundedJson } from '@/lib/http';
import { builtInRun } from '@/lib/historical';
export async function POST(request: Request) {
  try {
    const s = await storage(ownerFor(request));
    const b = (await readBoundedJson(request)) as {
      run_ids?: unknown;
      kind?: string;
    };
    if (
      !Array.isArray(b.run_ids) ||
      !b.run_ids.length ||
      b.run_ids.length > 50 ||
      b.run_ids.some((x) => typeof x !== 'string') ||
      new Set(b.run_ids).size !== b.run_ids.length
    )
      throw new Error('Select one to fifty distinct saved investigations.');
    const runs = await Promise.all(
      (b.run_ids as string[]).map(
        async (id) => builtInRun(id) ?? (await s.run(id)),
      ),
    );
    if (runs.some((r) => !r))
      throw new Error('An investigation was not found.');
    const reviews = (
      await Promise.all(runs.map((r) => s.reviews(r!.id)))
    ).flat();
    const report = buildReport(
      runs.filter((r) => !!r),
      reviews,
    );
    const markdown =
      b.kind === 'memo'
        ? financialMemo(
            runs[0]!,
            reviews.filter((r) => r.run_id === runs[0]!.id),
          )
        : reportMarkdown(report);
    const artifact = {
      id: crypto.randomUUID(),
      kind: b.kind === 'memo' ? 'memo' : 'iteration',
      report,
      markdown,
      content_hash: await hash({ report, markdown }),
    };
    await s.put(artifact.id, 'report', null, artifact, {
      id: artifact.id,
      kind: artifact.kind,
      created_at: report.created_at,
    });
    return Response.json(artifact);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
export async function GET(request: Request) {
  try {
    const s = await storage(ownerFor(request));
    const q = new URL(request.url).searchParams,
      id = q.get('id');
    if (!id)
      return Response.json({
        reports: (await s.list('report')).map((r) => JSON.parse(r.metadata)),
      });
    const a = await s.read<{ markdown: string; kind: string }>(id);
    if (!a || !['iteration', 'memo'].includes(a.kind))
      return Response.json({ error: 'Report not found.' }, { status: 404 });
    const format = q.get('format') ?? 'json';
    const content =
      format === 'md'
        ? a.markdown
        : format === 'html'
          ? htmlReport(a.markdown)
          : JSON.stringify(a, null, 2);
    return new Response(content, {
      headers: {
        'Content-Type':
          format === 'html'
            ? 'text/html; charset=utf-8'
            : format === 'md'
              ? 'text/markdown; charset=utf-8'
              : 'application/json',
        'Content-Disposition': `attachment; filename="ledger-report-${id}.${format === 'md' ? 'md' : format === 'html' ? 'html' : 'json'}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
