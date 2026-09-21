import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
mkdirSync('.test-build', { recursive: true });
writeFileSync('.test-build/package.json', '{"type":"commonjs"}\n');
execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--target',
    'ES2022',
    '--outDir',
    '.test-build',
    '--esModuleInterop',
    '--resolveJsonModule',
    '--skipLibCheck',
    'lib/agent.ts',
    'lib/http.ts',
    'lib/tools.ts',
    'lib/preview.ts',
    'lib/catalog.ts',
    'lib/types.ts',
  ],
  { stdio: 'inherit' },
);
execFileSync(process.execPath, ['--test', 'tests/agent.test.mjs'], {
  stdio: 'inherit',
});
