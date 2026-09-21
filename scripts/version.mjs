import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== 'generated') await walk(path);
    } else if (/\.(ts|tsx|py|json)$/.test(entry.name)) files.push(path);
  }
}
for (const dir of [
  'app',
  'lib',
  'python/financial_analyst',
  'db',
  'data/metrics',
])
  await walk(dir);
files.push(
  'components/investigations.tsx',
  'components/ledger.tsx',
  'package-lock.json',
);
const digest = createHash('sha256');
for (const path of files.sort()) {
  digest.update(path + '\0');
  digest.update(await readFile(path));
}
await writeFile(
  'lib/generated/build-info.json',
  JSON.stringify(
    {
      source_hash: digest.digest('hex'),
      scope:
        'Application, tool, storage, reporting and Python source; package lock and registered metric definitions. Generated files excluded.',
    },
    null,
    2,
  ) + '\n',
);
