/** Bound the bytes read before parsing; do not allocate an unbounded body. */
export async function readBoundedJson(
  request: Request,
  limit = 24000,
): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit)
    throw new Error('Request too large.');
  if (!request.body) throw new Error('Request body is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error('Request too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
}
export function consumeRateLimit(
  map: Map<string, number[]>,
  key: string,
  now = Date.now(),
): boolean {
  for (const [id, times] of map) {
    const live = times.filter((t) => now - t < 60000);
    if (live.length) map.set(id, live);
    else map.delete(id);
  }
  const times = map.get(key) ?? [];
  if (times.length >= 6 || (!map.has(key) && map.size >= 1000)) return false;
  map.set(key, [...times, now]);
  return true;
}
