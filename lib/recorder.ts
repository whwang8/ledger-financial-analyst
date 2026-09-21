import type { Run, RunEvent } from './types';
export const IMPLEMENTATION_VERSION = 'ledger-investigation-2.0';
export async function hash(value: unknown) {
  const bytes = new TextEncoder().encode(
    typeof value === 'string' ? value : JSON.stringify(value),
  );
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
/** Persist application-visible data, never authorization or opaque continuation bytes. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /^(authorization|x-api-key|api_key|key|encrypted_content|signature)$/i.test(
          k,
        )
          ? '[omitted]'
          : redact(v),
      ]),
    );
  return typeof value === 'string'
    ? value.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[credential omitted]')
    : value;
}
export type RunSink = {
  create(run: Run): Promise<void>;
  event(event: RunEvent): Promise<void>;
  finish(run: Run): Promise<void>;
};
export class AgentFailure extends Error {
  constructor(
    message: string,
    public run: Run,
  ) {
    super(message);
    this.name = 'AgentFailure';
  }
}
export function recorder(run: Run, sink?: RunSink) {
  return async (
    kind: string,
    payload: unknown,
    call_id?: string,
    parent_id?: string,
  ) => {
    const e: RunEvent = {
      id: crypto.randomUUID(),
      run_id: run.id,
      seq: run.journal!.events.length + 1,
      at: new Date().toISOString(),
      kind,
      payload: redact(structuredClone(payload)),
      ...(call_id ? { call_id } : {}),
      ...(parent_id ? { parent_id } : {}),
    };
    await sink?.event(e);
    run.journal!.events.push(e);
    return e.id;
  };
}
/** Rebuild progress from the append-only journal, including after process interruption. */
export function rehydrateRun(
  snapshot: Run,
  events: RunEvent[],
  now = Date.now(),
): Run {
  const run = structuredClone(snapshot);
  if (!run.journal) return run;
  run.journal.events = [...events].sort((a, b) => a.seq - b.seq);
  run.journal.provider_requests = events.filter(
    (e) => e.kind === 'model.requested',
  ).length;
  const responses = events.filter((e) => e.kind === 'model.responded');
  run.usage = { input_tokens: 0, output_tokens: 0 };
  run.journal.usage_complete =
    responses.length === run.journal.provider_requests;
  for (const e of responses) {
    const u = (
      e.payload as { usage?: { input_tokens?: number; output_tokens?: number } }
    )?.usage;
    if (
      typeof u?.input_tokens !== 'number' ||
      typeof u?.output_tokens !== 'number'
    )
      run.journal.usage_complete = false;
    run.usage.input_tokens += u?.input_tokens ?? 0;
    run.usage.output_tokens += u?.output_tokens ?? 0;
  }
  const facts = new Map<string, Run['facts'][number]>();
  run.trace = [];
  for (const e of run.journal.events) {
    if (!['tool.completed', 'tool.failed'].includes(e.kind)) continue;
    const p = e.payload as {
      name: string;
      arguments: Record<string, unknown>;
      result: { facts?: Run['facts']; accepted?: boolean };
      elapsed_ms: number;
    };
    run.trace.push({
      step: run.trace.length + 1,
      tool: p.name,
      arguments: p.arguments,
      result: p.result,
      elapsed_ms: p.elapsed_ms,
    });
    if (e.kind === 'tool.completed' && Array.isArray(p.result?.facts))
      for (const f of p.result.facts) facts.set(f.id, f);
    if (p.name === 'submit_analysis' && p.result?.accepted) {
      run.analysis = p.arguments as Run['analysis'];
      run.validation.references_valid = true;
    }
  }
  run.facts = [...facts.values()];
  const terminal = [...run.journal.events]
    .reverse()
    .find((e) => ['run.completed', 'run.failed'].includes(e.kind));
  if (terminal) {
    run.journal.state =
      terminal.kind === 'run.completed' ? 'completed' : 'failed';
    run.journal.finished_at = terminal.at;
    run.elapsed_ms = Math.max(
      0,
      Date.parse(terminal.at) - Date.parse(run.created_at),
    );
    if (terminal.kind === 'run.failed') {
      run.journal.error = (terminal.payload as { error: string }).error;
      run.analysis = {
        decision: 'limited',
        summary: 'This investigation did not finish.',
        findings: [],
        limitations: [run.journal.error],
        suggested_questions: [],
      };
    }
  } else if (now - Date.parse(run.created_at) > 120000) {
    run.journal.state = 'interrupted';
    run.journal.error =
      'No terminal event was saved. The request outcome is unknown; review the partial evidence before starting another attempt.';
    run.journal.usage_complete = false;
  }
  return run;
}
