// Run after npm run test:agent (which compiles the isolated agent modules).
import { runAgent } from '../.test-build/agent.js';
import { mkdirSync, writeFileSync } from 'node:fs';
const provider =
  process.env.LLM_PROVIDER === 'anthropic' ? 'anthropic' : 'openai';
const key =
  process.env[provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'];
if (!key) {
  console.error(
    'Missing provider key. Run node --env-file=.env.local scripts/pilot.mjs',
  );
  process.exit(1);
}
const model =
  process.env[provider === 'openai' ? 'OPENAI_MODEL' : 'ANTHROPIC_MODEL'] ||
  process.env.LLM_MODEL ||
  (provider === 'openai' ? 'gpt-5.6-luna' : 'claude-sonnet-5');
const question =
  'Why did operating profit change from Q1 to Q2 2025? Identify the largest negative account contribution and investigate its monthly pattern.';
try {
  const run = await runAgent('company-01', question, [], {
    provider,
    model,
    key,
  });
  const folder = `results/pilot-${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}`;
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}/run.json`, JSON.stringify(run, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        folder,
        provider,
        model,
        mode: run.mode,
        analysis: run.analysis,
        tools: run.trace.map((t) => ({ tool: t.tool, arguments: t.arguments })),
        usage: run.usage,
        elapsed_ms: run.elapsed_ms,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Pilot failed');
  process.exitCode = 1;
}
