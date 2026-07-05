#!/usr/bin/env bash
# =============================================================================
#  VitCam -- Ubuntu / Debian Installer
#  Run as ROOT: sudo bash setup/install-linux.sh
#  Tested on Ubuntu 22.04 / 24.04 LTS and Debian 12 (Bookworm)
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

# Resolve the user who will own VitCam files and run the services
# SUDO_USER is set when running via sudo; fall back to whoami
RUN_AS="${SUDO_USER:-$(whoami)}"
RUN_HOME=$(eval echo "~$RUN_AS")

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VitCam]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[X]${RESET} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}== $* ==${RESET}\n"; }

# Run a command as the non-root user
as_user() { su - "$RUN_AS" -c "$*"; }

# -- Preflight ----------------------------------------------------------------
header "VitCam Installer -- Ubuntu / Debian"

if [[ $EUID -ne 0 ]]; then
  error "Please run as root: sudo bash setup/install-linux.sh"
fi

info "Installing as root, services will run as: $RUN_AS"
info "VitCam directory: $VITCAM_DIR"

# -- Step 1 / 9: System dependencies ------------------------------------------
header "Step 1 / 9 -- System dependencies"

apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  git curl wget build-essential libssl-dev zlib1g-dev libbz2-dev \
  libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
  xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
  ffmpeg libgl1 libglib2.0-0 nginx

success "System dependencies installed."

# -- Step 2 / 9: NVIDIA CUDA (auto-detected) ----------------------------------
header "Step 2 / 9 -- NVIDIA CUDA"

CUDA_INSTALLED=false
GPU_FOUND=false

if lspci 2>/dev/null | grep -qi "nvidia" || lshw -C display 2>/dev/null | grep -qi "nvidia"; then
  GPU_FOUND=true
fi

if $GPU_FOUND; then
  info "NVIDIA GPU detected."
  if command -v nvcc >/dev/null 2>&1; then
    CUDA_INSTALLED=true
    success "CUDA already installed: $(nvcc --version | grep release | awk '{print $5}' | tr -d ',')"
  else
    info "Installing NVIDIA CUDA drivers and toolkit..."
    OS_ID=$(. /etc/os-release && echo "$ID")
    OS_VERSION=$(. /etc/os-release && echo "$VERSION_ID" | tr -d '.')
    if [[ "$OS_ID" == "ubuntu" ]]; then
      wget -q "https://developer.download.nvidia.com/compute/cuda/repos/ubuntu${OS_VERSION}/x86_64/cuda-keyring_1.1-1_all.deb" \
        -O /tmp/cuda-keyring.deb 2>/dev/null || \
      wget -q "https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb" \
        -O /tmp/cuda-keyring.deb
      dpkg -i /tmp/cuda-keyring.deb
      apt-get update -qq
      apt-get install -y -qq cuda-drivers cuda-toolkit-12-8
      CUDA_INSTALLED=true
      success "NVIDIA CUDA drivers and toolkit installed."
      warn "A reboot is recommended after install to fully activate the NVIDIA driver."
    elif [[ "$OS_ID" == "debian" ]]; then
      apt-get install -y -qq nvidia-driver firmware-misc-nonfree
      CUDA_INSTALLED=true
      success "NVIDIA drivers installed (Debian)."
    else
      warn "Unsupported OS for auto CUDA: $OS_ID -- install CUDA manually from https://developer.nvidia.com/cuda-downloads"
    fi
  fi
  if $CUDA_INSTALLED && command -v nvidia-smi >/dev/null 2>&1; then
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null | \
      while IFS=',' read -r name driver mem; do
        echo -e "  ${GREEN}GPU:${RESET} $name | Driver: $driver | VRAM: $mem"
      done
  fi
else
  warn "No NVIDIA GPU detected -- VitCam will run in CPU inference mode."
fi

success "GPU/CPU setup complete."

# -- Step 3 / 9: Docker -------------------------------------------------------
header "Step 3 / 9 -- Docker Engine"

# Detect if running inside a Docker container
IN_CONTAINER=false
if [[ -f /.dockerenv ]] || grep -qa 'docker\|lxc\|containerd' /proc/1/cgroup 2>/dev/null; then
  IN_CONTAINER=true
  warn "Running inside a container."
fi

# Install Docker Engine (or CLI only if inside container)
if ! command -v docker >/dev/null; then
  if $IN_CONTAINER; then
    info "Installing Docker CLI to connect to host daemon..."
    apt-get install -y -qq docker.io
  else
    info "Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
  fi
else
  success "Docker already installed: $(docker --version)"
fi

# Set DOCKER_HOST explicitly so all docker commands use the correct socket
# This works both inside containers and on native hosts
export DOCKER_HOST="unix:///var/run/docker.sock"

