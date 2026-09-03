# ============================================================
# Lost & Found AI Matcher - Full Project Health Check
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File .\check-project.ps1
# ============================================================

$ErrorActionPreference = 'Continue'
$root     = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$script:pass = 0
$script:fail = 0

function Check($name, $ok, $detail) {
    if ($ok) {
        Write-Host ("  [PASS] {0}" -f $name) -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host ("  [FAIL] {0}" -f $name) -ForegroundColor Red
        if ($detail) { Write-Host ("         {0}" -f $detail) -ForegroundColor DarkYellow }
        $script:fail++
    }
}

function Run-In($dir, $file, $cmdArgs) {
    Push-Location $dir
    try {
        $out = & $file @cmdArgs 2>&1
        return @{ ok = ($LASTEXITCODE -eq 0); out = ($out | Out-String) }
    } finally { Pop-Location }
}

Write-Host "`n=== 1. Environment ===" -ForegroundColor Cyan
Check "Node.js installed"          ($null -ne (Get-Command node -ErrorAction SilentlyContinue)) "install Node 18+ from nodejs.org"
Check "npm installed"              ($null -ne (Get-Command npm  -ErrorAction SilentlyContinue)) "npm ships with Node"
Check "backend/.env exists"        (Test-Path (Join-Path $backend  '.env'))         "copy backend/.env.example and fill keys"
Check "frontend/.env.local exists" (Test-Path (Join-Path $frontend '.env.local'))   "copy frontend/.env.local.example and fill keys"
Check "backend/node_modules"       (Test-Path (Join-Path $backend  'node_modules')) "run: cd backend; npm install"
Check "frontend/node_modules"      (Test-Path (Join-Path $frontend 'node_modules')) "run: cd frontend; npm install"

Write-Host "`n=== 2. Backend: TypeScript check (tsc --noEmit) ===" -ForegroundColor Cyan
$r = Run-In $backend 'npx.cmd' @('tsc', '--noEmit')
Check "Backend compiles with no type errors" $r.ok "if corrupted types appear (e.g. joi / @types/node), run: Remove-Item -Recurse -Force backend\node_modules; cd backend; npm install"

Write-Host "`n=== 3. Backend: Unit tests (vitest) ===" -ForegroundColor Cyan
$r = Run-In $backend 'npx.cmd' @('vitest', 'run')
Check "All backend tests pass (expected 29)" $r.ok $r.out

Write-Host "`n=== 4. Backend: Production build ===" -ForegroundColor Cyan
$r = Run-In $backend 'npm.cmd' @('run', 'build')
Check "Backend build (tsc -> dist/)" $r.ok $r.out

Write-Host "`n=== 5. Frontend: TypeScript check (tsc --noEmit) ===" -ForegroundColor Cyan
$r = Run-In $frontend 'npx.cmd' @('tsc', '--noEmit')
Check "Frontend compiles with no type errors" $r.ok $r.out

Write-Host "`n=== 6. Frontend: Production build (next build) ===" -ForegroundColor Cyan
$r = Run-In $frontend 'npm.cmd' @('run', 'build')
Check "Frontend build (10 routes)" $r.ok $r.out

Write-Host "`n=== 7. Backend: Boot + /api/health ===" -ForegroundColor Cyan
Push-Location $backend
$serverOk = $false
try {
    $proc = Start-Process -FilePath 'npx.cmd' -ArgumentList 'tsx', 'src/server.ts' -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 10
    try {
        $resp = Invoke-WebRequest -Uri 'http://localhost:4000/api/health' -UseBasicParsing -TimeoutSec 10
        $serverOk = ($resp.StatusCode -eq 200)
        Check "Server boots, GET /api/health -> 200" $serverOk $resp.Content
    } catch {
        Check "Server boots, GET /api/health -> 200" $false $_.Exception.Message
    }
} finally {
    # Kill whatever is listening on port 4000 (tsx spawns child node processes)
    $conn = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
    if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
    Pop-Location
}

Write-Host "`n=== 8. Database: Supabase pooler TCP reachability ===" -ForegroundColor Cyan
$envFile = Join-Path $backend '.env'
if (Test-Path $envFile) {
    $line = (Select-String -Path $envFile -Pattern '^DATABASE_URL=' | Select-Object -First 1).Line
    if ($line -match '@([^:/]+):(\d+)') {
        $dbHost = $Matches[1]; $dbPort = [int]$Matches[2]
        $tcp = New-Object System.Net.Sockets.TcpClient
        try {
            $task = $tcp.ConnectAsync($dbHost, $dbPort)
            $reachable = ($task.Wait(5000) -and $tcp.Connected)
            Check "TCP ${dbHost}:${dbPort} reachable" $reachable "known issue: TCP opens but PG handshake may still time out locally; migrations are already applied - verify on Render"
        } finally { $tcp.Close() }
    } else {
        Check "DATABASE_URL parseable" $false "could not read host:port from backend/.env"
    }
} else {
    Check "DATABASE_URL parseable" $false "backend/.env missing"
}

Write-Host "`n=== 9. Git hygiene: secrets not tracked ===" -ForegroundColor Cyan
Push-Location $root
$trackedEnv = git ls-files 'backend/.env' 'frontend/.env.local' 2>$null
Check "backend/.env and frontend/.env.local NOT tracked by git" ([string]::IsNullOrWhiteSpace(($trackedEnv | Out-String).Trim())) "run: git rm --cached backend/.env frontend/.env.local"
Pop-Location

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host (" RESULT: {0} passed, {1} failed" -f $script:pass, $script:fail) -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Yellow' })
Write-Host "============================================================`n"
if ($script:fail -gt 0) { exit 1 } else { exit 0 }
