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

# Verify the docker folder exists inside the cloned repo
if [[ ! -d "$SUPABASE_DOCKER_DIR" ]]; then
  warn "Supabase docker directory not found — the previous clone may be incomplete."
  warn "Removing and re-cloning..."
  rm -rf "$VITCAM_DIR/supabase"
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
fi

cd "$SUPABASE_DOCKER_DIR"

# Copy .env.example only if .env doesn't exist yet
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    info "Copied .env.example → .env"
  else
    error ".env.example not found in $SUPABASE_DOCKER_DIR — try deleting $VITCAM_DIR/supabase and re-running."
  fi
fi

# Create required volume directories with correct ownership for Docker
info "Creating Supabase storage directories..."
sudo mkdir -p volumes/db/data
sudo mkdir -p volumes/storage
sudo mkdir -p volumes/functions
sudo mkdir -p volumes/logs
sudo chown -R "$USER":"$USER" volumes/
success "Storage directories ready."

# Always use sudo for docker compose to avoid socket permission issues
info "Pulling latest Supabase images..."
sudo docker compose pull

info "Starting Supabase containers (first run may take several minutes)..."
sudo docker compose up --detach

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

# Apply DB schema via sudo docker exec
info "Applying database schema..."
SCHEMA_FILE="$VITCAM_DIR/server/dbschema.sql"

if [[ ! -f "$SCHEMA_FILE" ]]; then
  warn "Schema file not found at $SCHEMA_FILE"
  warn "Open http://localhost:$SUPABASE_PORT → SQL Editor and run server/dbschema.sql manually."
else
  DB_CONTAINER=$(sudo docker ps --format '{{.Names}}' 2>/dev/null | grep -i "supabase-db\|supabase_db" | head -1 || echo "supabase-db")
  info "Using postgres container: $DB_CONTAINER"
  if sudo docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SCHEMA_FILE" 2>/dev/null; then
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
header "Step 9 / 9 — Backend dependencies, nginx & systemd"

cd "$VITCAM_DIR/server"
pip install -q -r requirements.txt
success "Backend dependencies installed."

# ── nginx ─────────────────────────────────────────────────────────────────────
header "Deploying Frontend — nginx"

sudo apt-get install -y -qq nginx

# Write nginx config to proxy Next.js
sudo tee /etc/nginx/sites-available/vitcam > /dev/null << NGINXCONF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/server/ {
        proxy_pass http://127.0.0.1:${SERVER_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINXCONF

sudo ln -sf /etc/nginx/sites-available/vitcam /etc/nginx/sites-enabled/vitcam
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable nginx
success "nginx configured — frontend proxied on port 80."

# ── Frontend systemd service ──────────────────────────────────────────────────
header "Deploying Frontend — systemd service"

NPM_BIN="$(which npm)"

sudo tee /etc/systemd/system/vitcam-frontend.service > /dev/null << SVCCONF
[Unit]
Description=VitCam Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${VITCAM_DIR}/frontend
ExecStart=${NPM_BIN} start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${FRONTEND_PORT}

[Install]
WantedBy=multi-user.target
SVCCONF

sudo systemctl daemon-reload
sudo systemctl enable vitcam-frontend
sudo systemctl restart vitcam-frontend
success "vitcam-frontend service enabled and started."

# ── Backend systemd service ───────────────────────────────────────────────────
header "Deploying Backend — systemd service"

PYTHON_BIN="$(pyenv which python)"

sudo tee /etc/systemd/system/vitcam-server.service > /dev/null << SVCCONF
[Unit]
Description=VitCam Camera Server (FastAPI)
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${VITCAM_DIR}/server
ExecStart=${PYTHON_BIN} main.py
Restart=on-failure
RestartSec=5
EnvironmentFile=${VITCAM_DIR}/server/.env

[Install]
WantedBy=multi-user.target
SVCCONF

sudo systemctl daemon-reload
sudo systemctl enable vitcam-server
sudo systemctl restart vitcam-server
success "vitcam-server service enabled and started."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  VitCam installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
RPI_IP=$(hostname -I | awk '{print $1}')
echo -e "  Frontend:        ${CYAN}http://${RPI_IP}${RESET}  (port 80 via nginx)"
echo -e "  Frontend direct: ${CYAN}http://localhost:${FRONTEND_PORT}${RESET}"
echo -e "  Backend API:     ${CYAN}http://localhost:${SERVER_PORT}${RESET}"
echo -e "  Supabase Studio: ${CYAN}http://localhost:${SUPABASE_PORT}${RESET}"
echo ""
echo -e "${YELLOW}  Next steps:${RESET}"
echo -e "  1. Open Supabase Studio → Authentication → Users"
echo -e "     and add your first login user (enable Auto Confirm)"
echo -e "  2. Open ${CYAN}http://${RPI_IP}${RESET} from any device on your network"
echo ""
echo -e "  Service commands:"
echo -e "    ${BOLD}sudo systemctl status vitcam-frontend${RESET}"
echo -e "    ${BOLD}sudo systemctl status vitcam-server${RESET}"
echo -e "    ${BOLD}sudo journalctl -u vitcam-server -f${RESET}     (live server logs)"
echo -e "    ${BOLD}sudo journalctl -u vitcam-frontend -f${RESET}   (live frontend logs)"
echo -e "    ${BOLD}sudo systemctl restart vitcam-server${RESET}"
echo ""
echo -e "  Supabase:  ${BOLD}cd $VITCAM_DIR/supabase/docker && sudo docker compose ps${RESET}"
echo -e "  nginx:     ${BOLD}sudo systemctl status nginx${RESET} | ${BOLD}sudo nginx -t${RESET}"
echo ""

