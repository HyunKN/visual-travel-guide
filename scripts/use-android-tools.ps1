param([string]$ToolsRoot = 'D:\Android')

# Dot-source this file from the repository root to configure this shell.
$sdk = Join-Path $ToolsRoot 'Sdk'
$gradle = Join-Path $ToolsRoot 'Gradle'
$jdk = Join-Path $gradle 'jdks\eclipse_adoptium-17-amd64-windows.2'
foreach ($required in @("$sdk\platform-tools\adb.exe", "$jdk\bin\java.exe")) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Android tool not found: $required"
    }
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_USER_HOME = Join-Path $ToolsRoot 'User'
$env:ANDROID_AVD_HOME = Join-Path $env:ANDROID_USER_HOME 'avd'
$env:GRADLE_USER_HOME = $gradle
$env:JAVA_HOME = $jdk
$env:STUDIO_GRADLE_JDK = $jdk
$toolPaths = @("$sdk\platform-tools", "$sdk\emulator", "$jdk\bin")
$env:PATH = (($toolPaths + ($env:PATH -split ';')) | Select-Object -Unique) -join ';'
