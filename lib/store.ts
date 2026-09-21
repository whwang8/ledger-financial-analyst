import type { Run, RunEvent, Review } from './types';
import type { RunSink } from './recorder';
import { redact, rehydrateRun } from './recorder';
type Stored = {
  id: string;
  owner: string;
  kind: string;
  parent: string | null;
  created_at: string;
  metadata: string;
  payload_key: string;
};
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(id);
export function ownerFor(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new Error('Cross-origin requests are not allowed.');
  // Production identity comes from Sites dispatch. Never accept client owner IDs.
  const owner = request.headers.get('oai-authenticated-user-id');
  if (owner) return owner;
  if (
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  )
    return 'local-owner';
  throw new Error('Sign in to access saved investigations.');
}
async function bindings() {
  try {
    const { env } = await import('cloudflare:workers');
    const e = env as unknown as { DB?: D1Database; BUCKET?: R2Bucket };
    if (e.DB && e.BUCKET) return e as { DB: D1Database; BUCKET: R2Bucket };
  } catch {
    /* Node development uses a durable local directory. */
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('Investigation storage is unavailable.');
  return null;
}
async function local() {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(process.env.LEDGER_STORAGE_DIR || '.ledger-data');
  await fs.mkdir(root, { recursive: true });
  return { fs, path, root };
}
export function runMetadata(run: Run) {
  return {
    id: run.id,
    dataset_id: run.dataset_id,
    question: run.question,
    created_at: run.created_at,
    state: run.journal?.state ?? 'completed',
    provider: run.provider,
    model: run.model,
    parent_run_id: run.journal?.parent_run_id,
    case_id: run.journal?.case_id,
    mode: run.mode,
  };
}
export async function storage(owner: string) {
  const env = await bindings();
  async function row(id: string): Promise<Stored | null> {
    if (!validId(id)) throw new Error('Invalid record ID.');
    if (env)
      return env.DB.prepare(
        'SELECT * FROM ledger_records WHERE id = ? AND owner = ?',
      )
        .bind(id, owner)
        .first<Stored>();
    const { fs, path, root } = await local();
    try {
      const r = JSON.parse(
        await fs.readFile(path.join(root, id + '.json'), 'utf8'),
      );
      return r.owner === owner ? r : null;
    } catch (e) {
      if ((e as { code?: string }).code === 'ENOENT') return null;
      throw e;
    }
  }
  async function read<T>(id: string): Promise<T | null> {
    const r = await row(id);
    if (!r) return null;
    if (env) {
      const obj = await env.BUCKET.get(r.payload_key);
      if (!obj) throw new Error('Saved evidence is temporarily unavailable.');
      return obj.json<T>();
    }
    const { fs, path, root } = await local();
    return JSON.parse(
      await fs.readFile(path.join(root, r.payload_key), 'utf8'),
    ) as T;
  }
  async function put(
    id: string,
    kind: string,
    parent: string | null,
    payload: unknown,
    metadata: unknown,
    replace = false,
  ) {
    if (!validId(id)) throw new Error('Invalid record ID.');
    const created_at = new Date().toISOString(),
      payload_key = id + '-' + crypto.randomUUID() + '.payload.json';
    const body = JSON.stringify(redact(payload));
    const r: Stored = {
      id,
      owner,
      kind,
      parent,
      created_at,
      metadata: JSON.stringify(redact(metadata)),
      payload_key,
    };
    if (env) {
      await env.BUCKET.put(payload_key, body, {
        httpMetadata: { contentType: 'application/json' },
      });
      if (replace) {
        const result = await env.DB.prepare(
          'UPDATE ledger_records SET metadata = ?, payload_key = ? WHERE id = ? AND owner = ?',
        )
          .bind(r.metadata, payload_key, id, owner)
          .run();
        if (!result.meta.changes)
          throw new Error('Saved record was not found.');
      } else
        await env.DB.prepare(
          'INSERT INTO ledger_records (id,owner,kind,parent,created_at,metadata,payload_key) VALUES (?,?,?,?,?,?,?)',
        )
          .bind(id, owner, kind, parent, created_at, r.metadata, payload_key)
          .run();
      return;
    }
    const { fs, path, root } = await local();
    await fs.writeFile(path.join(root, payload_key), body, { flag: 'wx' });
    if (replace) {
      const existing = await row(id);
      if (!existing) throw new Error('Saved record was not found.');
      const temp = path.join(root, id + '.' + crypto.randomUUID() + '.tmp');
      await fs.writeFile(
        temp,
        JSON.stringify({ ...r, created_at: existing.created_at }),
      );
      await fs.rename(temp, path.join(root, id + '.json'));
    } else
      await fs.writeFile(path.join(root, id + '.json'), JSON.stringify(r), {
        flag: 'wx',
      });
  }
  async function list(kind: string, parent?: string): Promise<Stored[]> {
    if (env) {
      const q = parent
        ? env.DB.prepare(
            'SELECT * FROM ledger_records WHERE owner = ? AND kind = ? AND parent = ? ORDER BY created_at DESC LIMIT 500',
          ).bind(owner, kind, parent)
        : env.DB.prepare(
            'SELECT * FROM ledger_records WHERE owner = ? AND kind = ? ORDER BY created_at DESC LIMIT 500',
          ).bind(owner, kind);
      return (await q.all<Stored>()).results;
    }
    const { fs, path, root } = await local();
    const rows: Stored[] = [];
    for (const name of await fs.readdir(root)) {
      if (!name.endsWith('.json') || name.endsWith('.payload.json')) continue;
      const r = JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
      if (
        r.owner === owner &&
        r.kind === kind &&
        (!parent || r.parent === parent)
      )
        rows.push(r);
    }
    return rows
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 500);
  }
  async function run(id: string) {
    const r = await row(id);
    if (!r || r.kind !== 'run') return null;
    const value = (await read<Run>(id))!;
    if (value.journal) {
      const events = await list('event', id);
      value.journal.events = (
        await Promise.all(events.map((e) => read<RunEvent>(e.id)))
      )
        .filter((e): e is RunEvent => !!e)
        .sort((a, b) => a.seq - b.seq);
    }
    return rehydrateRun(value, value.journal?.events ?? []);
  }
  const sink: RunSink = {
    create: async (r) => put(r.id, 'run', null, r, runMetadata(r)),
    event: async (e) =>
      put(e.id, 'event', e.run_id, e, { seq: e.seq, kind: e.kind }),
    finish: async (r) =>
      put(
        r.id,
        'run',
        null,
        { ...r, journal: r.journal ? { ...r.journal, events: [] } : undefined },
        runMetadata(r),
        true,
      ),
  };
  return {
    read,
    put,
    list,
    run,
    sink,
    reviews: async (id: string) => {
      const rs = await list('review', id);
      return (await Promise.all(rs.map((r) => read<Review>(r.id)))).filter(
        (r): r is Review => !!r,
      );
    },
  };
}
