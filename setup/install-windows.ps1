# =============================================================================
#  VitCam — Windows Installer (Conda backend)
#  Run this in Anaconda Prompt or any terminal where conda is on PATH.
#  Prerequisites: Git, Node.js 18+, Docker Desktop (running), Anaconda/Miniconda
# =============================================================================

$ErrorActionPreference = "Stop"

$REPO        = "https://github.com/scwsoft/vitcam.git"
$VITCAM_DIR  = "$env:USERPROFILE\vitcam"
$SERVER_PORT = 8765
$PYTHON_VER  = "3.10.11"

function Info    { Write-Host "[VitCam] $args" -ForegroundColor Cyan }
function Success { Write-Host "[OK]     $args" -ForegroundColor Green }
function Warn    { Write-Host "[!]      $args" -ForegroundColor Yellow }
function Header  { Write-Host "`n==== $args ====" -ForegroundColor Cyan }

Header "VitCam Installer — Windows (Conda)"

# ── Preflight checks ──────────────────────────────────────────────────────────
foreach ($cmd in @("git", "node", "npm", "conda", "docker")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "[X] '$cmd' not found." -ForegroundColor Red
    switch ($cmd) {
      "git"    { Write-Host "    Install from: https://git-scm.com/download/win" }
      "node"   { Write-Host "    Install from: https://nodejs.org/" }
      "npm"    { Write-Host "    Comes with Node.js" }
      "conda"  { Write-Host "    Install from: https://docs.conda.io/en/latest/miniconda.html" }
      "docker" { Write-Host "    Install from: https://www.docker.com/products/docker-desktop/" }
    }
    exit 1
  }
}

# Check Docker Desktop is running
try {
  docker info | Out-Null
} catch {
  Write-Host "[X] Docker Desktop is not running. Please start it and re-run this script." -ForegroundColor Red
  exit 1
}

Success "All prerequisites found."

# ── Clone repo ────────────────────────────────────────────────────────────────
Header "Step 1 / 6 — Clone VitCam"

if (Test-Path $VITCAM_DIR) {
  Warn "$VITCAM_DIR already exists — pulling latest changes."
  git -C $VITCAM_DIR pull
} else {
  git clone $REPO $VITCAM_DIR
}
Success "Repository ready at $VITCAM_DIR."

# ── Supabase ──────────────────────────────────────────────────────────────────
Header "Step 2 / 6 — Supabase"

Info "Installing Supabase CLI..."
npm install -g supabase --silent

Set-Location $VITCAM_DIR
Info "Starting Supabase (this may take a minute on first run)..."
$supabaseOut = supabase start 2>&1 | Out-String

# Parse keys
$urlMatch  = [regex]::Match($supabaseOut, 'API URL:\s+(\S+)')
$keyMatch  = [regex]::Match($supabaseOut, 'anon key:\s+(\S+)')

$SUPABASE_URL      = if ($urlMatch.Success) { $urlMatch.Groups[1].Value } else { "http://localhost:54321" }
$SUPABASE_ANON_KEY = if ($keyMatch.Success) { $keyMatch.Groups[1].Value } else {
  # Fallback: supabase status
  $statusOut = supabase status 2>&1 | Out-String
  $km = [regex]::Match($statusOut, 'anon key:\s+(\S+)')
  if ($km.Success) { $km.Groups[1].Value } else { "REPLACE_WITH_YOUR_ANON_KEY" }
}

if ($SUPABASE_ANON_KEY -eq "REPLACE_WITH_YOUR_ANON_KEY") {
  Warn "Could not auto-detect anon key. Set it manually in .env files after install."
}

Success "Supabase running — URL: $SUPABASE_URL"

# Apply DB schema
Info "Applying database schema..."
try {
  $env:PGPASSWORD = "postgres"
  psql -h localhost -p 54322 -U postgres -d postgres -f "$VITCAM_DIR\dbschema.sql" -q 2>$null
  Success "Database schema applied."
} catch {
  Warn "Could not auto-apply schema. Open http://localhost:54323 -> SQL Editor and run dbschema.sql manually."
}

