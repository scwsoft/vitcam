#!/usr/bin/env bash
# =============================================================================
#  VitCam — Ubuntu / Debian Installer
#  Tested on Ubuntu 22.04 / 24.04 LTS and Debian 12 (Bookworm)
# =============================================================================
set -euo pipefail

REPO="https://github.com/scwsoft/vitcam.git"
VITCAM_DIR="$HOME/vitcam"
SERVER_PORT=8765
FRONTEND_PORT=3000
PYTHON_VERSION="3.10.11"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VitCam]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✗]${RESET} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}\n"; }

# ── Preflight ─────────────────────────────────────────────────────────────────
header "VitCam Installer — Ubuntu / Debian"

if [[ $EUID -eq 0 ]]; then
  error "Do not run this script as root. Run as a normal user with sudo access."
fi

command -v sudo >/dev/null || error "sudo is required but not found."

# ── System dependencies ───────────────────────────────────────────────────────
header "Step 1 / 8 — System dependencies"

sudo apt-get update -qq
sudo apt-get install -y -qq \
  git curl wget build-essential libssl-dev zlib1g-dev libbz2-dev \
  libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
  xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
  ffmpeg libgl1 libglib2.0-0

success "System dependencies installed."

# ── Node.js ───────────────────────────────────────────────────────────────────
header "Step 2 / 8 — Node.js"

if ! command -v node >/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - -qq
  sudo apt-get install -y -qq nodejs
fi
success "Node.js $(node -v) ready."

# ── Clone repo ────────────────────────────────────────────────────────────────
header "Step 3 / 8 — Clone VitCam"

if [[ -d "$VITCAM_DIR" ]]; then
  warn "Directory $VITCAM_DIR already exists — pulling latest changes."
  git -C "$VITCAM_DIR" pull
else
  git clone "$REPO" "$VITCAM_DIR"
fi
success "Repository ready at $VITCAM_DIR."

# ── Supabase ──────────────────────────────────────────────────────────────────
header "Step 4 / 8 — Supabase"

if ! command -v supabase >/dev/null; then
  info "Installing Supabase CLI..."
  npm install -g supabase --silent
fi

cd "$VITCAM_DIR"

info "Starting Supabase (this may take a minute on first run)..."
supabase start 2>&1 | tee /tmp/supabase-start.log

# Parse keys from output
SUPABASE_URL=$(grep -oP 'API URL:\s+\K\S+' /tmp/supabase-start.log || true)
SUPABASE_ANON_KEY=$(grep -oP 'anon key:\s+\K\S+' /tmp/supabase-start.log || true)

# Fallback: try supabase status
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" ]]; then
  info "Retrieving keys from supabase status..."
  STATUS=$(supabase status 2>/dev/null || true)
  SUPABASE_URL=$(echo "$STATUS" | grep -oP 'API URL:\s+\K\S+' || echo "http://localhost:54321")
  SUPABASE_ANON_KEY=$(echo "$STATUS" | grep -oP 'anon key:\s+\K\S+' || true)
fi

if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  warn "Could not auto-detect anon key. You will need to set it manually in .env files."
  SUPABASE_ANON_KEY="REPLACE_WITH_YOUR_ANON_KEY"
fi

success "Supabase running — URL: $SUPABASE_URL"

# Apply DB schema
info "Applying database schema..."
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres \
  -f "$VITCAM_DIR/dbschema.sql" -q 2>/dev/null \
  || warn "Could not auto-apply schema. Open http://localhost:54323 → SQL Editor and run dbschema.sql manually."

success "Database schema applied."

# ── Write .env files ──────────────────────────────────────────────────────────
header "Step 5 / 8 — Writing .env files"

# Frontend
cat > "$VITCAM_DIR/frontend/.env" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

# Server
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
header "Step 6 / 8 — Python $PYTHON_VERSION (pyenv)"

export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

if [[ ! -d "$PYENV_ROOT" ]]; then
  info "Installing pyenv..."
  curl -fsSL https://pyenv.run | bash
fi

eval "$(pyenv init -)" 2>/dev/null || true

if ! pyenv versions | grep -q "$PYTHON_VERSION"; then
  info "Installing Python $PYTHON_VERSION (this takes a few minutes)..."
  pyenv install "$PYTHON_VERSION"
fi

pyenv global "$PYTHON_VERSION"
success "Python $(python --version) active."

# Ensure pyenv in .bashrc
if ! grep -q 'pyenv init' ~/.bashrc; then
  {
    echo 'export PYENV_ROOT="$HOME/.pyenv"'
    echo '[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"'
    echo 'eval "$(pyenv init -)"'
    echo 'eval "$(pyenv virtualenv-init -)"'
  } >> ~/.bashrc
fi

# ── Backend dependencies ──────────────────────────────────────────────────────
header "Step 7 / 8 — Backend dependencies"

cd "$VITCAM_DIR/server"
pip install -q -r requirements.txt
success "Backend dependencies installed."

# ── Frontend ──────────────────────────────────────────────────────────────────
header "Step 8 / 8 — Frontend"

cd "$VITCAM_DIR/frontend"
npm install --silent
npm run build

success "Frontend built."

# ── PM2 process manager ───────────────────────────────────────────────────────
header "Starting services with PM2"

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
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || true

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  VitCam installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Frontend:       ${CYAN}http://localhost:$FRONTEND_PORT${RESET}"
echo -e "  Backend API:    ${CYAN}http://localhost:$SERVER_PORT${RESET}"
echo -e "  Supabase:       ${CYAN}http://localhost:54321${RESET}"
echo -e "  Supabase Studio:${CYAN}http://localhost:54323${RESET}"
echo ""
echo -e "${YELLOW}  Next steps:${RESET}"
echo -e "  1. Open Supabase Studio → Authentication → Users"
echo -e "     and add your first login user (enable Auto Confirm)"
echo -e "  2. Open ${CYAN}http://localhost:$FRONTEND_PORT${RESET} and sign in"
echo ""
echo -e "  Manage services: ${BOLD}pm2 list${RESET} | ${BOLD}pm2 logs${RESET} | ${BOLD}pm2 restart all${RESET}"
echo ""
