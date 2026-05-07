$ErrorActionPreference = 'Stop'

$metroPort = 8086
$portsToClear = @(4040, 8081, 8085, 8086)
$maxAttempts = 3

function Clear-StaleExpoProcesses {
  Write-Host "Cleaning stale Expo/ngrok processes..."

  Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

  foreach ($port in $portsToClear) {
    $listeners = netstat -ano | Select-String ":$port"
    foreach ($listener in $listeners) {
      $parts = ($listener.ToString() -split '\s+') | Where-Object { $_ }
      if ($parts.Length -ge 5) {
        $processIdValue = $parts[-1]
        if ($processIdValue -match '^\d+$' -and $processIdValue -ne '0') {
          try {
            Stop-Process -Id ([int]$processIdValue) -Force -ErrorAction SilentlyContinue
          } catch {
          }
        }
      }
    }
  }

  Start-Sleep -Seconds 2
}

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  Clear-StaleExpoProcesses
  Write-Host "Starting Expo dev client with tunnel on port $metroPort (attempt $attempt/$maxAttempts)..."
  & npx expo start --dev-client --tunnel --clear --port $metroPort

  if ($LASTEXITCODE -eq 0) {
    exit 0
  }

  if ($attempt -lt $maxAttempts) {
    Write-Host "Tunnel start failed. Retrying in 3 seconds..."
    Start-Sleep -Seconds 3
  }
}

exit $LASTEXITCODE
