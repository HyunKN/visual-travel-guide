/* global __dirname */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cwd = path.resolve(__dirname, '..');
const tsc = path.join(cwd, 'node_modules/typescript/bin/tsc');
for (const args of [
  [tsc, '--ignoreConfig', 'src/features/place-content/content.ts', 'src/features/place-content/editorial.ts', '--strict', '--target', 'ES2022', '--module', 'commonjs', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck', '--outDir', '../.codex-build/app-content-tests'],
  ['--test', 'src/features/place-content/content.test.cjs', 'src/features/place-content/HomeScreen.test.cjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
