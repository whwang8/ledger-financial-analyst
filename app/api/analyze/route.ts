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
    const body = await readBoundedJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error('Invalid request.');
    const b = body as Record<string, unknown>;
    if (typeof b.dataset_id !== 'string') throw new Error('Select a dataset.');
    getDataset(b.dataset_id);
    if (b.mode === 'calculation_preview')
      return Response.json(calculationPreview(b.dataset_id));
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
    const config = agentConfig(b.provider as Provider);
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
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
    );
    return Response.json(run, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Analysis failed.';
    return Response.json(
      {
        error:
          error.includes('fetch failed') || error.includes('abort')
            ? 'The provider connection timed out. Please try again.'
            : error,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
