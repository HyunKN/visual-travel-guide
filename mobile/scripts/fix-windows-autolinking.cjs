// expo-modules-autolinking 57.0.16 reads JSON through cmd /c on Windows.
// Machine/user AutoRun output (for example, chcp) corrupts that JSON.
// /d disables AutoRun for this child command without changing the registry.
const fs = require('node:fs');
const path = require('node:path');

if (process.platform === 'win32') {
  const packagePath = require.resolve('expo-modules-autolinking/package.json');
  const target = path.join(
    path.dirname(packagePath),
    'android/expo-gradle-plugin/expo-autolinking-plugin-shared/src/main/kotlin/expo/modules/plugin/Os.kt',
  );
  const original = 'listOf("cmd", "/c") + args';
  const replacement = 'listOf("cmd", "/d", "/c") + args';
  const source = fs.readFileSync(target, 'utf8');

  if (source.includes(replacement)) {
    console.log('Windows autolinking AutoRun workaround is already applied.');
  } else {
    if (source.split(original).length !== 2) {
      throw new Error('Expo autolinking changed; review the Windows AutoRun workaround before building.');
    }
    fs.writeFileSync(target, source.replace(original, replacement));
    console.log('Applied Windows autolinking AutoRun workaround (cmd /d /c).');
  }
}
