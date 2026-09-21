import { getDataset, getSet, metricNames } from './catalog';
import type { Analysis, Fact } from './types';
const string = { type: 'string' };
const schema = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const metrics = { type: 'array', items: { type: 'string', enum: metricNames } };
export const toolSpecs = [
  {
    name: 'inspect_dataset',
    description:
      'Inspect period coverage, missing months, supported metrics and calculation conventions. Call when dates or data sufficiency are uncertain.',
    parameters: schema({}),
  },
  {
    name: 'calculate_metrics',
    description:
      'Retrieve Python-calculated financial facts. Select specific metrics and periods. Request month IDs to investigate a chosen account. When consecutive months are selected, their Python-calculated absolute changes are also returned; cite these for month-over-month comparisons. Missing periods return null, never zero.',
    parameters: schema({ periods: { type: 'array', items: string }, metrics }),
  },
  {
    name: 'compare_periods',
    description:
      'Retrieve Python-calculated changes from one period to another. Monetary changes and percent changes are separate facts; margins change in percentage points.',
    parameters: schema({ from_period: string, to_period: string, metrics }),
  },
  {
    name: 'explain_profit_change',
    description:
      'Get the Python profit bridge: revenue change minus COGS change minus operating expense change. Use it to select an account for further monthly investigation. This is an accounting decomposition, not proof of a business cause.',
    parameters: schema({ from_period: string, to_period: string }),
  },
  {
    name: 'reconcile_cash_flow',
    description:
      'Apple annual pilot: retrieve the Python reconciliation from net income through signed reported adjustments to cash from operations, including the residual. These are accounting contributions.',
    parameters: schema({ period: string }),
  },
  {
    name: 'retrieve_business_evidence',
    description:
      'Retrieve available source passages. In the Apple pilot, this returns a management-attributed iPhone sales explanation. It does not quantify causation. Synthetic datasets have no narrative evidence.',
    parameters: schema({}),
  },
  {
    name: 'submit_analysis',
    description:
      'Finish the investigation with evidence-linked findings. Cite only exact fact IDs returned by tools in this run. State uncertainty. Use clarify for ambiguous requests, limited for incomplete data. Text is not automatically fact-checked.',
    parameters: schema({
      decision: { type: 'string', enum: ['answer', 'limited', 'clarify'] },
      summary: string,
      findings: {
        type: 'array',
        items: schema({
          kind: {
            type: 'string',
            enum: [
              'financial',
              'coverage',
              'attributed',
              'hypothesis',
              'recommendation',
            ],
          },
          text: string,
          evidence_ids: { type: 'array', items: string },
        }),
      },
      limitations: { type: 'array', items: string },
      suggested_questions: { type: 'array', items: string },
    }),
  },
];
function strings(v: unknown, max: number) {
  if (
    !Array.isArray(v) ||
    v.length === 0 ||
    v.length > max ||
    v.some((x) => typeof x !== 'string')
  )
    throw new Error('Expected a nonempty bounded string list');
  return v as string[];
}
export function executeTool(
  datasetId: string,
  name: string,
  args: Record<string, unknown>,
) {
  const d = getDataset(datasetId);
  const spec = toolSpecs.find((t) => t.name === name);
  if (!spec || name === 'submit_analysis')
    throw new Error('Unknown calculation tool');
  const allowed = Object.keys(spec.parameters.properties);
  if (
    Object.keys(args).some((k) => !allowed.includes(k)) ||
    allowed.some((k) => !(k in args))
  )
    throw new Error('Invalid tool arguments');
  if (name === 'inspect_dataset')
    return {
      dataset_id: d.id,
      name: d.name,
      currency: 'USD',
      data_hash: d.sha256,
      periods: Object.entries(d.periods).map(([id, p]) => ({
        id,
        complete: p.complete,
        missing_months: p.missing_months,
      })),
      metrics: [
        ...new Set(
          Object.values(d.periods).flatMap((p) =>
            p.facts.filter((f) => f.unit !== 'passage').map((f) => f.metric),
          ),
        ),
      ],
      source: d.preparation
        ? {
            engine_hash: d.preparation.engine_hash,
            metric_version: d.preparation.metric_version,
            source_url: d.preparation.source_url,
            accession: d.preparation.accession,
            unit_note: d.preparation.unit_note,
          }
        : null,
      facts: [
        {
          id: `${d.id}:dataset:evidence_scope`,
          dataset_id: d.id,
          period: 'dataset',
          metric: 'evidence_scope',
          value: null,
          unit: 'coverage',
          formula: 'Dataset evidence inventory',
          source_row_ids: [],
          reason: d.synthetic
            ? 'Only monthly financial aggregates are available. No customer-acquisition, supplier, price, volume, product-mix or staffing records are included.'
            : 'Curated annual Apple income and cash-flow facts plus a selected management passage. No transaction-level ledger, customer collections or deal-specific working-capital evidence is included.',
        },
        ...Object.entries(d.periods).map(([period, p]) => ({
          id: `${d.id}:${period}:coverage`,
          dataset_id: d.id,
          period,
          metric: 'coverage',
          value: null,
          unit: 'coverage',
          formula: 'source coverage',
          source_row_ids: [],
          reason: p.complete
            ? 'Complete registered period.'
            : 'Missing periods: ' + p.missing_months.join(', '),
        })),
      ],
      conventions: [
        'Costs are positive expense amounts.',
        'Margins use aggregate profits divided by aggregate revenue.',
        'Missing periods and nonpositive ratio denominators return null.',
        'Percentage changes require a positive baseline.',
        d.synthetic
          ? 'Only financial aggregates are available. No customer, supplier, price, volume or staffing evidence exists.'
          : 'Annual facts from a curated Apple filing extract. Source passage attribution is not independent causal proof. Amounts are USD millions.',
      ],
    };
  if (name === 'reconcile_cash_flow') {
    if (d.id !== 'apple-fy2025')
      throw new Error(
        'Cash-flow reconciliation is available in the Apple annual pilot.',
      );
    return getSet(d.bridges, String(args.period));
  }
  if (name === 'retrieve_business_evidence') {
    if (d.id !== 'apple-fy2025')
      return {
        facts: [],
        reason: 'No narrative business evidence in this synthetic dataset.',
      };
    return {
      facts: Object.values(d.periods).flatMap((p) =>
        p.facts.filter((f) => f.unit === 'passage'),
      ),
    };
  }
  if (name === 'calculate_metrics') {
    const periods = strings(args.periods, 9),
      chosen = strings(args.metrics, 16);
    if (
      chosen.some(
        (m) =>
          !Object.values(d.periods).some((p) =>
            p.facts.some((f) => f.metric === m),
          ),
      )
    )
      throw new Error('Unknown metric');
    const levels = periods.flatMap((p) =>
      getSet(d.periods, p).facts.filter((f) => chosen.includes(f.metric)),
    );
    const months = Object.keys(d.periods)
      .filter((p) => /^2025-\d{2}$/.test(p))
      .sort();
    const changes = months
      .slice(1)
      .flatMap((p, i) =>
        periods.includes(p) && periods.includes(months[i])
          ? getSet(d.comparisons, months[i] + '→' + p).facts.filter(
              (f) => chosen.includes(f.metric) && f.id.endsWith(':change'),
            )
          : [],
      );
    return {
      facts: [...levels, ...changes],
      coverage: periods.map((p) => ({
        period: p,
        complete: d.periods[p].complete,
        missing_months: d.periods[p].missing_months,
      })),
    };
  }
  if (
    typeof args.from_period !== 'string' ||
    typeof args.to_period !== 'string'
  )
    throw new Error('Periods must be strings');
  const key = args.from_period + '→' + args.to_period;
  if (name === 'explain_profit_change') return getSet(d.bridges, key);
  const chosen = strings(args.metrics, 16);
  if (
    chosen.some(
      (m) =>
        !Object.values(d.periods).some((p) =>
          p.facts.some((f) => f.metric === m),
        ),
    )
  )
    throw new Error('Unknown metric');
  const s = getSet(d.comparisons, key);
  return { ...s, facts: s.facts.filter((f) => chosen.includes(f.metric)) };
}
export function extractFacts(result: unknown): Fact[] {
  return result &&
    typeof result === 'object' &&
    'facts' in result &&
    Array.isArray(result.facts)
    ? (result.facts as Fact[])
    : [];
}
export function validateAnalysis(
  value: unknown,
  evidence: Map<string, Fact>,
  typed = false,
): Analysis {
  if (!value || typeof value !== 'object')
    throw new Error('Expected structured analysis');
  const a = value as Analysis;
  if (
    !['answer', 'limited', 'clarify'].includes(a.decision) ||
    typeof a.summary !== 'string' ||
    !a.summary.trim() ||
    a.summary.length > 2500
  )
    throw new Error('Invalid decision or summary');
  if (
    !Array.isArray(a.findings) ||
    a.findings.length > 12 ||
    !Array.isArray(a.limitations) ||
    !Array.isArray(a.suggested_questions)
  )
    throw new Error('Invalid analysis lists');
  if (a.decision === 'answer' && !a.findings.length)
    throw new Error('An answer needs evidence-linked findings');
  // Numeric results are rendered from bound facts. Free prose remains subject to semantic review.
  const financialNumber =
    /(?:[$€£]\s*[-+]?\d|[-+]?\d[\d,.]*\s*(?:%|percent|million|billion|thousand|dollars)|\d[\d,]*\.\d+)/i;
  const hasNumericQuantity = (text: string) =>
    /\d/.test(
      text.replace(
        /\b20\d{2}-\d{2}(?:-\d{2})?\b|\b(?:FY)?20\d{2}\b|\bQ[1-4]\b/g,
        '',
      ),
    ) ||
    financialNumber.test(text) ||
    /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|hundred|thousand|million|billion)(?:[ -](?:point|one|two|three|four|five|six|seven|eight|nine|ten|eleven))*\s+(?:percent|bps|basis points|dollars|million|billion)\b/i.test(
      text,
    );
  if (typed && hasNumericQuantity(a.summary))
    throw new Error(
      'Keep the summary qualitative. Financial values are rendered from bound facts.',
    );
  for (const [index, f] of a.findings.entries()) {
    if (
      !f ||
      typeof f.text !== 'string' ||
      !Array.isArray(f.evidence_ids) ||
      f.evidence_ids.some((id) => typeof id !== 'string')
    )
      throw new Error('Malformed finding or evidence list.');
    const unreturned = f.evidence_ids.filter((id) => !evidence.has(id));
    if (unreturned.length)
      throw new Error(
        'Evidence was not returned in this run: ' +
          unreturned.join(', ') +
          '. Retrieve the required metric with calculate_metrics before submitting, or remove the unsupported claim.',
      );
    if (typed) {
      if (
        ![
          'financial',
          'coverage',
          'attributed',
          'hypothesis',
          'recommendation',
        ].includes(f.kind ?? '')
      )
        throw new Error('Every finding needs a claim kind.');
      if (hasNumericQuantity(f.text))
        throw new Error(
          'Use qualitative finding text. The interface renders financial numbers from the cited facts.',
        );
      const bound = (f.evidence_ids ?? []).map((id) => evidence.get(id));
      if (
        f.kind === 'financial' &&
        bound.some(
          (v) =>
            !v || v.value === null || ['coverage', 'passage'].includes(v.unit),
        )
      )
        throw new Error(
          'A financial finding must bind available numeric facts; unavailable comparisons belong in coverage.',
        );
      if (
        f.kind === 'coverage' &&
        bound.some((v) => !v || (v.value !== null && v.unit !== 'coverage'))
      )
        throw new Error(
          'Coverage findings must cite coverage metadata or unavailable facts.',
        );
      if (
        f.kind === 'attributed' &&
        bound.some((v) => !v || v.unit !== 'passage')
      )
        throw new Error(
          'Attributed explanations must cite a retrieved filing passage.',
        );
      if (
        ['hypothesis', 'recommendation'].includes(f.kind!) &&
        f.evidence_ids?.length
      )
        throw new Error(
          'Hypotheses and recommendations are unverified; leave their evidence IDs empty.',
        );
      f.id = 'claim-' + (index + 1);
    }

    if (
      typeof f.text !== 'string' ||
      !f.text.trim() ||
      f.text.length > 3000 ||
      !Array.isArray(f.evidence_ids) ||
      f.evidence_ids.some((id) => typeof id !== 'string' || !evidence.has(id))
    )
      throw new Error('Unknown evidence reference or malformed finding');
    if (
      !f.evidence_ids.length &&
      !(typed && ['hypothesis', 'recommendation'].includes(f.kind!))
    )
      throw new Error(
        'Every finding needs evidence IDs from tools. Put unsupported limitations in limitations.',
      );
  }
  if (
    [...a.limitations, ...a.suggested_questions].some(
      (s) => typeof s !== 'string' || s.length > 1500,
    ) ||
    a.suggested_questions.length > 4 ||
    a.limitations.length > 8
  )
    throw new Error('Invalid analysis text');
  if (
    typed &&
    [...a.limitations, ...a.suggested_questions].some(hasNumericQuantity)
  )
    throw new Error(
      'Keep limitations and suggested questions qualitative; financial values are rendered from bound facts.',
    );
  return a;
}
