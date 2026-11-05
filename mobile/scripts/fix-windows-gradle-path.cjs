// RN 0.86.3 cliPath calls relativeTo across drives when Expo resolves a subst path
// to its physical directory. Keep relative paths where possible; otherwise use
// the absolute argument, which Node accepts. Do not change generated Android code.
const fs = require('node:fs');
const path = require('node:path');
if (process.platform === 'win32') {
  const packageFile = require.resolve('@react-native/gradle-plugin/package.json');
  const version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
  if (version !== '0.86.3') throw Error('Review Windows cliPath workaround for RN Gradle plugin ' + version);
  const target = path.join(path.dirname(packageFile), 'shared/src/main/kotlin/com/facebook/react/utils/Os.kt');
  const source = fs.readFileSync(target, 'utf8');
  const original = 'this.relativeTo(base).path';
  const replacement = 'this.relativeToOrNull(base)?.path ?: absolutePath';
  if (source.includes(replacement)) {
    console.log('Windows Gradle cross-drive workaround is already applied.');
  } else {
    if (source.split(original).length !== 2) throw Error('RN cliPath changed; review the Windows workaround.');
    fs.writeFileSync(target, source.replace(original, replacement));
    console.log('Applied Windows Gradle cross-drive cliPath workaround.');
  }
}
