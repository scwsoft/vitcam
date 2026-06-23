#!/usr/bin/env bash
# =============================================================================
#  VitCam — Raspberry Pi Installer
#  Tested on Raspberry Pi 4B / 5 — Raspberry Pi OS 64-bit (Debian Bookworm)
#  CPU inference only (no CUDA). Supabase via Docker.
# =============================================================================
set -euo pipefail

# Derive VitCam root from the script's own location (parent of setup/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VITCAM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO="https://github.com/scwsoft/vitcam.git"

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

ARCH=$(uname -m)
if [[ "$ARCH" != "aarch64" ]]; then
  error "A 64-bit OS (aarch64) is required. Current arch: $ARCH"
fi

info "Architecture: $ARCH — OK"
info "VitCam directory: $VITCAM_DIR"

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
fi

# Ensure user is in docker group
if ! groups "$USER" | grep -q docker; then
  sudo usermod -aG docker "$USER"
  warn "Added $USER to docker group."
fi

sudo systemctl start docker
sudo systemctl enable docker

# Use sudo if group not yet active in this session
if ! docker info >/dev/null 2>&1; then
  warn "Docker group not active in this session — using sudo for docker commands."
  DOCKER_CMD="sudo docker"
else
  DOCKER_CMD="docker"
  success "Docker $(docker --version) ready."
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

if [[ -d "$VITCAM_DIR/.git" ]]; then
  info "Repository already exists — pulling latest changes."
  git -C "$VITCAM_DIR" pull
else
  git clone "$REPO" "$VITCAM_DIR" 2>/dev/null || info "Using existing directory at $VITCAM_DIR."
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

# Create required storage directories that Supabase Docker expects
info "Creating Supabase storage directories..."
mkdir -p volumes/db/data
mkdir -p volumes/storage
mkdir -p volumes/functions
mkdir -p volumes/logs
success "Storage directories ready."

info "Starting Supabase containers (first run may take several minutes)..."
$DOCKER_CMD compose up --detach

# Wait for Supabase Studio to be healthy
info "Waiting for Supabase Studio to be ready..."
for i in $(seq 1 36); do
  if curl -sf "http://localhost:$SUPABASE_PORT" >/dev/null 2>&1; then
    break
  fi
  echo -n "."
  sleep 5
done
echo ""
success "Supabase running at http://localhost:$SUPABASE_PORT"

# Apply DB schema via docker exec
info "Applying database schema..."
SCHEMA_FILE="$VITCAM_DIR/server/dbschema.sql"

if [[ ! -f "$SCHEMA_FILE" ]]; then
  warn "Schema file not found at $SCHEMA_FILE"
  warn "Open http://localhost:$SUPABASE_PORT → SQL Editor and run server/dbschema.sql manually."
else
  DB_CONTAINER=$($DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null | grep -i "supabase-db\|supabase_db" | head -1 || echo "supabase-db")
  info "Using postgres container: $DB_CONTAINER"
  if $DOCKER_CMD exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SCHEMA_FILE" 2>/dev/null; then
    success "Database schema applied."
  else
    warn "Could not auto-apply schema."
    warn "Open http://localhost:$SUPABASE_PORT → SQL Editor and run server/dbschema.sql manually."
  fi
fi

# ── .env reminder ─────────────────────────────────────────────────────────────
header "Step 6 / 9 — Configure .env files"

echo ""
echo -e "${YELLOW}  ACTION REQUIRED — Set your Supabase keys in the .env files:${RESET}"
echo -e "  ----------------------------------------------------------------"
echo -e "  1. Open Supabase Studio → Project Settings → API:"
echo -e "     ${CYAN}http://localhost:$SUPABASE_PORT${RESET}"
echo -e "     Copy the URL and anon public key"
echo ""
echo -e "  2. Edit and update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY:"
echo -e "     ${CYAN}$VITCAM_DIR/frontend/.env${RESET}"
echo ""
echo -e "  3. Edit and update SUPABASE_URL and SUPABASE_KEY:"
echo -e "     ${CYAN}$VITCAM_DIR/server/.env${RESET}"
echo ""
echo -e "${YELLOW}  Press ENTER once you have updated both .env files...${RESET}"
read -r

success ".env configuration step complete."

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
  export PYENV_ROOT="$HOME/.pyenv"
  export PATH="$PYENV_ROOT/bin:$PATH"
fi

eval "$(pyenv init -)" 2>/dev/null || true
eval "$(pyenv virtualenv-init -)" 2>/dev/null || true

if ! pyenv versions 2>/dev/null | grep -q "$PYTHON_VERSION"; then
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
echo -e "  Supabase:        ${BOLD}cd $VITCAM_DIR/supabase/docker && $DOCKER_CMD compose ps${RESET}"
echo ""
if [[ "$DOCKER_CMD" == "sudo docker" ]]; then
  echo -e "${YELLOW}  NOTE: Log out and back in (or run 'sudo reboot') to activate the"
  echo -e "  docker group so future docker commands work without sudo.${RESET}"
  echo ""
fi
