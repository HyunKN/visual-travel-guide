// Compile-only baseline. Expo 57 export uses mockServer and never listens.
/* global __dirname */
const {spawnSync}=require('node:child_process');
const {mkdirSync}=require('node:fs');
const path=require('node:path');
const cwd=path.resolve(__dirname,'..');
const cli=path.join(cwd,'node_modules/expo/bin/cli');
const output=path.resolve(cwd,'../.codex-build/android-bundle-check');
const tempRoot=path.resolve(cwd,'../.codex-build/android-bundle-temp');
mkdirSync(tempRoot,{recursive:true});
const result=spawnSync(process.execPath,[cli,'export','--platform','android','--output-dir',output,'--max-workers','2'],{
  cwd,stdio:'inherit',
  env:{...process.env,EXPO_OFFLINE:'1',EXPO_NO_DOTENV:'1',EXPO_NO_TELEMETRY:'1',
    TEMP:tempRoot,TMP:tempRoot,
    EXPO_PUBLIC_SUPABASE_URL:'',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
});
process.exit(result.status??1);
