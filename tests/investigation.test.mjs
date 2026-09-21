import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../.test-build/agent.js';
import { validateAnalysis, executeTool } from '../.test-build/tools.js';
import { buildReport, comparable } from '../.test-build/reports.js';
const config = {
  provider: 'openai',
  model: 'test',
  key: 'sk-private-test-never-log-this',
};
const call = (name, args, id = 'a') => ({
  type: 'function_call',
  name,
  arguments: JSON.stringify(args),
  call_id: id,
});
const response = (
  output,
  usage = { input_tokens: 12, output_tokens: 10 },
  rest = {},
) =>
  new Response(JSON.stringify({ output, usage, status: 'completed', ...rest }));
const result = {
  decision: 'answer',
  summary: 'Operating profit is positive.',
  findings: [
    {
      kind: 'financial',
      text: 'Operating profit is positive in the selected quarter.',
      evidence_ids: ['company-05:2025-Q2:operating_profit'],
    },
  ],
  limitations: [],
  suggested_questions: [],
};
const args = { periods: ['2025-Q2'], metrics: ['operating_profit'] };
function memory() {
  const events = [];
  let saved;
  return {
    events,
    get saved() {
      return saved;
    },
    sink: {
      create: async (r) => {
        saved = structuredClone(r);
      },
      event: async (e) => events.push(structuredClone(e)),
      finish: async (r) => {
        saved = structuredClone(r);
      },
    },
  };
}
test('partial transport failure preserves immutable request, tool facts and known usage', async () => {
  const m = memory();
  let n = 0;
  await assert.rejects(
    runAgent(
      'company-05',
      'Profit?',
      [],
      config,
      async () => {
        if (n++) throw new Error('network');
        return response([call('calculate_metrics', args)]);
      },
      { sink: m.sink },
    ),
    (e) => e.run.journal.state === 'failed',
  );
  assert.equal(m.saved.id, m.events[0].run_id);
  assert.equal(m.saved.facts[0].value, 19000);
  assert.equal(m.saved.usage.input_tokens, 12);
  assert.equal(m.saved.journal.usage_complete, false);
  assert.equal(
    m.events.filter((e) => e.kind === 'model.requested')[0].payload.input
      .length,
    1,
  );
  assert.ok(m.events.some((e) => e.kind === 'model.failed'));
});
test('both rejected submissions and terminal failure survive', async () => {
  const m = memory();
  await assert.rejects(
    runAgent(
      'company-05',
      'Profit?',
      [],
      config,
      async () => response([call('submit_analysis', result)]),
      { sink: m.sink },
    ),
  );
  assert.equal(
    m.events.filter((e) => e.kind === 'validation.failed').length,
    2,
  );
  assert.equal(m.events.filter((e) => e.kind === 'tool.failed').length, 2);
  assert.equal(m.saved.trace.length, 2);
});
test('incomplete response is recorded before failure', async () => {
  const m = memory();
  await assert.rejects(
    runAgent(
      'company-05',
      'Profit?',
      [],
      config,
      async () =>
        response(
          [call('calculate_metrics', args)],
          { input_tokens: 4, output_tokens: 1 },
          { status: 'incomplete' },
        ),
      { sink: m.sink },
    ),
  );
  assert.equal(m.events.filter((e) => e.kind === 'model.responded').length, 1);
  assert.equal(m.events.filter((e) => e.kind === 'tool.requested').length, 0);
  assert.equal(m.saved.usage.input_tokens, 4);
});
test('opaque continuation reaches provider but not saved evidence; missing usage remains unknown', async () => {
  let n = 0;
  const requests = [];
  const r = await runAgent(
    'company-05',
    'Profit?',
    [],
    config,
    async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return n++
        ? response([call('submit_analysis', result)], null)
        : response([
            { type: 'reasoning', encrypted_content: 'opaque-secret' },
            call('calculate_metrics', args),
          ]);
    },
  );
  assert.equal(
    requests[1].input.find((x) => x.type === 'reasoning').encrypted_content,
    'opaque-secret',
  );
  assert.ok(!JSON.stringify(r).includes('opaque-secret'));
  assert.ok(!JSON.stringify(r).includes(config.key));
  assert.equal(r.journal.usage_complete, false);
  assert.equal(r.usage.input_tokens, 12);
});
test('null growth cannot bind a financial claim, including numeric summary', () => {
  const r = executeTool('company-06', 'compare_periods', {
    from_period: '2025-Q1',
    to_period: '2025-Q2',
    metrics: ['operating_profit'],
  });
  const map = new Map(r.facts.map((f) => [f.id, f]));
  const id = r.facts[1].id;
  assert.throws(
    () =>
      validateAnalysis(
        {
          ...result,
          findings: [
            { kind: 'financial', text: 'Profit improved.', evidence_ids: [id] },
          ],
        },
        map,
        true,
      ),
    /available/,
  );
  assert.throws(
    () =>
      validateAnalysis(
        {
          ...result,
          decision: 'limited',
          summary: 'Profit improved 11.11%.',
          findings: [
            {
              kind: 'coverage',
              text: 'Incomplete quarter.',
              evidence_ids: [id],
            },
          ],
        },
        map,
        true,
      ),
    /summary|qualitative/,
  );
  assert.equal(
    validateAnalysis(
      {
        ...result,
        decision: 'limited',
        summary: 'A quarterly comparison is unavailable.',
        findings: [
          {
            kind: 'coverage',
            text: 'The quarter is incomplete.',
            evidence_ids: [id],
          },
        ],
      },
      map,
      true,
    ).decision,
    'limited',
  );
});
test('coverage and advice cannot inherit an unrelated numeric citation', () => {
  const r = executeTool('company-05', 'calculate_metrics', args);
  const map = new Map(r.facts.map((f) => [f.id, f]));
  assert.throws(() =>
    validateAnalysis(
      {
        ...result,
        findings: [
          {
            kind: 'recommendation',
            text: 'Renegotiate supplier terms.',
            evidence_ids: [r.facts[0].id],
          },
        ],
      },
      map,
      true,
    ),
  );
  assert.throws(() =>
    validateAnalysis(
      {
        ...result,
        findings: [
          {
            kind: 'coverage',
            text: 'Complete quarter.',
            evidence_ids: [r.facts[0].id],
          },
        ],
      },
      map,
      true,
    ),
  );
});
const run = (id, state = 'completed', parent) => ({
  id,
  dataset_id: 'company-01',
  dataset_hash: 'hash',
  question: 'Task?',
  created_at: '2026-01-01T00:00:0' + id + 'Z',
  mode: 'live',
  provider: 'test',
  model: 'test',
  usage: { input_tokens: 10, output_tokens: 5 },
  elapsed_ms: 100,
  analysis: {
    summary: 'Answer',
    findings: [],
    limitations: [],
    suggested_questions: [],
  },
  journal: {
    state,
    parent_run_id: parent,
    history: [],
    provider_requests: 2,
    usage_complete: true,
    configuration: { version: 'v2' },
  },
});
const review = (id, run_id, verdict, scope = 'run', supersedes) => ({
  id,
  run_id,
  verdict,
  scope,
  role: 'author',
  reviewer: 'William',
  rubric: 'v2',
  supersedes,
});
test('report completion, pending review and retries remain separate', () => {
  const runs = [
    run('1', 'failed'),
    run('2', 'completed', '1'),
    { ...run('3'), question: 'Other?' },
  ];
  const r = buildReport(runs, [review('r', '2', 'pass')]);
  assert.equal(r.counts.attempts, 3);
  assert.equal(r.counts.completed, 2);
  assert.equal(r.counts.unique_tasks, 2);
  assert.equal(r.counts.earliest_selected_reviewed_passes, 0);
  assert.equal(r.counts.eventual_unique_passes, 1);
  assert.equal(r.counts.pending_review, 2);
  assert.equal(r.counts.independent_reviewed, 0);
});
test('claim reviews do not grade runs; superseded reviews do not double count', () => {
  const r = buildReport(
    [run('1')],
    [
      review('old', '1', 'fail'),
      review('new', '1', 'pass', 'run', 'old'),
      review('claim', '1', 'fail', 'claim'),
    ],
  );
  assert.equal(r.counts.reviewed_passes, 1);
  assert.equal(r.counts.reviewed_failures, 0);
  const q = buildReport([run('1')], [review('claim', '1', 'pass', 'claim')]);
  assert.equal(q.counts.pending_review, 1);
});
test('pairing rejects source and history changes, and missing usage stays incomplete', () => {
  assert.equal(
    comparable(run('1'), { ...run('2'), dataset_hash: 'new' }),
    false,
  );
  assert.equal(
    comparable(run('1'), {
      ...run('2'),
      journal: {
        ...run('2').journal,
        history: [{ role: 'user', content: 'different' }],
      },
    }),
    false,
  );
  const r = buildReport(
    [{ ...run('1'), journal: { ...run('1').journal, usage_complete: false } }],
    [],
  );
  assert.equal(r.counts.usage_complete, false);
});
import { rehydrateRun } from '../.test-build/recorder.js';
test('interrupted snapshot recovers usage, tools, facts and unknown outcome', async () => {
  const m = memory();
  let first;
  let n = 0;
  await runAgent(
    'company-05',
    'Profit?',
    [],
    config,
    async () =>
      n++
        ? response([call('submit_analysis', result)])
        : response([call('calculate_metrics', args)]),
    {
      sink: {
        ...m.sink,
        create: async (r) => {
          first = structuredClone(r);
        },
      },
    },
  );
  const partial = m.events.filter((e) => e.seq <= 4);
  const restored = rehydrateRun(
    first,
    partial,
    Date.parse(first.created_at) + 150000,
  );
  assert.equal(restored.journal.state, 'interrupted');
  assert.equal(restored.journal.provider_requests, 1);
  assert.equal(restored.usage.input_tokens, 12);
  assert.equal(restored.journal.usage_complete, false);
  const completed = rehydrateRun(first, m.events);
  assert.equal(completed.journal.state, 'completed');
  assert.equal(completed.facts[0].value, 19000);
  assert.equal(completed.analysis.findings.length, 1);
});
test('failed execution cannot increase task pass count', () => {
  const r = buildReport([run('1', 'failed')], [review('r', '1', 'pass')]);
  assert.equal(r.counts.completed, 0);
  assert.equal(r.counts.reviewed_passes, 0);
  assert.equal(r.counts.eventual_unique_passes, 0);
});
test('limitations cannot endorse a financial percentage outside the claim field', () => {
  const r = executeTool('company-06', 'compare_periods', {
    from_period: '2025-Q1',
    to_period: '2025-Q2',
    metrics: ['operating_profit'],
  });
  assert.throws(
    () =>
      validateAnalysis(
        {
          decision: 'limited',
          summary: 'Quarterly comparison unavailable.',
          findings: [
            {
              kind: 'coverage',
              text: 'Missing period.',
              evidence_ids: [r.facts[0].id],
            },
          ],
          limitations: ['Profit improved 11.11%.'],
          suggested_questions: [],
        },
        new Map(r.facts.map((f) => [f.id, f])),
        true,
      ),
    /limitations|qualitative/,
  );
});

test('dataset evidence scope is distinct from period coverage and can support a coverage finding', () => {
  const r = executeTool('company-05', 'inspect_dataset', {});
  const scope = r.facts.find((f) => f.metric === 'evidence_scope');
  assert.match(scope.reason, /supplier/);
  assert.equal(scope.period, 'dataset');
  assert.ok(
    r.facts
      .find((f) => f.id === 'company-05:2025-Q2:coverage')
      .reason.includes('Complete'),
  );
  const finding = {
    kind: 'coverage',
    text: 'Supplier price records are absent.',
    evidence_ids: [scope.id],
  };
  assert.equal(
    validateAnalysis(
      { ...result, findings: [finding] },
      new Map(r.facts.map((f) => [f.id, f])),
      true,
    ).findings.length,
    1,
  );
});
test('unreturned evidence gives an actionable repair before checking claim type', () => {
  assert.throws(
    () => validateAnalysis(result, new Map(), true),
    /Evidence was not returned.*company-05:2025-Q2:operating_profit/,
  );
});
