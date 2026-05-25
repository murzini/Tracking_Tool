$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$port = if ($env:PLAYWRIGHT_PORT) { $env:PLAYWRIGHT_PORT } else { "3000" }
$baseUrl = "http://localhost:$port"
$server = $null
$exitCode = 0

function Wait-ForServer {
  param(
    [string] $Url,
    [int] $TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri "$Url/api/catalog" -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url"
}

try {
  # Use an isolated test schema so the suite never touches production data.
  $env:HEATMAP_DB_SCHEMA = "heatmap_test"

  $server = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "-p", $port) `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -PassThru

  Wait-ForServer -Url $baseUrl

  $env:PLAYWRIGHT_PORT = $port
  $env:PLAYWRIGHT_SKIP_WEB_SERVER = "1"

  & npx.cmd playwright test @args
  $exitCode = $LASTEXITCODE
} finally {
  if ($server -and -not $server.HasExited) {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
      Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
      & taskkill.exe /PID $server.Id /T /F *> $null
    } catch {
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
  }
}

exit $exitCode
