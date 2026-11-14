/* global __dirname */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cwd = path.resolve(__dirname, '..');
for (const args of [
  [path.join(cwd, 'node_modules/typescript/bin/tsc'), '--ignoreConfig', 'src/features/recognition/recognition.ts', '--strict', '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--outDir', '../.codex-build/app-recognition-tests'],
  ['--test', 'src/features/recognition/recognition.test.cjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
