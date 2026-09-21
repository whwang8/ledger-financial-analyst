import type { Run, Review } from './types';
import { displayFact, metricLabel } from './format';
export const activeReviews = (reviews: Review[]) => {
  const superseded = new Set(reviews.map((r) => r.supersedes).filter(Boolean));
  return reviews.filter((r) => !superseded.has(r.id));
};
export function verdict(reviews: Review[], role?: Review['role']) {
  const rs = activeReviews(reviews).filter(
    (r) =>
      r.scope === 'run' &&
      (!role || r.role === role) &&
      r.verdict !== 'not_reviewed',
  );
  if (!rs.length) return 'not_reviewed';
  if (
    rs.some((r) => r.verdict === 'pass') &&
    rs.some((r) => r.verdict === 'fail')
  )
    return 'disputed';
  return rs.some((r) => r.verdict === 'fail') ? 'fail' : 'pass';
}
export function comparable(a: Run, b: Run) {
  return (
    a.dataset_hash === b.dataset_hash &&
    a.question === b.question &&
    JSON.stringify(a.journal?.history ?? []) ===
      JSON.stringify(b.journal?.history ?? [])
  );
}
const identity = (r: Run) =>
  JSON.stringify([r.question, r.dataset_hash, r.journal?.history ?? []]);