if $IN_CONTAINER; then
  # Fix socket permissions from inside the container
  if [[ -S /var/run/docker.sock ]]; then
    chmod 666 /var/run/docker.sock 2>/dev/null || true
  fi
  # Test connection
  if ! DOCKER_HOST="unix:///var/run/docker.sock" docker info >/dev/null 2>&1; then
    echo ""
    echo -e "${RED}[X] Cannot connect to host Docker socket.${RESET}"
    echo -e "    Run this on the HOST machine then re-run the installer:"
    echo -e "      ${BOLD}chmod 666 /var/run/docker.sock${RESET}"
    echo ""
    exit 1
  fi
  success "Docker connected via host socket."
else
  # Native host: start daemon and wait
  usermod -aG docker "$RUN_AS" 2>/dev/null || true
  systemctl enable docker 2>/dev/null || true
  systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true

  info "Waiting for Docker daemon..."
  for i in $(seq 1 20); do
    docker info >/dev/null 2>&1 && break
    echo -n "."
    sleep 3
  done
  echo ""
  docker info >/dev/null 2>&1 ||     error "Docker daemon did not start. Check: journalctl -u docker --no-pager | tail -20"
fi

success "Docker $(docker --version) ready."

# -- Step 4 / 9: Node.js ------------------------------------------------------
header "Step 4 / 9 -- Node.js"

if ! command -v node >/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
success "Node.js $(node -v) ready."

# -- Step 5 / 9: Supabase via Docker ------------------------------------------
header "Step 5 / 9 -- Supabase (Docker)"

SUPABASE_DOCKER_DIR="$VITCAM_DIR/supabase/docker"

if [[ ! -d "$VITCAM_DIR/supabase" ]]; then
  info "Cloning Supabase self-hosted stack..."
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
fi

if [[ ! -d "$SUPABASE_DOCKER_DIR" ]]; then
  warn "Supabase docker directory missing -- re-cloning..."
  rm -rf "$VITCAM_DIR/supabase"
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
fi

cd "$SUPABASE_DOCKER_DIR"

if [[ ! -f ".env" ]]; then
  [[ -f ".env.example" ]] || error ".env.example not found -- delete $VITCAM_DIR/supabase and re-run."
  cp .env.example .env
  info "Copied .env.example -> .env"
fi

# Create volume directories
mkdir -p volumes/db/data volumes/storage volumes/functions volumes/logs
chown -R "$RUN_AS":"$RUN_AS" volumes/

info "Pulling latest Supabase images..."
docker compose pull

info "Starting Supabase containers..."
docker compose up --detach

# Wait for Supabase Studio
info "Waiting for Supabase Studio..."
for i in $(seq 1 36); do
  curl -sf "http://localhost:$SUPABASE_PORT" >/dev/null 2>&1 && break
  echo -n "."
  sleep 5
done
echo ""
success "Supabase running at http://localhost:$SUPABASE_PORT"

# Apply DB schema
SCHEMA_FILE="$VITCAM_DIR/server/dbschema.sql"
if [[ -f "$SCHEMA_FILE" ]]; then
  info "Applying database schema..."
  DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i "supabase-db\|supabase_db" | head -1 || echo "supabase-db")
  if docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SCHEMA_FILE" 2>/dev/null; then
    success "Database schema applied."
  else
    warn "Could not auto-apply schema -- do it manually in Supabase Studio -> SQL Editor."
  fi
else
  warn "Schema file not found at $SCHEMA_FILE -- apply it manually in Supabase Studio."
fi

# -- Step 6 / 9: Configure .env -----------------------------------------------
header "Step 6 / 9 -- Configure .env files"

echo ""
echo -e "${YELLOW}  ACTION REQUIRED -- Configure Supabase and update .env files:${RESET}"
echo -e "  ----------------------------------------------------------------"
echo -e "  1. Open Supabase Studio: ${CYAN}http://localhost:$SUPABASE_PORT${RESET}"
echo -e "     Login -- Username: supabase"
echo -e "     Password: this_password_is_insecure_and_should_be_updated"
echo -e "     ${YELLOW}NOTE: Do NOT change this password${RESET}"
echo ""
echo -e "  2. Authentication -> Users -> Add User (enable Auto Confirm)"
echo ""
echo -e "  3. Project Settings -> API -> copy URL and anon key"
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

# -- Step 7 / 9: Python / pyenv -----------------------------------------------
header "Step 7 / 9 -- Python $PYTHON_VERSION (pyenv)"

export PYENV_ROOT="$RUN_HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

if [[ ! -d "$PYENV_ROOT" ]]; then
  info "Installing pyenv..."
  su - "$RUN_AS" -c 'curl -fsSL https://pyenv.run | bash'
fi

