# =============================================================================
#  VitCam -- Windows Installer (Conda backend)
#  Run via install-windows.bat (handles execution policy automatically)
#  Prerequisites: Git, Node.js 18+, Docker Desktop (running), Anaconda/Miniconda
# =============================================================================

$ErrorActionPreference = "Stop"

$REPO        = "https://github.com/scwsoft/vitcam.git"
# Use the parent of the folder containing this script as the VitCam root
$VITCAM_DIR  = (Get-Item "$PSScriptRoot\..").FullName
$SERVER_PORT = 8765
$PYTHON_VER  = "3.10.11"

function Info    { Write-Host "[VitCam] $args" -ForegroundColor Cyan }
function Success { Write-Host "[OK]     $args" -ForegroundColor Green }
function Warn    { Write-Host "[!]      $args" -ForegroundColor Yellow }
function Header  { Write-Host "`n==== $args ====" -ForegroundColor Cyan }

Header "VitCam Installer -- Windows (Conda)"

# -- Preflight checks ----------------------------------------------------------
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

try {
  docker info | Out-Null
} catch {
  Write-Host "[X] Docker Desktop is not running. Please start it and re-run this script." -ForegroundColor Red
  exit 1
}

Success "All prerequisites found."

# -- Clone repo ----------------------------------------------------------------
Header "Step 1 / 6 -- Clone VitCam"

if (Test-Path $VITCAM_DIR) {
  Warn "$VITCAM_DIR already exists -- pulling latest changes."
  git -C $VITCAM_DIR pull
} else {
  git clone $REPO $VITCAM_DIR
}
Success "Repository ready at $VITCAM_DIR."

# -- Supabase ------------------------------------------------------------------
Header "Step 2 / 6 -- Supabase"

# Supabase CLI writes progress to stderr -- use Continue for the whole block
$ErrorActionPreference = "Continue"

Info "Installing Supabase CLI..."
npm install -g supabase --silent

Set-Location $VITCAM_DIR
Info "Starting Supabase (this may take several minutes on first run -- pulling Docker images)..."
$supabaseOut = (supabase start 2>&1) -join "`n"

Success "Supabase is running."

Info "Applying database schema via Docker..."
# Use docker exec to run psql inside the Supabase postgres container
# This avoids needing psql installed on Windows
$schemaSQL = Get-Content "$VITCAM_DIR\server\dbschema.sql" -Raw
$schemaSQL | docker exec -i supabase_db_vitcam psql -U postgres -d postgres -q 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
  Success "Database schema applied successfully."
} else {
  Warn "Could not auto-apply schema via Docker. Trying alternative container name..."
  # Container name may differ depending on Supabase CLI version
  $containerId = docker ps --filter "name=supabase" --filter "name=db" --format "{{.Names}}" 2>$null |
    Where-Object { $_ -match "db" } | Select-Object -First 1
  if ($containerId) {
    $schemaSQL | docker exec -i $containerId psql -U postgres -d postgres -q 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Success "Database schema applied via container: $containerId"
    } else {
      Write-Host ""
      Write-Host "  ACTION REQUIRED -- Apply the database schema manually:" -ForegroundColor Yellow
      Write-Host "  --------------------------------------------------------" -ForegroundColor Yellow
      Write-Host "  1. Supabase Studio is opening in your browser..."
      Write-Host "  2. Go to: SQL Editor (left sidebar)"
      Write-Host "  3. Open and paste this file into the editor:"
      Write-Host "     $VITCAM_DIR\server\dbschema.sql" -ForegroundColor Cyan
      Write-Host "  4. Click RUN"
      Write-Host ""
      Start-Process "http://localhost:54323/project/default/sql/new"
      Write-Host "  Press ENTER once you have run the schema..." -ForegroundColor Yellow
      Read-Host | Out-Null
      Success "Database schema step complete."
    }
  }
}

$ErrorActionPreference = "Stop"

# -- .env reminder ------------------------------------------------------------
Header "Step 3 / 6 -- Configure .env files"

Write-Host ""
Write-Host "  ACTION REQUIRED -- Set your Supabase keys in the .env files:" -ForegroundColor Yellow
Write-Host "  ----------------------------------------------------------------"
Write-Host "  1. Open Supabase Studio -> Project Settings -> API:"
Write-Host "     http://localhost:54323" -ForegroundColor Cyan
Write-Host "     Copy the URL and anon public key"
Write-Host ""
Write-Host "  2. Edit this file and update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY:" -ForegroundColor Yellow
Write-Host "     $VITCAM_DIR\frontend\.env" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Edit this file and update SUPABASE_URL and SUPABASE_KEY:" -ForegroundColor Yellow
Write-Host "     $VITCAM_DIR\server\.env" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press ENTER once you have updated both .env files..." -ForegroundColor Yellow
Read-Host | Out-Null
Success ".env configuration step complete."

# -- Create first user prompt --------------------------------------------------
Write-Host ""
Write-Host "  ACTION REQUIRED -- Create your first login user:" -ForegroundColor Yellow
Write-Host "  --------------------------------------------------" -ForegroundColor Yellow
Write-Host "  1. Supabase Studio is opening in your browser..."
Write-Host "  2. Go to: Authentication -> Users (left sidebar)"
Write-Host "  3. Click Add User, enter your email and password"
Write-Host "  4. Enable Auto Confirm"
Write-Host ""
Start-Process "http://localhost:54323/project/default/auth/users"
Write-Host "  Press ENTER once you have created your user..." -ForegroundColor Yellow
Read-Host | Out-Null
Success "User creation step complete."

# -- Conda environment and backend ---------------------------------------------
Header "Step 4 / 6 -- Conda environment and backend"

conda create -n vit-server python=$PYTHON_VER -y
conda run -n vit-server pip install -r "$VITCAM_DIR\server\requirements.txt" -q
conda run -n vit-server pip install -U torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128 -q

Info "Verifying CUDA..."
$cudaCheck = @'
import torch
print("CUDA Available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("Device:", torch.cuda.get_device_name(0))
else:
    print("Device: CPU (no CUDA GPU detected)")
'@

$cudaCheck | conda run -n vit-server python

Success "Backend dependencies installed."

# -- Frontend ------------------------------------------------------------------
Header "Step 5 / 6 -- Frontend"

Set-Location "$VITCAM_DIR\frontend"
npm install --silent
npm run build
Success "Frontend built."

# -- Create startup scripts ----------------------------------------------------
Header "Step 6 / 6 -- Creating startup scripts"

@"
@echo off
call conda activate vit-server
cd /d "$VITCAM_DIR\server"
python main.py
"@ | Set-Content "$VITCAM_DIR\start-server.bat" -Encoding ASCII

@"
@echo off
cd /d "$VITCAM_DIR\frontend"
npm start
"@ | Set-Content "$VITCAM_DIR\start-frontend.bat" -Encoding ASCII

@"
@echo off
echo Starting VitCam...
start "VitCam Server" cmd /k "$VITCAM_DIR\start-server.bat"
timeout /t 5 /nobreak >nul
start "VitCam Frontend" cmd /k "$VITCAM_DIR\start-frontend.bat"
timeout /t 8 /nobreak >nul
start http://localhost:3000
echo VitCam is starting. Check the two terminal windows for logs.
pause
"@ | Set-Content "$VITCAM_DIR\start-vitcam.bat" -Encoding ASCII

Success "Startup scripts created."

# -- Done ----------------------------------------------------------------------
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
Write-Host ""
Write-Host "  To start VitCam next time, run:" -ForegroundColor Cyan
Write-Host "    $VITCAM_DIR\start-vitcam.bat"
Write-Host ""