export function buildReport(runs: Run[], reviews: Review[]) {
  const live = runs.filter((r) => r.mode === 'live'),
    completed = live.filter(
      (r) => r.journal?.state === 'completed' || (!r.journal && r.analysis),
    );
  const groups = new Map<string, Run[]>();
  for (const r of live) {
    const key = identity(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const initial = [...groups.values()].map(
    (rs) => [...rs].sort((a, b) => a.created_at.localeCompare(b.created_at))[0],
  );
  const rs = (r: Run) => reviews.filter((x) => x.run_id === r.id);
  const count = (items: Run[], v: string, role?: Review['role']) =>
    items.filter(
      (r) =>
        verdict(rs(r), role) === v &&
        (v !== 'pass' || completed.some((x) => x.id === r.id)),
    ).length;
  const rows = live.map((r) => ({
    id: r.id,
    question: r.question,
    dataset_id: r.dataset_id,
    dataset_hash: r.dataset_hash,
    state: r.journal?.state ?? 'completed',
    parent_run_id: r.journal?.parent_run_id ?? null,
    case_id: r.journal?.case_id ?? null,
    review: verdict(rs(r)),
    author_review: verdict(rs(r), 'author'),
    independent_review: verdict(rs(r), 'independent'),
    provider_requests: r.journal?.provider_requests ?? null,
    input_tokens: r.usage.input_tokens,
    output_tokens: r.usage.output_tokens,
    usage_complete: r.journal?.usage_complete ?? false,
    elapsed_ms: r.elapsed_ms,
    configuration: r.journal?.configuration ?? null,
  }));
  const pairs = live
    .filter((r) => r.journal?.parent_run_id)
    .map((r) => {
      const p = runs.find((x) => x.id === r.journal!.parent_run_id);
      return {
        original_id: r.journal!.parent_run_id!,
        new_id: r.id,
        comparable: !!p && comparable(p, r),
        original_review: p ? verdict(rs(p)) : 'not_reviewed',
        new_review: verdict(rs(r)),
        changed: p
          ? {
              model: [p.model, r.model],
              instruction: [
                p.journal?.configuration.instruction ?? 'not recorded',
                r.journal?.configuration.instruction,
              ],
              metric_policy: [
                p.journal?.configuration.metric_policy ?? 'not recorded',
                r.journal?.configuration.metric_policy,
              ],
              implementation: [
                p.journal?.configuration.version ?? 'not recorded',
                r.journal?.configuration.version,
              ],
            }
          : null,
      };
    });
  return {
    generator: 'ledger-report-2',
    created_at: new Date().toISOString(),
    manifest: {
      run_ids: runs.map((r) => r.id),
      review_ids: reviews.map((r) => r.id),
      rubrics: [...new Set(reviews.map((r) => r.rubric))],
      selection:
        'Explicit selected saved records; not a frozen benchmark unless its evaluation manifest says so.',
    },
    counts: {
      attempts: live.length,
      unique_tasks: groups.size,
      earliest_selected_attempts: initial.length,
      earliest_selected_completed: initial.filter(
        (r) => r.journal?.state === 'completed' || !r.journal,
      ).length,
      completed: completed.length,
      failed: live.filter((r) => r.journal?.state === 'failed').length,
      running: live.filter((r) => r.journal?.state === 'running').length,
      interrupted: live.filter((r) => r.journal?.state === 'interrupted')
        .length,
      earliest_selected_reviewed_passes: count(initial, 'pass'),
      reviewed_passes: count(live, 'pass'),
      reviewed_failures: count(live, 'fail'),
      disputed: count(live, 'disputed'),
      pending_review: count(live, 'not_reviewed'),
      independent_reviewed: live.filter(
        (r) => verdict(rs(r), 'independent') !== 'not_reviewed',
      ).length,
      eventual_unique_passes: [...groups.values()].filter((xs) =>
        xs.some(
          (r) =>
            completed.some((x) => x.id === r.id) && verdict(rs(r)) === 'pass',
        ),
      ).length,
      provider_requests: rows.reduce(
        (n, r) => n + (r.provider_requests ?? 0),
        0,
      ),
      request_count_complete: rows.every((r) => r.provider_requests !== null),
      known_input_tokens: rows.reduce((n, r) => n + r.input_tokens, 0),
      known_output_tokens: rows.reduce((n, r) => n + r.output_tokens, 0),
      usage_complete: rows.every((r) => r.usage_complete),
    },
    rows,
    pairs,
    reviews,
    notes: [
      'Execution completion is not answer correctness. Claim flags do not mark a whole run reviewed.',
      'Earliest selected attempt counts do not establish original-attempt results when earlier records were omitted. Review roles are declared by the person recording the review.',
      'Reruns retain the original attempt. Repeated tasks are not new datasets.',
      'No monetary cost is inferred without dated provider prices and complete billable usage.',
      'Automated value/reference checks do not establish semantic or causal correctness.',
    ],
  };
}
export type IterationReport = ReturnType<typeof buildReport>;
const cell = (s: unknown) =>
  (s == null ? 'Not recorded' : typeof s === 'string' ? s : JSON.stringify(s))
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
export function reportMarkdown(r: IterationReport) {
  return `# Ledger iteration report\n\nGenerated ${r.created_at}\n\n${r.manifest.selection}\n\n| Measure | Count |\n|---|---:|\n${Object.entries(
    r.counts,
  )
    .map(([k, v]) => `| ${cell(k.replaceAll('_', ' '))} | ${cell(v)} |`)
    .join(
      '\n',
    )}\n\n## Attempts\n\n| Saved run | Dataset | Execution | Whole-run review | Independent review |\n|---|---|---|---|---|\n${r.rows.map((x) => `| [${x.id}](/investigations?run=${x.id}) | ${cell(x.dataset_id)} | ${x.state} | ${x.review} | ${x.independent_review} |`).join('\n')}\n\n## Comparisons\n\n${r.pairs.map((p) => `- ${p.original_id} → ${p.new_id}: ${p.comparable ? 'Same question/data/history' : 'Not comparable or original omitted'}; ${p.original_review} → ${p.new_review}. Changes: ${JSON.stringify(p.changed)}`).join('\n') || 'No paired reruns selected.'}\n\n## Review evidence\n\n${r.reviews.map((x) => `- ${x.id}: ${cell(x.reviewer)} (${x.role}), ${x.scope}, ${x.verdict}. ${cell(x.comment)} Expected: ${cell(x.expected)}${x.supersedes ? ' Supersedes ' + x.supersedes : ''}`).join('\n') || 'No human reviews recorded.'}\n\n## Limits\n\n${r.notes.map((n) => '- ' + n).join('\n')}\n\n## Frozen manifest\n\n\`\`\`json\n${JSON.stringify(r.manifest, null, 2)}\n\`\`\`\n`;
}
export function financialMemo(run: Run, reviews: Review[]) {
  const amount = (ids: string[]) =>
    ids
      .map((id) => run.facts.find((f) => f.id === id))
      .filter((f) => !!f)
      .map(
        (f) =>
          `${metricLabel(f!.metric)} · ${f!.period}: ${f!.unit === 'passage' ? f!.passage : displayFact(f!)} [${f!.id}]`,
      )
      .join('; ');
  return `# Financial investigation memo\n\nQuestion: ${run.question}\n\nDataset: ${run.dataset_id}; snapshot ${run.dataset_hash}\n\nStatus: ${run.journal?.state ?? 'historical completed'} · human review: ${verdict(reviews)}\n\n${run.analysis.summary}\n\n${run.analysis.findings.map((f) => `## ${f.kind ?? 'Historical finding'}\n\n${f.text}\n\n${amount(f.evidence_ids)}`).join('\n\n')}\n\n## Limitations and unresolved questions\n\n${[...run.analysis.limitations, ...run.analysis.suggested_questions].map((s) => '- ' + s).join('\n')}\n\n## Proposed adjustment ledger\n\n${
    activeReviews(reviews)
      .filter((r) => r.adjustment)
      .map(
        (r) =>
          `- ${r.adjustment!.status}: ${r.adjustment!.sign * r.adjustment!.amount} in dataset units; ${r.adjustment!.rationale}. Source: ${r.adjustment!.source}. Tax: ${r.adjustment!.tax_treatment}. Recurrence: ${r.adjustment!.recurrence}. Reviewer: ${r.reviewer}.`,
      )
      .join('\n') || 'No adjustments recorded.'
  }\n\nReported figures remain unchanged. Adjustments are separate analyst judgments.\n\nSaved investigation: /investigations?run=${run.id}\n`;
}
export const htmlReport = (markdown: string) =>
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ledger investigation report</title><style>body{font:16px/1.65 system-ui;max-width:1000px;margin:40px auto;padding:24px;color:#172438}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0}}</style><body><pre>' +
  markdown
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;') +
  '</pre></body></html>';
