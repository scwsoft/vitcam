#!/usr/bin/env bash
# =============================================================================
#  VitCam — Raspberry Pi Installer
#  Tested on Raspberry Pi 4B / 5 — Raspberry Pi OS 64-bit (Debian Bookworm)
#  CPU inference only (no CUDA). Supabase via Docker.
#  Run as a normal user with sudo access:
#    chmod +x setup/install-raspberry-pi.sh
#    ./setup/install-raspberry-pi.sh
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

# Resolve current user safely
CURRENT_USER="${SUDO_USER:-$(whoami)}"

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
info "Running as: $CURRENT_USER"

# ── Step 1 / 9 — System update & dependencies ─────────────────────────────────
header "Step 1 / 9 — System update & dependencies"

sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq \
  git curl wget build-essential libssl-dev zlib1g-dev libbz2-dev \
  libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
  xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
  ffmpeg libgl1 libglib2.0-0 nginx

success "System dependencies installed."

# ── Step 2 / 9 — Docker Engine ────────────────────────────────────────────────
header "Step 2 / 9 — Docker Engine"

if ! command -v docker >/dev/null; then
  info "Installing Docker Engine..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
else
  success "Docker already installed: $(docker --version)"
fi

# Add user to docker group
if ! groups "$CURRENT_USER" | grep -q docker; then
  sudo usermod -aG docker "$CURRENT_USER"
  warn "Added $CURRENT_USER to docker group."
fi

# Activate group in current session
newgrp docker 2>/dev/null || true

sudo systemctl start docker
sudo systemctl enable docker

# Use sudo if group not yet active in this session
if ! docker info >/dev/null 2>&1; then
  warn "Docker group not active yet — using sudo for docker commands."
  DOCKER_CMD="sudo docker"
else
  DOCKER_CMD="docker"
fi

success "Docker Engine ready."

# ── Step 3 / 9 — Node.js ──────────────────────────────────────────────────────
header "Step 3 / 9 — Node.js"

if ! command -v node >/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
success "Node.js $(node -v) ready."

# ── Step 4 / 9 — Clone VitCam ─────────────────────────────────────────────────
header "Step 4 / 9 — Clone VitCam"

if [[ -d "$VITCAM_DIR/.git" ]]; then
  info "Repository already exists — pulling latest changes."
  git -C "$VITCAM_DIR" pull
else
  git clone "$REPO" "$VITCAM_DIR" 2>/dev/null || info "Using existing directory at $VITCAM_DIR."
fi
success "Repository ready at $VITCAM_DIR."

# ── Step 5 / 9 — Supabase (Docker) ────────────────────────────────────────────
header "Step 5 / 9 — Supabase (Docker)"

SUPABASE_DOCKER_DIR="$VITCAM_DIR/supabase/docker"

# Clone Supabase self-hosted stack
if [[ ! -d "$VITCAM_DIR/supabase" ]]; then
  info "Cloning Supabase self-hosted stack..."
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
elif [[ ! -d "$SUPABASE_DOCKER_DIR" ]]; then
  warn "Supabase docker directory missing — re-cloning..."
  rm -rf "$VITCAM_DIR/supabase"
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
else
  info "Supabase already cloned."
fi

# cd supabase/docker
cd "$SUPABASE_DOCKER_DIR"
info "Working directory: $(pwd)"

# cp .env.example .env
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    info "Copied .env.example → .env"
  else
    error ".env.example not found — try deleting $VITCAM_DIR/supabase and re-running."
  fi
else
  info ".env already exists — skipping copy."
fi

# Create required volume directories
info "Creating Supabase storage directories..."
sudo mkdir -p volumes/db/data volumes/storage volumes/functions volumes/logs
sudo chown -R "$CURRENT_USER":"$CURRENT_USER" volumes/
success "Storage directories ready."

# docker compose up --detach
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
  warn "Apply manually: Supabase Studio → SQL Editor → run server/dbschema.sql"
else
  DB_CONTAINER=$($DOCKER_CMD ps --format '{{.Names}}' 2>/dev/null \
    | grep -i "supabase-db\|supabase_db" | head -1 || echo "supabase-db")
  info "Using postgres container: $DB_CONTAINER"
  if $DOCKER_CMD exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SCHEMA_FILE" 2>/dev/null; then
    success "Database schema applied."
  else
    warn "Could not auto-apply schema."
    warn "Apply manually: Supabase Studio → SQL Editor → run server/dbschema.sql"
  fi
fi

# ── Step 6 / 9 — Configure .env files ─────────────────────────────────────────
header "Step 6 / 9 — Configure .env files"

echo ""
echo -e "${YELLOW}  ACTION REQUIRED — Configure Supabase and update .env files:${RESET}"
echo -e "  ----------------------------------------------------------------"
echo -e "  1. Open Supabase Studio: ${CYAN}http://localhost:$SUPABASE_PORT${RESET}"
echo -e "     Login — Username: ${BOLD}supabase${RESET}"
echo -e "     Password: ${BOLD}this_password_is_insecure_and_should_be_updated${RESET}"
echo -e "     ${YELLOW}NOTE: Do NOT change this password${RESET}"
echo ""
echo -e "  2. Authentication → Users → Add User (enable Auto Confirm)"
echo ""
echo -e "  3. Project Settings → API → copy URL and anon key"
echo ""
echo -e "  4. Edit: ${CYAN}$VITCAM_DIR/frontend/.env${RESET}"
echo -e "     Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo ""
echo -e "  5. Edit: ${CYAN}$VITCAM_DIR/server/.env${RESET}"
echo -e "     Set SUPABASE_URL and SUPABASE_KEY"
echo ""
echo -e "${YELLOW}  Press ENTER when done...${RESET}"
read -r
success ".env configuration done."

