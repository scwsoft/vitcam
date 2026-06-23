#!/usr/bin/env bash
# =============================================================================
#  VitCam — Raspberry Pi Installer
#  Tested on Raspberry Pi 4B / 5 — Raspberry Pi OS 64-bit (Debian Bookworm)
#  CPU inference only (no CUDA). Supabase via Docker.
# =============================================================================
set -euo pipefail

REPO="https://github.com/scwsoft/vitcam.git"
VITCAM_DIR="$HOME/vitcam"
SERVER_PORT=8765
FRONTEND_PORT=3000
SUPABASE_PORT=8000
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
header "VitCam Installer — Raspberry Pi (Debian Bookworm)"

if [[ $EUID -eq 0 ]]; then
  error "Do not run as root. Run as a normal user with sudo access."
fi

# Detect 64-bit OS
ARCH=$(uname -m)
if [[ "$ARCH" != "aarch64" ]]; then
  error "A 64-bit OS (aarch64) is required. Current arch: $ARCH"
fi

info "Architecture: $ARCH — OK"

# ── System update ─────────────────────────────────────────────────────────────
header "Step 1 / 9 — System update & dependencies"

sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq \
  git curl wget build-essential libssl-dev zlib1g-dev libbz2-dev \
  libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
  xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
  ffmpeg libgl1 libglib2.0-0

success "System dependencies installed."

# ── Docker ────────────────────────────────────────────────────────────────────
header "Step 2 / 9 — Docker Engine"

if ! command -v docker >/dev/null; then
  info "Installing Docker Engine..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
  sudo usermod -aG docker "$USER"
  warn "Added $USER to docker group. A reboot may be needed if docker commands fail."
  # Apply group without logout in current session
  exec sg docker "$0 $*" || true
else
  success "Docker already installed: $(docker --version)"
fi

if ! docker info >/dev/null 2>&1; then
  sudo systemctl start docker
  sudo systemctl enable docker
fi

success "Docker Engine ready."

# ── Node.js ───────────────────────────────────────────────────────────────────
header "Step 3 / 9 — Node.js"

if ! command -v node >/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
success "Node.js $(node -v) ready."

# ── Clone VitCam ──────────────────────────────────────────────────────────────
header "Step 4 / 9 — Clone VitCam"

if [[ -d "$VITCAM_DIR" ]]; then
  warn "$VITCAM_DIR exists — pulling latest changes."
  git -C "$VITCAM_DIR" pull
else
  git clone "$REPO" "$VITCAM_DIR"
fi
success "Repository ready at $VITCAM_DIR."

# ── Supabase via Docker ───────────────────────────────────────────────────────
header "Step 5 / 9 — Supabase (Docker)"

SUPABASE_DOCKER_DIR="$VITCAM_DIR/supabase/docker"

if [[ ! -d "$VITCAM_DIR/supabase" ]]; then
  info "Cloning Supabase self-hosted stack..."
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
fi

cd "$SUPABASE_DOCKER_DIR"

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  info "Copied .env.example → .env"
fi

info "Starting Supabase containers (first run may take several minutes)..."
docker compose up --detach

# Wait for Supabase Studio to be healthy
info "Waiting for Supabase Studio to be ready..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$SUPABASE_PORT" >/dev/null 2>&1; then
    break
  fi
  echo -n "."
  sleep 5
done
echo ""

# Extract keys from .env
SUPABASE_ANON_KEY=$(grep '^ANON_KEY=' .env | cut -d= -f2- | tr -d '"' || true)
SUPABASE_URL="http://localhost:$SUPABASE_PORT"

if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  warn "Could not read ANON_KEY from .env. Set it manually in .env files after install."
  SUPABASE_ANON_KEY="REPLACE_WITH_YOUR_ANON_KEY"
fi

success "Supabase running at $SUPABASE_URL"

# Apply DB schema
info "Applying database schema..."
docker exec -i supabase-db psql -U postgres -d postgres \
  < "$VITCAM_DIR/dbschema.sql" 2>/dev/null \
  || warn "Could not auto-apply schema. Open http://localhost:$SUPABASE_PORT → SQL Editor and run dbschema.sql manually."

success "Database schema applied."

# ── Write .env files ──────────────────────────────────────────────────────────
header "Step 6 / 9 — Writing .env files"

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

# ── Frontend ──────────────────────────────────────────────────────────────────
header "Step 7 / 9 — Frontend"

cd "$VITCAM_DIR/frontend"
npm install --silent
npm run build
success "Frontend built."

# ── Python / pyenv ────────────────────────────────────────────────────────────
header "Step 8 / 9 — Python $PYTHON_VERSION (pyenv)"

export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

if [[ ! -d "$PYENV_ROOT" ]]; then
  info "Installing pyenv..."
  curl -fsSL https://pyenv.run | bash
fi

eval "$(pyenv init -)" 2>/dev/null || true
eval "$(pyenv virtualenv-init -)" 2>/dev/null || true

if ! pyenv versions | grep -q "$PYTHON_VERSION"; then
  info "Installing Python $PYTHON_VERSION (this takes several minutes on Raspberry Pi)..."
  pyenv install "$PYTHON_VERSION"
fi

pyenv global "$PYTHON_VERSION"
success "Python $(python --version) active."

# Persist pyenv in .bashrc
if ! grep -q 'pyenv init' ~/.bashrc; then
  {
    echo 'export PYENV_ROOT="$HOME/.pyenv"'
    echo '[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"'
    echo 'eval "$(pyenv init -)"'
    echo 'eval "$(pyenv virtualenv-init -)"'
  } >> ~/.bashrc
fi

# ── Backend dependencies ──────────────────────────────────────────────────────
header "Step 9 / 9 — Backend dependencies & launch"

cd "$VITCAM_DIR/server"
pip install -q -r requirements.txt
success "Backend dependencies installed."

# ── PM2 ──────────────────────────────────────────────────────────────────────
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
echo -e "  Frontend:        ${CYAN}http://localhost:$FRONTEND_PORT${RESET}"
echo -e "  Backend API:     ${CYAN}http://localhost:$SERVER_PORT${RESET}"
echo -e "  Supabase Studio: ${CYAN}http://localhost:$SUPABASE_PORT${RESET}"
echo ""
echo -e "${YELLOW}  Next steps:${RESET}"
echo -e "  1. Open Supabase Studio → Authentication → Users"
echo -e "     and add your first login user (enable Auto Confirm)"
echo -e "  2. Open ${CYAN}http://localhost:$FRONTEND_PORT${RESET} and sign in"
echo ""
echo -e "  Manage services: ${BOLD}pm2 list${RESET} | ${BOLD}pm2 logs${RESET} | ${BOLD}pm2 restart all${RESET}"
echo -e "  Supabase:        ${BOLD}cd $VITCAM_DIR/supabase/docker && docker compose ps${RESET}"
echo ""
