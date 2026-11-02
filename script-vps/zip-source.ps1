$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path $PSScriptRoot "ambmedia-source-$timestamp.zip"

Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'ambmedia-source-*.zip' -File -Force |
  ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
    Write-Host "Menghapus arsip lama: $($_.Name)"
  }

Write-Host 'Membuat arsip source (tanpa kredensial, data runtime, dan cache lokal)...'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$excludedDirectories = @(
  'node_modules', 'dist', '.git', 'tmp', 'media-cache',
  'playwright-browsers', '.playwright-browsers', '.playwright', 'ffmpeg',
  '.playwright-profiles'
)
$excludedFiles = @(
  'google-service-account.json', 'ambmedia-v4.rar'
)

try {
  $zip = [System.IO.Compression.ZipFile]::Open(
    $archivePath,
    [System.IO.Compression.ZipArchiveMode]::Create
  )
  try {
    $rootPrefix = $projectRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $pendingDirectories = [System.Collections.Generic.Stack[string]]::new()
    $pendingDirectories.Push($projectRoot)
    while ($pendingDirectories.Count -gt 0) {
      $directory = $pendingDirectories.Pop()
      foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
          continue
        }
        if ($item.PSIsContainer) {
          $isRootRuntimeData = $item.Name -eq 'data' -and
            [string]::Equals($directory, $projectRoot, [System.StringComparison]::OrdinalIgnoreCase)
          if ($excludedDirectories -notcontains $item.Name -and -not $isRootRuntimeData) {
            $pendingDirectories.Push($item.FullName)
          }
          continue
        }
        if (
          $excludedFiles -contains $item.Name -or
          $item.Extension -ieq '.zip' -or
          $item.Name -match '^\.env($|\.)'
        ) {
          continue
        }

        $relativePath = $item.FullName.Substring($rootPrefix.Length).Replace('\', '/')
        $entry = $zip.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Fastest)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($item.FullName)
        try {
          $fileStream.CopyTo($entryStream)
        }
        finally {
          $fileStream.Dispose()
          $entryStream.Dispose()
        }
      }
    }
  }
  finally {
    $zip.Dispose()
  }

  if (-not (Test-Path -LiteralPath $archivePath) -or (Get-Item -LiteralPath $archivePath).Length -eq 0) {
    throw 'Arsip source tidak berhasil dibuat.'
  }

  Write-Host "Arsip berhasil dibuat: $archivePath"
}
catch {
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
  throw
}

##### Jalankan .\script-vps\run-zip-source.cmd jika PowerShell memblokir script unsigned.
##### Atau jalankan: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script-vps\zip-source.ps1