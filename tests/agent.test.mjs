import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeTool, validateAnalysis } from '../.test-build/tools.js';
import { runAgent } from '../.test-build/agent.js';
import { calculationPreview } from '../.test-build/preview.js';
const config = {
  provider: 'openai',
  model: 'test-model',
  key: 'not-a-real-key',
};
const factId = 'company-05:2025-Q2:operating_profit';
const final = {
  decision: 'answer',
  summary: 'Profit was positive.',
  findings: [
    { kind:'financial', text: 'Operating profit is positive in the selected quarter.', evidence_ids: [factId] },
  ],
  limitations: [],
  suggested_questions: [],
};
function response(output) {
  return new Response(
    JSON.stringify({
      output,
      status: 'completed',
      usage: { input_tokens: 12, output_tokens: 10 },
    }),
    { status: 200 },
  );
}
const call = (name, args, id = 'one') => ({
  type: 'function_call',
  name,
  arguments: JSON.stringify(args),
  call_id: id,
});
test('tools return independently known Q2 profit', () => {
  const r = executeTool('company-05', 'calculate_metrics', {
    periods: ['2025-Q2'],
    metrics: ['operating_profit'],
  });
  assert.equal(r.facts[0].value, 19000);
});
test('profit bridge has correct cost signs', () => {
  assert.deepEqual(
    executeTool('company-05', 'explain_profit_change', {
      from_period: '2025-Q1',
      to_period: '2025-Q2',
    }).facts.map((f) => f.value),
    [30000, -73500, -35000, -78500],
  );
});
test('missing quarter produces null facts, never observed totals', () => {
  const r = executeTool('company-06', 'calculate_metrics', {
    periods: ['2025-Q2'],
    metrics: ['operating_profit'],
  });
  assert.equal(r.facts[0].value, null);
  assert.deepEqual(r.coverage[0].missing_months, ['2025-05']);
});
test('unregistered period and unsupported metric rejected', () => {
  assert.throws(() =>
    executeTool('company-01', 'calculate_metrics', {
      periods: ['2026-Q4'],
      metrics: ['revenue'],
    }),
  );
  assert.throws(() =>
    executeTool('company-01', 'calculate_metrics', {
      periods: ['2025-Q2'],
      metrics: ['cash'],
    }),
  );
});
test('unknown tool and extra argument rejected', () => {
  assert.throws(() =>
    executeTool('company-01', 'run_python', { code: 'print(1)' }),
  );
  assert.throws(() =>
    executeTool('company-01', 'inspect_dataset', { injected: true }),
  );
});
test('fabricated evidence reference rejected', () => {
  assert.throws(() => validateAnalysis(final, new Map()));
});
test('claim without evidence rejected', () => {
  assert.throws(() =>
    validateAnalysis(
      { ...final, findings: [{ text: 'Fact.', evidence_ids: [] }] },
      new Map(),
    ),
  );
});
test('clarification may have no findings', () => {
  assert.equal(
    validateAnalysis({ ...final, decision: 'clarify', findings: [] }, new Map())
      .decision,
    'clarify',
  );
});
test('preview never mislabels deterministic output as model output', () => {
  const p = calculationPreview('company-05');
  assert.equal(p.mode, 'calculation_preview');
  assert.equal(p.model, 'none');
  assert.equal(p.usage.input_tokens, 0);
  assert.equal(p.trace.length, 3);
});
test('OpenAI loop preserves all output and feeds matching call IDs', async () => {
  let n = 0;
  const requests = [];
  const fake = async (url, init) => {
    const b = JSON.parse(init.body);
    requests.push(b);
    n++;
    return n === 1
      ? response([
          {
            type: 'reasoning',
            id: 'reasoning-1',
            encrypted_content: 'test-encrypted',
          },
          call('calculate_metrics', {
            periods: ['2025-Q2'],
            metrics: ['operating_profit'],
          }),
        ])
      : response([call('submit_analysis', final, 'finish')]);
  };
  const r = await runAgent(
    'company-05',
    'What is Q2 profit?',
    [],
    config,
    fake,
  );
  assert.equal(r.mode, 'live');
  assert.equal(r.facts[0].value, 19000);
  assert.equal(
    requests[1].input.find((x) => x.type === 'function_call_output').call_id,
    'one',
  );
  assert.ok(requests[1].input.find((x) => x.type === 'reasoning'));
  assert.equal(requests[0].store, false);
  assert.equal(r.usage.input_tokens, 24);
});
test('Anthropic loop preserves assistant blocks and groups tool results', async () => {
  let n = 0;
  const requests = [];
  const fake = async (url, init) => {
    requests.push(JSON.parse(init.body));
    n++;
    return new Response(
      JSON.stringify({
        content:
          n === 1
            ? [
                { type: 'text', text: 'Checking.' },
                {
                  type: 'tool_use',
                  id: 'a1',
                  name: 'calculate_metrics',
                  input: {
                    periods: ['2025-Q2'],
                    metrics: ['operating_profit'],
                  },
                },
              ]
            : [
                {
                  type: 'tool_use',
                  id: 'a2',
                  name: 'submit_analysis',
                  input: final,
                },
              ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 3, output_tokens: 4 },
      }),
    );
  };
  const r = await runAgent(
    'company-05',
    'Profit?',
    [],
    { ...config, provider: 'anthropic' },
    fake,
  );
  assert.equal(r.analysis.summary, final.summary);
  assert.equal(requests[1].messages[1].role, 'assistant');
  assert.equal(requests[1].messages[1].content[0].type, 'text');
  assert.equal(requests[1].messages[2].content[0].tool_use_id, 'a1');
});
test('truncated provider output cannot become an answer', async () => {
  await assert.rejects(
    runAgent(
      'company-05',
      'Profit?',
      [],
      config,
      async () =>
        new Response(JSON.stringify({ status: 'incomplete', output: [] })),
    ),
    /incomplete/,
  );
});
test('provider auth error is sanitized', async () => {
  await assert.rejects(
    runAgent(
      'company-05',
      'Profit?',
      [],
      config,
      async () => new Response('private response details', { status: 401 }),
    ),
    (e) =>
      e.message.includes('API key') && !e.message.includes('private response'),
  );
});
test('looping provider terminates with bounded requests', async () => {
  let calls = 0;
  await assert.rejects(
    runAgent('company-05', 'Profit?', [], config, async () => {
      calls++;
      return response([call('inspect_dataset', {}, String(calls))]);
    }),
    /limit/,
  );
  assert.ok(calls <= 10);
});
test('invalid final answer gets only one repair attempt', async () => {
  let calls = 0;
  await assert.rejects(
    runAgent('company-05', 'Profit?', [], config, async () => {
      calls++;
      return response([call('submit_analysis', final)]);
    }),
    /validation/,
  );
  assert.equal(calls, 2);
});
import { readBoundedJson, consumeRateLimit } from '../.test-build/http.js';
test('HTTP reader bounds UTF-8 bytes, not just characters', async () => {
  await assert.rejects(
    readBoundedJson(
      new Request('https://test', {
        method: 'POST',
        body: JSON.stringify({ a: 'é'.repeat(20) }),
      }),
      30,
    ),
    /large/,
  );
});
test('HTTP reader accepts a bounded JSON body', async () => {
  assert.deepEqual(
    await readBoundedJson(
      new Request('https://test', { method: 'POST', body: '{"x":1}' }),
    ),
    { x: 1 },
  );
});
test('rate limiter preserves active callers at capacity', () => {
  const map = new Map();
  for (let i = 0; i < 1000; i++) map.set(String(i), [100]);
  map.set('0', [100, 100, 100, 100, 100, 100]);
  assert.equal(consumeRateLimit(map, 'new', 200), false);
  assert.equal(consumeRateLimit(map, '0', 200), false);
  assert.equal(consumeRateLimit(map, 'new', 61001), true);
});
test('monthly investigations include Python changes for correct ranking', () => {
  const r = executeTool('company-01', 'calculate_metrics', {
    periods: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'],
    metrics: ['cogs'],
  });
  assert.equal(
    r.facts.find((f) => f.id === 'company-01:2025-03→2025-04:cogs:change')
      .value,
    15000,
  );
  assert.equal(
    r.facts.find((f) => f.id === 'company-01:2025-05→2025-06:cogs:change')
      .value,
    13000,
  );
});
