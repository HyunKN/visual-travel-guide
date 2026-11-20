param(
    [Parameter(Mandatory)][string]$Serial,
    [string]$Bundle = (Join-Path $PSScriptRoot '../../local-assets/model-handoffs/20261118-5edc57b66551/onnx-fp32-v1'),
    [string]$Adb = 'D:\Android\Sdk\platform-tools\adb.exe'
)

$ErrorActionPreference = 'Stop'
$packageName = 'com.visualtravelguide.app'
$bundleRoot = (Resolve-Path -LiteralPath $Bundle).Path
$manifestPath = Join-Path $bundleRoot 'manifest.json'
$manifestSha256 = '0888728d6ef59ec2fde785fa48b4a752e1bc24f94a85625f81538b81c243c05d'
if ((Get-FileHash -LiteralPath $manifestPath).Hash.ToLowerInvariant() -ne $manifestSha256) {
    throw 'The bundle manifest does not match the accepted model version.'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -AsHashtable

function Invoke-Device([string[]]$Arguments) {
    & $Adb -s $Serial @Arguments
    if ($LASTEXITCODE -ne 0) { throw "adb command failed with exit $LASTEXITCODE." }
}

function Copy-ToPrivateStorage([string]$Source, [string]$Target, [string]$ExpectedHash) {
    # Stream raw bytes to run-as. PowerShell's text pipeline would corrupt the model.
    $pending = "$Target.pending-$([Guid]::NewGuid().ToString('N'))"
    $start = [System.Diagnostics.ProcessStartInfo]::new($Adb)
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
    foreach ($argument in @('-s', $Serial, 'shell', '-T', "run-as $packageName sh -c 'cat > $pending'")) {
        $start.ArgumentList.Add($argument)
    }
    $stream = [System.IO.File]::OpenRead($Source)
    try {
        $process = [System.Diagnostics.Process]::Start($start)
        try {
            try { $stream.CopyTo($process.StandardInput.BaseStream) }
            finally { $process.StandardInput.Close() }
            $process.WaitForExit()
            if ($process.ExitCode -ne 0) { throw 'Streaming into app private storage failed.' }
        } finally {
            $process.Dispose()
        }
        $readback = Invoke-Device @('shell', 'run-as', $packageName, 'sha256sum', $pending)
        if (("$readback" -split '\s+')[0] -ne $ExpectedHash) { throw 'Device file hash mismatch.' }
        Invoke-Device @('shell', 'run-as', $packageName, 'mv', $pending, $Target)
    } catch {
        & $Adb -s $Serial shell run-as $packageName rm -f $pending | Out-Null
        throw
    } finally {
        $stream.Dispose()
    }
}

$files = [ordered]@{'model.onnx' = 'files/nubi-runtime/model.onnx'}
foreach ($id in @('exif-6', 'landscape', 'portrait', 'small', 'square')) {
    $extension = if ($id -eq 'exif-6') { 'jpg' } else { 'png' }
    $files["controls/$id.$extension"] = "files/nubi-runtime/reference/$id/source.$extension"
    $files["reference/$id/input.f32"] = "files/nubi-runtime/reference/$id/input.f32"
}
foreach ($name in $files.Keys) {
    $path = Join-Path $bundleRoot $name
    $expected = $manifest.files[$name]
    if ((Get-Item -LiteralPath $path).Length -ne $expected.bytes -or
        (Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $expected.sha256) {
        throw "Bundle file does not match the manifest: $name"
    }
}
Invoke-Device @('shell', 'run-as', $packageName, 'mkdir', '-p', 'files/nubi-runtime')
foreach ($name in $files.Keys) {
    $target = $files[$name]
    $parent = $target.Substring(0, $target.LastIndexOf('/'))
    Invoke-Device @('shell', 'run-as', $packageName, 'mkdir', '-p', $parent)
    Copy-ToPrivateStorage (Join-Path $bundleRoot $name) $target $manifest.files[$name].sha256
    Write-Output "Installed and verified $name"
}
