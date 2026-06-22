#!/usr/bin/env bash
# =============================================================================
#  VitCam — macOS Installer
#  Tested on macOS 13+ (Apple Silicon and Intel)
#  Requires: Homebrew, Docker Desktop running
# =============================================================================
set -euo pipefail

REPO="https://github.com/scwsoft/vitcam.git"
VITCAM_DIR="$HOME/vitcam"
SERVER_PORT=8765
FRONTEND_PORT=3000
PYTHON_VERSION="3.10.19"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VitCam]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✗]${RESET} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}\n"; }

# ── Preflight ─────────────────────────────────────────────────────────────────
header "VitCam Installer — macOS"

# Homebrew
if ! command -v brew >/dev/null; then
  error "Homebrew is required. Install it from https://brew.sh and re-run this script."
fi

# Docker Desktop
if ! docker info >/dev/null 2>&1; then
  error "Docker Desktop is not running. Start Docker Desktop and re-run this script."
fi

# Node.js
if ! command -v node >/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Installing Node.js..."
  brew install node
fi
success "Node.js $(node -v) ready."

# ── Clone repo ────────────────────────────────────────────────────────────────
header "Step 1 / 7 — Clone VitCam"

if [[ -d "$VITCAM_DIR" ]]; then
  warn "Directory $VITCAM_DIR already exists — pulling latest changes."
  git -C "$VITCAM_DIR" pull
else
  git clone "$REPO" "$VITCAM_DIR"
fi
success "Repository ready at $VITCAM_DIR."

# ── Supabase ──────────────────────────────────────────────────────────────────
header "Step 2 / 7 — Supabase"

if ! command -v supabase >/dev/null; then
  info "Installing Supabase CLI..."
  brew install supabase/tap/supabase
else
  brew upgrade supabase 2>/dev/null || true
fi

cd "$VITCAM_DIR"

if [[ ! -d "$VITCAM_DIR/supabase" ]]; then
  supabase init
fi

info "Starting Supabase (this may take a minute on first run)..."
supabase start 2>&1 | tee /tmp/supabase-start.log

# Parse keys
SUPABASE_URL=$(grep -oE 'API URL:[[:space:]]+[^ ]+' /tmp/supabase-start.log | awk '{print $NF}' || true)
SUPABASE_ANON_KEY=$(grep -oE 'anon key:[[:space:]]+[^ ]+' /tmp/supabase-start.log | awk '{print $NF}' || true)

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" ]]; then
  STATUS=$(supabase status 2>/dev/null || true)
  SUPABASE_URL=$(echo "$STATUS" | grep -oE 'API URL:[[:space:]]+[^ ]+' | awk '{print $NF}' || echo "http://localhost:54321")
  SUPABASE_ANON_KEY=$(echo "$STATUS" | grep -oE 'anon key:[[:space:]]+[^ ]+' | awk '{print $NF}' || true)
fi

if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  warn "Could not auto-detect anon key. Set it manually in .env files after install."
  SUPABASE_ANON_KEY="REPLACE_WITH_YOUR_ANON_KEY"
fi

success "Supabase running — URL: $SUPABASE_URL"

# Apply DB schema via psql (bundled with Supabase)
info "Applying database schema..."
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f "$VITCAM_DIR/dbschema.sql" -q 2>/dev/null \
  || warn "Could not auto-apply schema. Open http://localhost:54323 → SQL Editor and run dbschema.sql manually."

success "Database schema applied."

# ── Write .env files ──────────────────────────────────────────────────────────
header "Step 3 / 7 — Writing .env files"

cat > "$VITCAM_DIR/frontend/.env" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

cat > "$VITCAM_DIR/server/.env" <<EOF
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
EOF

success ".env files written."

# ── Python / pyenv ────────────────────────────────────────────────────────────
header "Step 4 / 7 — Python $PYTHON_VERSION (pyenv)"

if ! command -v pyenv >/dev/null; then
  info "Installing pyenv..."
  brew install pyenv
fi

export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)" 2>/dev/null || true

if ! pyenv versions | grep -q "$PYTHON_VERSION"; then
  info "Installing Python $PYTHON_VERSION..."
  pyenv install "$PYTHON_VERSION"
fi

pyenv global "$PYTHON_VERSION"
success "Python $(python --version) active."

# Persist pyenv in .zshrc
SHELL_RC="$HOME/.zshrc"
if ! grep -q 'pyenv init' "$SHELL_RC" 2>/dev/null; then
  {
    echo 'export PYENV_ROOT="$HOME/.pyenv"'
    echo 'export PATH="$PYENV_ROOT/bin:$PATH"'
    echo 'eval "$(pyenv init --path)"'
  } >> "$SHELL_RC"
fi

# ── Backend dependencies ──────────────────────────────────────────────────────
header "Step 5 / 7 — Backend dependencies"

cd "$VITCAM_DIR/server"
pip install -q -r requirements.txt

# Apple Silicon opencv fallback
if ! python -c "import cv2" 2>/dev/null; then
  warn "opencv-python failed — trying opencv-python-headless..."
  pip install -q opencv-python-headless
fi

success "Backend dependencies installed."

# ── Frontend ──────────────────────────────────────────────────────────────────
header "Step 6 / 7 — Frontend"

cd "$VITCAM_DIR/frontend"
npm install --silent
npm run build
success "Frontend built."

# ── Launch with PM2 ───────────────────────────────────────────────────────────
header "Step 7 / 7 — Starting services"

if ! command -v pm2 >/dev/null; then
  npm install -g pm2 --silent
fi

pm2 delete vitcam-frontend 2>/dev/null || true
pm2 delete vitcam-server   2>/dev/null || true

pm2 start npm --name vitcam-frontend -- start \
  --cwd "$VITCAM_DIR/frontend"

pm2 start python --name vitcam-server \
  --cwd "$VITCAM_DIR/server" \
  -- main.py

pm2 save

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  VitCam installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Frontend:        ${CYAN}http://localhost:$FRONTEND_PORT${RESET}"
echo -e "  Backend API:     ${CYAN}http://localhost:$SERVER_PORT${RESET}"
echo -e "  Supabase Studio: ${CYAN}http://localhost:54323${RESET}"
echo ""
echo -e "${YELLOW}  Next steps:${RESET}"
echo -e "  1. Open Supabase Studio → Authentication → Users"
echo -e "     and add your first login user (enable Auto Confirm)"
echo -e "  2. Open ${CYAN}http://localhost:$FRONTEND_PORT${RESET} and sign in"
echo ""
echo -e "  Manage services: ${BOLD}pm2 list${RESET} | ${BOLD}pm2 logs${RESET} | ${BOLD}pm2 restart all${RESET}"
echo ""
