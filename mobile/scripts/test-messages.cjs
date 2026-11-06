const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cwd = path.resolve(__dirname, '..');
const tsc = path.join(cwd, 'node_modules/typescript/bin/tsc');
for (const args of [
  [tsc, '--ignoreConfig', 'src/features/place-messages/geometry.ts', 'src/features/place-messages/reader.ts', 'src/features/place-messages/scenes.ts', 'src/features/local-notes/store.ts','src/features/location/location.ts','--strict', '--target', 'ES2022', '--module', 'commonjs', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck', '--outDir', '../.codex-build/app-message-tests'],
  ['--test', 'src/features/place-messages/messages.test.cjs','src/features/local-notes/store.test.cjs','src/features/location/location.test.cjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
