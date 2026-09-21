import { SYSTEM_PROMPT } from '../.test-build/agent.js';
import { toolSpecs } from '../.test-build/tools.js';
import { writeFileSync } from 'node:fs';
writeFileSync(
  'evals/protocol.json',
  JSON.stringify(
    {
      version: 'ledger-v0.2',
      system_prompt: SYSTEM_PROMPT,
      tools: toolSpecs,
      max_calculation_tools: 8,
      max_model_rounds: 10,
      deadline_ms: 90000,
    },
    null,
    2,
  ) + '\n',
);