# ── Write .env files ──────────────────────────────────────────────────────────
Header "Step 3 / 6 — Writing .env files"

@"
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
"@ | Set-Content "$VITCAM_DIR\frontend\.env" -Encoding UTF8

@"
SUPABASE_URL=$SUPABASE_URL
SUPABASE_KEY=$SUPABASE_ANON_KEY
SERVER_HOST=0.0.0.0
SERVER_PORT=$SERVER_PORT
DEFAULT_CODEC=VP9
DEFAULT_CONTAINER=webm
DEFAULT_RESOLUTION=640x480
DEFAULT_FPS=30
LOG_BUFFER_SIZE=50
LOG_FLUSH_INTERVAL=10.0
PERFORMANCE_LOG_INTERVAL=60.0
DEFAULT_SENSITIVITY=20
DEFAULT_AREA_THRESHOLD=5000
WEBRTC_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
WEBRTC_TURN_SERVER=turn:127.0.0.1:3478
WEBRTC_TURN_USERNAME=webrtc
WEBRTC_TURN_CREDENTIAL=webrtc123
MODEL_SIZE=Nano
MODEL_CHECKPOINT_PATH=./checkpoints/UAV/checkpoint.pth
"@ | Set-Content "$VITCAM_DIR\server\.env" -Encoding UTF8

Success ".env files written."

# ── Conda environment & backend ───────────────────────────────────────────────
Header "Step 4 / 6 — Conda environment & backend"

conda create -n vit-server python=$PYTHON_VER -y
conda run -n vit-server pip install -r "$VITCAM_DIR\server\requirements.txt" -q
conda run -n vit-server pip install -U torch torchvision torchaudio `
  --index-url https://download.pytorch.org/whl/cu128 -q

Info "Verifying CUDA..."
conda run -n vit-server python -c @"
import torch
print('CUDA Available:', torch.cuda.is_available())
if torch.cuda.is_available():
    print('Device:', torch.cuda.get_device_name(0))
else:
    print('Device: CPU (no CUDA GPU detected)')
"@

Success "Backend dependencies installed."

# ── Frontend ──────────────────────────────────────────────────────────────────
Header "Step 5 / 6 — Frontend"

Set-Location "$VITCAM_DIR\frontend"
npm install --silent
npm run build
Success "Frontend built."

# ── Create startup scripts ────────────────────────────────────────────────────
Header "Step 6 / 6 — Creating startup scripts"

# start-server.bat
@"
@echo off
call conda activate vit-server
cd /d "$VITCAM_DIR\server"
python main.py
"@ | Set-Content "$VITCAM_DIR\start-server.bat" -Encoding ASCII

# start-frontend.bat
@"
@echo off
cd /d "$VITCAM_DIR\frontend"
npm start
"@ | Set-Content "$VITCAM_DIR\start-frontend.bat" -Encoding ASCII

# start-vitcam.bat — launches both in separate windows
@"
@echo off
echo Starting VitCam...
start "VitCam Server" cmd /k "$VITCAM_DIR\start-server.bat"
timeout /t 5 /nobreak >nul
start "VitCam Frontend" cmd /k "$VITCAM_DIR\start-frontend.bat"
timeout /t 8 /nobreak >nul
start http://localhost:3000
echo VitCam is starting. Check the two terminal windows for logs.
"@ | Set-Content "$VITCAM_DIR\start-vitcam.bat" -Encoding ASCII

Success "Startup scripts created."

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  VitCam installed successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:        http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend API:     http://localhost:$SERVER_PORT" -ForegroundColor Cyan
Write-Host "  Supabase Studio: http://localhost:54323" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open Supabase Studio -> Authentication -> Users"
Write-Host "     and add your first login user (enable Auto Confirm)"
Write-Host "  2. Double-click start-vitcam.bat to launch VitCam"
Write-Host "     (or run start-server.bat and start-frontend.bat separately)"
Write-Host ""
Write-Host "  To start VitCam next time, run:" -ForegroundColor Cyan
Write-Host "    $VITCAM_DIR\start-vitcam.bat"
Write-Host ""
