/* global __dirname */
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const cwd=path.resolve(__dirname,'..');
for(const args of [
  [path.join(cwd,'node_modules/typescript/bin/tsc'),'--ignoreConfig','src/features/place-messages/contract.ts','src/features/public-messages/editorAction.ts','src/features/public-messages/recovery.ts','--strict','--target','ES2022','--module','commonjs','--resolveJsonModule','--esModuleInterop','--skipLibCheck','--outDir','../.codex-build/app-message-tests'],
  ['--test','src/navigation/home.test.cjs','src/features/place-messages/SceneNavigation.test.cjs','src/features/local-notes/Editor.test.cjs'],
]){
  const result=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
