import { ownerFor, storage } from '@/lib/store';
import { AgentFailure } from '@/lib/recorder';
import { builtInRun } from '@/lib/historical';
import { runAgent, type History, type Provider } from '@/lib/agent';
import { agentConfig } from '@/lib/config';
import { getDataset } from '@/lib/catalog';
import { calculationPreview } from '@/lib/preview';
import { readBoundedJson, consumeRateLimit } from '@/lib/http';
const requests = new Map<string, number[]>();
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return Response.json(
        { error: 'Cross-origin requests are not allowed.' },
        { status: 403 },
      );
    const owner = ownerFor(request);
    const store = await storage(owner);
    const body = await readBoundedJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error('Invalid request.');
    const b = body as Record<string, unknown>;
    if (typeof b.dataset_id !== 'string') throw new Error('Select a dataset.');
    const selectedDataset = getDataset(b.dataset_id);
    if (
      typeof b.dataset_hash === 'string' &&
      b.dataset_hash !== selectedDataset.sha256
    )
      throw new Error(
        'Source snapshot changed. Start a new evaluation with the current dataset.',
      );
    if (b.mode === 'calculation_preview') {
      const preview = calculationPreview(b.dataset_id);
      await store.sink.create(preview);
      return Response.json(preview);
    }
    if (
      typeof b.question !== 'string' ||
      !b.question.trim() ||
      b.question.length > 3000
    )
      throw new Error('Use a question of 1–3,000 characters.');
    if (!['openai', 'anthropic'].includes(String(b.provider)))
      throw new Error('Select OpenAI or Anthropic.');
    const history = (b.history ?? []) as History;
    if (
      !Array.isArray(history) ||
      history.length > 8 ||
      history.some(
        (x) =>
          !x ||
          !['user', 'assistant'].includes(x.role) ||
          typeof x.content !== 'string' ||
          x.content.length > 3000,
      )
    )
      throw new Error('Invalid conversation history.');
    if (
      b.run_id !== undefined &&
      (typeof b.run_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.run_id))
    )
      throw new Error('Invalid attempt ID.');
    if (typeof b.run_id === 'string') {
      const previous = await store.run(b.run_id);
      if (previous) {
        if (
          previous.dataset_id !== b.dataset_id ||
          previous.question !== b.question.trim() ||
          previous.provider !== b.provider ||
          JSON.stringify(previous.journal?.history ?? []) !==
            JSON.stringify(history)
        )
          throw new Error(
            'This attempt ID belongs to another request. Start a new attempt.',
          );
        return Response.json(previous, {
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }
    if (
      b.instruction !== undefined &&
      (typeof b.instruction !== 'string' || b.instruction.length > 1500)
    )
      throw new Error('Use a reviewer instruction under 1,500 characters.');
    if (
      b.metric_policy !== undefined &&
      (typeof b.metric_policy !== 'string' ||
        !['core', 'include_cost_ratio'].includes(b.metric_policy))
    )
      throw new Error('Invalid metric selection.');
    if (b.metric_policy === 'include_cost_ratio' && b.metric_reviewed !== true)
      throw new Error('Review the metric definition before enabling it.');
    let parent;
    if (typeof b.parent_run_id === 'string') {
      parent =
        builtInRun(b.parent_run_id) ?? (await store.run(b.parent_run_id));
      if (
        !parent ||
        parent.dataset_hash !== selectedDataset.sha256 ||
        parent.dataset_id !== b.dataset_id ||
        parent.question !== b.question.trim() ||
        JSON.stringify(parent.journal?.history ?? []) !==
          JSON.stringify(history)
      )
        throw new Error(
          'Reruns must preserve the original question, dataset and conversation.',
        );
    }
    const config = agentConfig(b.provider as Provider);
    const ip = owner;
    if (!consumeRateLimit(requests, ip))
      return Response.json(
        { error: 'Please wait a minute before starting another analysis.' },
        { status: 429 },
      );
    const run = await runAgent(
      b.dataset_id,
      b.question.trim(),
      history,
      config,
      fetch,
      {
        id: b.run_id as string | undefined,
        sink: store.sink,
        parent_run_id: parent?.id,
        instruction: b.instruction as string | undefined,
        metric_policy: b.metric_policy as string | undefined,
        case_id:
          typeof b.case_id === 'string'
            ? b.case_id.slice(0, 100)
            : parent?.journal?.case_id,
        evaluation_id:
          typeof b.evaluation_id === 'string'
            ? b.evaluation_id.slice(0, 100)
            : undefined,
        attempt_id:
          typeof b.attempt_id === 'string'
            ? b.attempt_id.slice(0, 100)
            : undefined,
      },
    );
    return Response.json(run, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Analysis failed.';
    return Response.json(
      {
        ...(e instanceof AgentFailure ? { run_id: e.run.id, run: e.run } : {}),
        error:
          error.includes('fetch failed') || error.includes('abort')
            ? 'The provider connection timed out. Please try again.'
            : error,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
