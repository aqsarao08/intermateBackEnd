$mongoExe = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
$projectRoot = Split-Path -Parent $PSScriptRoot
$mongoRoot = Join-Path $projectRoot "mongo-local"
$legacyDataDir = Join-Path $mongoRoot "data"
$dataDir = Join-Path $mongoRoot "runtime-data"
$logDir = Join-Path $mongoRoot "log"
$logFile = Join-Path $logDir "mongod.log"

if (-not (Test-Path $mongoExe)) {
  Write-Error "mongod.exe was not found at $mongoExe. Install MongoDB Community Server or update this script."
  exit 1
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if ((Test-Path $legacyDataDir) -and -not (Test-Path (Join-Path $dataDir "WiredTiger"))) {
  Write-Host "Using fresh local MongoDB runtime data at $dataDir to avoid locks in the legacy data directory."
}

$listeningBeforeStart = Get-NetTCPConnection -State Listen -LocalPort 27017 -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($listeningBeforeStart) {
  Write-Host "Local MongoDB is already running on port 27017."
  exit 0
}

$args = @(
  "--dbpath", $dataDir,
  "--logpath", $logFile,
  "--bind_ip", "127.0.0.1",
  "--port", "27017"
)

Start-Process -FilePath $mongoExe -ArgumentList $args -WindowStyle Hidden

for ($attempt = 0; $attempt -lt 15; $attempt++) {
  Start-Sleep -Seconds 1
  $listening = Get-NetTCPConnection -State Listen -LocalPort 27017 -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if ($listening) {
    break
  }
}

if (-not $listening) {
  Write-Error "MongoDB did not start. Check $logFile for details."
  exit 1
}

Write-Host "Local MongoDB started on mongodb://127.0.0.1:27017"
