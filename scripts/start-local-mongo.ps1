$mongoExe = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
$projectRoot = Split-Path -Parent $PSScriptRoot
$mongoRoot = Join-Path $projectRoot "mongo-local"
$dataDir = Join-Path $mongoRoot "data"
$logDir = Join-Path $mongoRoot "log"
$logFile = Join-Path $logDir "mongod.log"

if (-not (Test-Path $mongoExe)) {
  Write-Error "mongod.exe was not found at $mongoExe. Install MongoDB Community Server or update this script."
  exit 1
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

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

Start-Sleep -Seconds 3

$listening = Get-NetTCPConnection -State Listen -LocalPort 27017 -ErrorAction SilentlyContinue |
  Select-Object -First 1

if (-not $listening) {
  Write-Error "MongoDB did not start. Check $logFile for details."
  exit 1
}

Write-Host "Local MongoDB started on mongodb://127.0.0.1:27017"
