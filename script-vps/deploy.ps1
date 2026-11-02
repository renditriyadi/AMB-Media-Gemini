$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sshTarget = 'rendi@103.193.177.223'
$remoteDir = if ($env:AMB_VPS_REMOTE_DIR) { $env:AMB_VPS_REMOTE_DIR } else { '/home/rendi/ambmedia-v4' }
$pm2Name = if ($env:AMB_VPS_PM2_NAME) { $env:AMB_VPS_PM2_NAME } else { 'ambmedia-v2' }

if ($remoteDir -notmatch '^/[A-Za-z0-9._/-]+$' -or $remoteDir -match '(^|/)\.\.(/|$)') {
  throw 'AMB_VPS_REMOTE_DIR harus berupa path absolut sederhana, contoh: /home/rendi/ambmedia-v4'
}
if ($pm2Name -notmatch '^[A-Za-z0-9._-]+$') {
  throw 'AMB_VPS_PM2_NAME hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung.'
}

foreach ($command in @('ssh', 'scp')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Perintah '$command' tidak ditemukan. Aktifkan OpenSSH Client Windows atau jalankan dari Git Bash/WSL."
  }
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) "ambmedia-deploy-$timestamp.zip"
$remoteArchive = "/tmp/ambmedia-deploy-$timestamp.zip"

try {
  Write-Host 'Membuat arsip source (tanpa kredensial, data runtime, dan cache lokal)...'
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $excludedDirectories = @(
    'node_modules', 'dist', '.git', 'tmp', 'data', 'media-cache',
    'playwright-browsers', '.playwright-browsers', '.playwright', 'ffmpeg',
    '.playwright-profiles'
  )
  $excludedFiles = @(
    'google-service-account.json', 'ambmedia-v4.rar',
    'ektension-weavy.zip', 'ektension-gemini-google.zip'
  )
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
          if ($excludedDirectories -notcontains $item.Name) {
            $pendingDirectories.Push($item.FullName)
          }
          continue
        }
        if ($excludedFiles -contains $item.Name -or $item.Name -match '^\.env($|\.)') {
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
    throw 'Arsip deploy tidak berhasil dibuat.'
  }

  Write-Host "Mengirim source ke ${sshTarget}:$remoteDir ..."
  & scp $archivePath "${sshTarget}:$remoteArchive"
  if ($LASTEXITCODE -ne 0) {
    throw 'Upload arsip gagal.'
  }

  $remoteCommand = "bash -s -- '$remoteDir' '$pm2Name' '$remoteArchive'"
  $remoteScript = @'
set -Eeuo pipefail

APP_DIR="$1"
PM2_NAME="$2"
ARCHIVE="$3"

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: Node.js/npm belum tersedia di VPS." >&2
  exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: PM2 belum tersedia untuk user ini." >&2
  exit 1
fi
if ! command -v unzip >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: unzip atau python3 diperlukan untuk mengekstrak paket deploy." >&2
  exit 1
fi

mkdir -p "$APP_DIR"
if command -v unzip >/dev/null 2>&1; then
  unzip -oq "$ARCHIVE" -d "$APP_DIR"
else
  python3 -m zipfile -e "$ARCHIVE" "$APP_DIR"
fi
rm -f "$ARCHIVE"
cd "$APP_DIR"

if [[ ! -f package-lock.json ]]; then
  echo "ERROR: package-lock.json tidak ditemukan di $APP_DIR." >&2
  exit 1
fi

npm ci
npm run build

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start npm --name "$PM2_NAME" -- start
fi
pm2 save

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:3000/ >/dev/null; then
    echo "Deploy berhasil; aplikasi merespons di port 3000."
    pm2 status "$PM2_NAME"
    exit 0
  fi
  sleep 2
done

echo "ERROR: aplikasi belum merespons di port 3000. Log PM2:" >&2
pm2 logs "$PM2_NAME" --lines 60 --nostream >&2 || true
exit 1
'@

  Write-Host "Deploy ke ${sshTarget}:$remoteDir (PM2: $pm2Name). Password SSH akan diminta oleh OpenSSH."
  $remoteScript | & ssh $sshTarget $remoteCommand
  if ($LASTEXITCODE -ne 0) {
    throw 'Proses deploy di VPS gagal. Periksa output SSH/PM2 di atas.'
  }
}
finally {
  if (Test-Path $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}
