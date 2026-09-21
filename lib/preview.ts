import { getDataset, displayFact } from './catalog';
import { executeTool, extractFacts } from './tools';
import type { Run, Fact, Trace } from './types';
export function calculationPreview(datasetId: string): Run {
  const d = getDataset(datasetId),
    trace: Trace[] = [],
    facts = new Map<string, Fact>();
  const call = (tool: string, args: Record<string, unknown>) => {
    const result = executeTool(datasetId, tool, args);
    trace.push({
      step: trace.length + 1,
      tool,
      arguments: args,
      result,
      elapsed_ms: 0,
    });
    for (const f of extractFacts(result)) facts.set(f.id, f);
    return result;
  };
  call('inspect_dataset', {});
  call('calculate_metrics', {
    periods: ['2025-Q1', '2025-Q2'],
    metrics: ['revenue', 'gross_margin', 'operating_profit'],
  });
  const bridge = call('explain_profit_change', {
    from_period: '2025-Q1',
    to_period: '2025-Q2',
  }) as { complete: boolean; missing_months: string[]; facts: Fact[] };
  const q1 = d.periods['2025-Q1'].facts.find(
      (f) => f.metric === 'operating_profit',
    )!,
    q2 = d.periods['2025-Q2'].facts.find(
      (f) => f.metric === 'operating_profit',
    )!;
  return {
    id: crypto.randomUUID(),
    dataset_id: datasetId,
    dataset_hash: d.sha256,
    question: 'Preview the Q1-to-Q2 profit calculation.',
    analysis: {
      decision: bridge.complete ? 'answer' : 'limited',
      summary: bridge.complete
        ? 'Quarterly profit reconciliation'
        : 'Q2 cannot be compared as a complete quarter.',
      findings: bridge.complete
        ? [
            {
              text: `Operating profit: ${displayFact(q1)} in Q1 → ${displayFact(q2)} in Q2.`,
              evidence_ids: [q1.id, q2.id],
            },
            ...bridge.facts.map((f) => ({
              text: `${f.metric.replaceAll('_', ' ')} ${f.metric === 'operating_profit' ? 'change' : 'contribution'}: ${displayFact(f)}.`,
              evidence_ids: [f.id],
            })),
          ]
        : [
            {
              text: `Missing months: ${bridge.missing_months.join(', ')}. Complete Q2 profit is unavailable; missing data is not treated as zero.`,
              evidence_ids: [q2.id],
            },
          ],
      limitations: [
        'This is a deterministic calculation preview, not an LLM response.',
        'Financial totals alone do not establish underlying business causes.',
      ],
      suggested_questions: [
        'Why did operating profit change from Q1 to Q2 2025?',
        'Investigate the largest cost contribution and compare corresponding months.',
      ],
    },
    trace,
    facts: [...facts.values()],
    provider: 'none',
    model: 'none',
    elapsed_ms: 0,
    usage: { input_tokens: 0, output_tokens: 0 },
    mode: 'calculation_preview',
    created_at: new Date().toISOString(),
    validation: { references_valid: true, semantic_review: 'not_reviewed' },
  };
}
