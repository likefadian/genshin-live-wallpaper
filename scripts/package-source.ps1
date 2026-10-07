$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$taskPackage = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $taskRoot 'package.json') | ConvertFrom-Json
$taskRelease = Join-Path $taskRoot 'release'
New-Item -ItemType Directory -Path $taskRelease -Force | Out-Null
$taskOutput = Join-Path $taskRelease ("GenshinEXE-Source-" + $taskPackage.version + '.zip')
if (Test-Path -LiteralPath $taskOutput) { throw "Source archive already exists: $taskOutput" }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskStream = [System.IO.File]::Open($taskOutput, [System.IO.FileMode]::CreateNew)
$taskArchive = [System.IO.Compression.ZipArchive]::new($taskStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
$taskCount = 0
try {
  $taskEntries = @('.gitignore','.npmrc','package.json','package-lock.json','README.md','THIRD-PARTY-NOTICES.md','Start-Development.cmd','Build-Installer.cmd','electron','scripts','tests','docs','vendor','content')
  foreach ($taskEntry in $taskEntries) {
    $taskPath = Join-Path $taskRoot $taskEntry
    if (-not (Test-Path -LiteralPath $taskPath)) { throw "Missing source input: $taskEntry" }
    $taskItem = Get-Item -LiteralPath $taskPath
    $taskFiles = if ($taskItem.PSIsContainer) { Get-ChildItem -LiteralPath $taskPath -Recurse -File } else { @($taskItem) }
    foreach ($taskFile in $taskFiles) {
      $taskAbsolute = [System.IO.Path]::GetFullPath($taskFile.FullName)
      if (-not $taskAbsolute.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Source path outside project' }
      if (($taskFile.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse links are not included' }
      $taskRelative = $taskAbsolute.Substring($taskRoot.Length + 1).Replace('\','/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive, $taskAbsolute, ('GenshinEXE/' + $taskRelative), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
      $taskCount++
    }
  }
} finally { $taskArchive.Dispose(); $taskStream.Dispose() }
Write-Output "Source archive created: $taskOutput ($taskCount files)"