# ── Step 7 / 9 — Frontend ─────────────────────────────────────────────────────
header "Step 7 / 9 — Frontend"

cd "$VITCAM_DIR/frontend"
npm install --silent
npm run build
success "Frontend built."

# ── Step 8 / 9 — Python / pyenv ───────────────────────────────────────────────
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

# ── Step 9 / 9 — Backend, nginx & systemd ────────────────────────────────────
header "Step 9 / 9 — Backend dependencies, nginx & systemd"

cd "$VITCAM_DIR/server"
pip install -q -r requirements.txt
success "Backend dependencies installed."

# ── Coral USB TPU support ─────────────────────────────────────────────────────
header "Coral USB TPU Setup"

info "Adding Google Coral Edge TPU package repository..."
echo "deb https://packages.cloud.google.com/apt coral-edgetpu-stable main" \
  | sudo tee /etc/apt/sources.list.d/coral-edgetpu.list

curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
  | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/google-coral-edgetpu.gpg

# Modernise apt sources to avoid deprecated key warnings
sudo apt modernize-sources 2>/dev/null || true
sudo apt-get update -qq

# Install Edge TPU runtime
# libedgetpu1-std  = standard clock speed (cooler, recommended for most use)
# libedgetpu1-max  = maximum clock speed (faster, runs hot — use with active cooling)
info "Installing Edge TPU runtime (standard clock speed)..."
sudo apt-get install -y libedgetpu1-std
info "Installing Edge TPU runtime (max clock speed)..."
sudo apt-get install -y libedgetpu1-max
success "Edge TPU runtime installed."

# Check if Coral USB TPU is connected
info "Checking for Coral USB TPU device..."
if lsusb | grep -qE "1a6e:089a|18d1:9302"; then
  success "Coral USB TPU detected: $(lsusb | grep -E '1a6e:089a|18d1:9302')"
else
  warn "Coral USB TPU not detected. Plug in the device and check with: lsusb"
  warn "Expected device ID: 1a6e:089a or 18d1:9302 (Global Unichip or Google)"
fi

# Install Python dependencies for Coral / TFLite inference
info "Installing tflite-runtime and ultralytics..."
pip uninstall -y tensorflow tensorflow-aarch64 2>/dev/null || true
pip install -U tflite-runtime
pip install ultralytics
success "Coral TPU Python dependencies installed."

# ── nginx ─────────────────────────────────────────────────────────────────────
sudo tee /etc/nginx/sites-available/vitcam > /dev/null << NGINXCONF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/server/ {
        proxy_pass http://127.0.0.1:${SERVER_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
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
NPM_BIN="$(which npm)"

sudo tee /etc/systemd/system/vitcam-frontend.service > /dev/null << SVCCONF
[Unit]
Description=VitCam Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
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
PYTHON_BIN="$(pyenv which python)"

sudo tee /etc/systemd/system/vitcam-server.service > /dev/null << SVCCONF
[Unit]
Description=VitCam Camera Server (FastAPI)
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
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
echo -e "  Inference mode:  ${YELLOW}CPU + Coral USB TPU (if connected)${RESET}"
echo -e "  Frontend:        ${CYAN}http://${RPI_IP}${RESET}  (port 80 via nginx)"
echo -e "  Frontend direct: ${CYAN}http://localhost:${FRONTEND_PORT}${RESET}"
echo -e "  Backend API:     ${CYAN}http://localhost:${SERVER_PORT}${RESET}"
echo -e "  Supabase Studio: ${CYAN}http://localhost:${SUPABASE_PORT}${RESET}"
echo ""
echo -e "${YELLOW}  Next steps:${RESET}"
echo -e "  1. Open Supabase Studio → Authentication → Users"
echo -e "     and confirm your login user was created"
echo -e "  2. Open ${CYAN}http://${RPI_IP}${RESET} from any device on your network"
echo -e "  3. Coral USB TPU: plug in the device and verify with: ${BOLD}lsusb | grep -E '1a6e|18d1'${RESET}"
echo ""
echo -e "  Service commands:"
echo -e "    ${BOLD}sudo systemctl status vitcam-frontend${RESET}"
echo -e "    ${BOLD}sudo systemctl status vitcam-server${RESET}"
echo -e "    ${BOLD}sudo journalctl -u vitcam-server -f${RESET}     (live server logs)"
echo -e "    ${BOLD}sudo journalctl -u vitcam-frontend -f${RESET}   (live frontend logs)"
echo -e "    ${BOLD}sudo systemctl restart vitcam-server${RESET}"
echo ""
echo -e "  Supabase:  ${BOLD}cd $VITCAM_DIR/supabase/docker && $DOCKER_CMD compose ps${RESET}"
echo -e "  nginx:     ${BOLD}sudo systemctl status nginx${RESET} | ${BOLD}sudo nginx -t${RESET}"
echo ""