# Run pyenv operations as the target user
su - "$RUN_AS" -c "
  export PYENV_ROOT=\"$RUN_HOME/.pyenv\"
  export PATH=\"\$PYENV_ROOT/bin:\$PATH\"
  eval \"\$(pyenv init -)\" 2>/dev/null || true

  if ! pyenv versions 2>/dev/null | grep -q '$PYTHON_VERSION'; then
    echo '[VitCam] Installing Python $PYTHON_VERSION...'
    pyenv install '$PYTHON_VERSION'
  fi
  pyenv global '$PYTHON_VERSION'
  echo '[OK] Python version: '\$(python --version)
"

# Persist pyenv in .bashrc
BASHRC="$RUN_HOME/.bashrc"
if ! grep -q 'pyenv init' "$BASHRC" 2>/dev/null; then
  cat >> "$BASHRC" << 'PYENVRC'
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
PYENVRC
fi
chown "$RUN_AS":"$RUN_AS" "$BASHRC"
success "Python $PYTHON_VERSION ready."

# -- Step 8 / 9: Backend dependencies -----------------------------------------
header "Step 8 / 9 -- Backend dependencies"

su - "$RUN_AS" -c "
  export PYENV_ROOT=\"$RUN_HOME/.pyenv\"
  export PATH=\"\$PYENV_ROOT/bin:\$PATH\"
  eval \"\$(pyenv init -)\" 2>/dev/null || true
  cd '$VITCAM_DIR/server'
  pip install -q -r requirements.txt
"
success "Backend dependencies installed."

# -- Step 9 / 9: Frontend + nginx + systemd -----------------------------------
header "Step 9 / 9 -- Frontend, nginx & systemd services"

# Build frontend as the run-as user
su - "$RUN_AS" -c "
  cd '$VITCAM_DIR/frontend'
  npm install --silent
  npm run build
"
success "Frontend built."

# Fix ownership of entire VitCam directory
chown -R "$RUN_AS":"$RUN_AS" "$VITCAM_DIR"

# nginx config
cat > /etc/nginx/sites-available/vitcam << NGINXCONF
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

ln -sf /etc/nginx/sites-available/vitcam /etc/nginx/sites-enabled/vitcam
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx && systemctl enable nginx
success "nginx configured -- frontend proxied on port 80."

# Resolve absolute paths for systemd units
NPM_BIN=$(which npm)
PYTHON_BIN="$RUN_HOME/.pyenv/versions/$PYTHON_VERSION/bin/python"

# Frontend systemd service
cat > /etc/systemd/system/vitcam-frontend.service << SVCEOF
[Unit]
Description=VitCam Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=$RUN_AS
WorkingDirectory=$VITCAM_DIR/frontend
ExecStart=$NPM_BIN start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$FRONTEND_PORT

[Install]
WantedBy=multi-user.target
SVCEOF

# Backend systemd service
cat > /etc/systemd/system/vitcam-server.service << SVCEOF
[Unit]
Description=VitCam Camera Server (FastAPI)
After=network.target

[Service]
Type=simple
User=$RUN_AS
WorkingDirectory=$VITCAM_DIR/server
ExecStart=$PYTHON_BIN main.py
Restart=on-failure
RestartSec=5
EnvironmentFile=$VITCAM_DIR/server/.env

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable vitcam-frontend vitcam-server
systemctl restart vitcam-frontend vitcam-server
success "vitcam-frontend and vitcam-server services started."

# -- Done ---------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  VitCam installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
HOST_IP=$(hostname -I | awk '{print $1}')
$GPU_FOUND && $CUDA_INSTALLED && \
  echo -e "  Inference mode:  ${GREEN}GPU (CUDA)${RESET}" || \
  echo -e "  Inference mode:  ${YELLOW}CPU only${RESET}"
echo -e "  Frontend:        ${CYAN}http://${HOST_IP}${RESET}  (port 80 via nginx)"
echo -e "  Frontend direct: ${CYAN}http://localhost:${FRONTEND_PORT}${RESET}"
echo -e "  Backend API:     ${CYAN}http://localhost:${SERVER_PORT}${RESET}"
echo -e "  Supabase Studio: ${CYAN}http://localhost:${SUPABASE_PORT}${RESET}"
echo ""
echo -e "  Service commands:"
echo -e "    ${BOLD}systemctl status vitcam-frontend${RESET}"
echo -e "    ${BOLD}systemctl status vitcam-server${RESET}"
echo -e "    ${BOLD}journalctl -u vitcam-server -f${RESET}    (live server logs)"
echo -e "    ${BOLD}journalctl -u vitcam-frontend -f${RESET}  (live frontend logs)"
echo -e "    ${BOLD}systemctl restart vitcam-server${RESET}"
echo ""
echo -e "  Supabase:  ${BOLD}cd $VITCAM_DIR/supabase/docker && docker compose ps${RESET}"
echo -e "  nginx:     ${BOLD}systemctl status nginx${RESET} | ${BOLD}nginx -t${RESET}"
echo ""