[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$key = Read-Host "API key? (paste, then Enter)"
$key = $key.Trim()
Write-Host ("Key length: " + $key.Length + " / starts with: " + $key.Substring(0, [Math]::Min(11, $key.Length)))

$body = '{"model":"claude-sonnet-5-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'

function Test-Call($name, $headers) {
  Write-Host ""
  Write-Host ("=== " + $name + " ===")
  try {
    $r = Invoke-WebRequest -Uri "https://api.anthropic.com/v1/messages" -Method Post -Headers $headers -ContentType "application/json" -Body $body -UseBasicParsing
    Write-Host ("SUCCESS (HTTP " + $r.StatusCode + ")")
    Write-Host $r.Content.Substring(0, [Math]::Min(200, $r.Content.Length))
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      Write-Host ("FAILED (HTTP " + [int]$resp.StatusCode + ")")
      Write-Host $sr.ReadToEnd()
    } else {
      Write-Host ("NETWORK ERROR: " + $_.Exception.Message)
    }
  }
}

Test-Call "TEST 1: x-api-key" @{ "x-api-key" = $key; "anthropic-version" = "2023-06-01" }
Test-Call "TEST 2: Authorization Bearer" @{ "Authorization" = ("Bearer " + $key); "anthropic-version" = "2023-06-01" }

$ws = Read-Host "Workspace ID? (optional - just press Enter to skip)"
if ($ws.Trim().Length -gt 0) {
  Test-Call "TEST 3: Bearer + workspace-id" @{ "Authorization" = ("Bearer " + $key); "anthropic-version" = "2023-06-01"; "anthropic-workspace-id" = $ws.Trim() }
}

Write-Host ""
Read-Host "Done! Press Enter to close"
