#!/usr/bin/env bash
# =============================================================================
#  VitCam -- Ubuntu / Debian Installer
#  Tested on Ubuntu 22.04 / 24.04 LTS and Debian 12 (Bookworm)
#  Deploys frontend via nginx + systemd, backend via systemd
#  Installs NVIDIA CUDA drivers when a supported GPU is detected
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

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VitCam]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[X]${RESET} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}== $* ==${RESET}\n"; }

# -- Preflight ----------------------------------------------------------------
header "VitCam Installer -- Ubuntu / Debian"

if [[ $EUID -eq 0 ]]; then
  error "Do not run as root. Run as a normal user with sudo access. See setup/create-user.sh to create one."
fi

# Check sudo is available and current user has sudo privileges
if ! command -v sudo >/dev/null; then
  echo -e "${RED}[X]${RESET} sudo is not installed or not on PATH."
  echo ""
  echo -e "  Log in as root and run the following to set up a sudo user:"
  echo -e "    ${BOLD}bash setup/create-user.sh <username>${RESET}"
  echo -e "  Then log in as that user and re-run this installer."
  exit 1
fi

if ! sudo -n true 2>/dev/null; then
  echo -e "${RED}[X]${RESET} Current user '${USER}' does not have sudo privileges."
  echo ""
  echo -e "  Log in as root and run the following to grant sudo access:"
  echo -e "    ${BOLD}bash setup/create-user.sh <username>${RESET}"
  echo -e "  Then log in as that user and re-run this installer."
  exit 1
fi

info "VitCam directory: $VITCAM_DIR"

# -- Step 1: System dependencies ----------------------------------------------
header "Step 1 / 10 -- System dependencies"

sudo apt update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq \
  git curl wget build-essential libssl-dev zlib1g-dev libbz2-dev \
  libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
  xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
  ffmpeg libgl1 libglib2.0-0 nginx

success "System dependencies installed."
# -- Step 2: NVIDIA CUDA (auto-detected) --------------------------------------
header "Step 2 / 10 -- NVIDIA CUDA"

CUDA_INSTALLED=false
GPU_FOUND=false

# Detect NVIDIA GPU
if lspci 2>/dev/null | grep -qi "nvidia" || lshw -C display 2>/dev/null | grep -qi "nvidia"; then
  GPU_FOUND=true
fi

if $GPU_FOUND; then
  info "NVIDIA GPU detected."

  # Check if CUDA is already installed
  if command -v nvcc >/dev/null 2>&1; then
    CUDA_INSTALLED=true
    success "CUDA already installed: $(nvcc --version | grep release | awk '{print $5}' | tr -d ',')"
  else
    info "Installing NVIDIA CUDA drivers and toolkit..."

    # Detect Ubuntu version for correct repo
    OS_ID=$(. /etc/os-release && echo "$ID")
    OS_VERSION=$(. /etc/os-release && echo "$VERSION_ID" | tr -d '.')

    if [[ "$OS_ID" == "ubuntu" ]]; then
      # Add NVIDIA package repository
      wget -q https://developer.download.nvidia.com/compute/cuda/repos/ubuntu${OS_VERSION}/x86_64/cuda-keyring_1.1-1_all.deb         -O /tmp/cuda-keyring.deb 2>/dev/null         || wget -q https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb         -O /tmp/cuda-keyring.deb

      sudo dpkg -i /tmp/cuda-keyring.deb
      sudo apt-get update -qq
      sudo apt-get install -y -qq cuda-drivers cuda-toolkit-12-8
      CUDA_INSTALLED=true
      success "NVIDIA CUDA drivers and toolkit installed."
      warn "A reboot is recommended after install to fully activate the NVIDIA driver."

    elif [[ "$OS_ID" == "debian" ]]; then
      # Debian: install via apt non-free drivers
      sudo apt-get install -y -qq nvidia-driver firmware-misc-nonfree
      CUDA_INSTALLED=true
      success "NVIDIA drivers installed (Debian)."
      warn "CUDA toolkit on Debian may need manual setup — see https://developer.nvidia.com/cuda-downloads"
    else
      warn "Unsupported OS for auto CUDA install: $OS_ID. Install CUDA manually from https://developer.nvidia.com/cuda-downloads"
    fi
  fi

  # Verify GPU is accessible
  if $CUDA_INSTALLED && command -v nvidia-smi >/dev/null 2>&1; then
    echo ""
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null       | while IFS=',' read -r name driver mem; do
          echo -e "  ${GREEN}GPU:${RESET} $name | Driver: $driver | VRAM: $mem"
        done
    echo ""
  fi

else
  warn "No NVIDIA GPU detected -- VitCam will run in CPU inference mode."
  warn "AI detection will work but performance is limited to 1-2 cameras."
  CUDA_INSTALLED=false
fi

success "GPU/CPU setup complete. CUDA installed: $CUDA_INSTALLED"

# -- Step 3: Docker -----------------------------------------------------------
header "Step 3 / 10 -- Docker Engine"

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

# Detect init system -- systemd not available in WSL2 or containers
if [[ -d /run/systemd/system ]] && systemctl is-system-running --quiet 2>/dev/null; then
  # Full systemd available (native Ubuntu server or desktop)
  sudo systemctl start docker
  sudo systemctl enable docker
  success "Docker service started and enabled via systemd."
elif command -v service >/dev/null 2>&1; then
  # SysV init fallback (WSL1, some minimal installs)
  sudo service docker start || true
  success "Docker service started via SysV init."
else
  # No init system (WSL2 without systemd, Docker-in-Docker)
  # Start dockerd directly in background if not already running
  if ! sudo docker info >/dev/null 2>&1; then
    warn "No init system detected -- starting dockerd directly..."
    sudo dockerd > /tmp/dockerd.log 2>&1 &
    sleep 5
  fi
fi

# Verify docker is accessible
if ! sudo docker info >/dev/null 2>&1; then
  warn "Docker socket not accessible. If running in WSL2, enable systemd in /etc/wsl.conf:"
  warn "  [boot]"
  warn "  systemd=true"
  warn "Then restart WSL2 with: wsl --shutdown"
fi

# Always use sudo for docker to avoid socket permission issues
# (group membership may not be active in current session)
success "Docker $(sudo docker --version) ready."

# -- Step 3: Node.js ----------------------------------------------------------
header "Step 4 / 10 -- Node.js"

if ! command -v node >/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
success "Node.js $(node -v) ready."

# -- Step 4: Clone VitCam -----------------------------------------------------
header "Step 5 / 10 -- Clone VitCam"

if [[ -d "$VITCAM_DIR/.git" ]]; then
  info "Repository already exists -- pulling latest changes."
  git -C "$VITCAM_DIR" pull
else
  git clone "$REPO" "$VITCAM_DIR" 2>/dev/null || info "Using existing directory at $VITCAM_DIR."
fi
success "Repository ready at $VITCAM_DIR."

# -- Step 5: Supabase via Docker ----------------------------------------------
header "Step 6 / 10 -- Supabase (Docker)"

SUPABASE_DOCKER_DIR="$VITCAM_DIR/supabase/docker"

if [[ ! -d "$VITCAM_DIR/supabase" ]]; then
  info "Cloning Supabase self-hosted stack..."
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
fi

# Verify docker subfolder exists -- re-clone if incomplete
if [[ ! -d "$SUPABASE_DOCKER_DIR" ]]; then
  warn "Supabase docker directory not found -- previous clone may be incomplete."
  warn "Removing and re-cloning..."
  rm -rf "$VITCAM_DIR/supabase"
  git clone --depth 1 https://github.com/supabase/supabase.git "$VITCAM_DIR/supabase"
fi

cd "$SUPABASE_DOCKER_DIR"

# Copy .env.example only if .env does not exist yet
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    info "Copied .env.example -> .env"
  else
    error ".env.example not found -- try deleting $VITCAM_DIR/supabase and re-running."
  fi
fi

# Create required volume directories with correct permissions
info "Creating Supabase storage directories..."
sudo mkdir -p volumes/db/data
sudo mkdir -p volumes/storage
sudo mkdir -p volumes/functions
sudo mkdir -p volumes/logs
sudo chown -R "$USER":"$USER" volumes/
success "Storage directories ready."

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

# Apply DB schema via docker exec -- no psql required on host
info "Applying database schema..."
SCHEMA_FILE="$VITCAM_DIR/server/dbschema.sql"

if [[ ! -f "$SCHEMA_FILE" ]]; then
  warn "Schema file not found at $SCHEMA_FILE"
  warn "Open http://localhost:$SUPABASE_PORT -> SQL Editor and run server/dbschema.sql manually."
else
  DB_CONTAINER=$(sudo docker ps --format '{{.Names}}' 2>/dev/null \
    | grep -i "supabase-db\|supabase_db" | head -1 || echo "supabase-db")
  info "Using postgres container: $DB_CONTAINER"
  if sudo docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SCHEMA_FILE" 2>/dev/null; then
    success "Database schema applied."
  else
    warn "Could not auto-apply schema."
    warn "Open http://localhost:$SUPABASE_PORT -> SQL Editor and run server/dbschema.sql manually."
  fi
fi

# -- Step 6: Configure .env files ---------------------------------------------
header "Step 7 / 10 -- Configure .env files"

echo ""
echo -e "${YELLOW}  ACTION REQUIRED -- Configure Supabase and update .env files:${RESET}"
echo -e "  ----------------------------------------------------------------"
echo -e "  1. Open Supabase Studio in your browser:"
echo -e "     ${CYAN}http://localhost:$SUPABASE_PORT${RESET}"
echo ""
echo -e "     Login with the default credentials:"
echo -e "     ${BOLD}Username:${RESET} supabase"
echo -e "     ${BOLD}Password:${RESET} this_password_is_insecure_and_should_be_updated"
echo -e "     ${YELLOW}NOTE: Do NOT change this password after first login${RESET}"
echo ""
echo -e "  2. Go to Authentication -> Users -> Add User"
echo -e "     Add your VitCam login account and enable Auto Confirm"
echo ""
echo -e "  3. Go to Project Settings -> API"
echo -e "     Copy the ${BOLD}URL${RESET} and ${BOLD}anon public${RESET} key"
echo ""
echo -e "  4. Edit and update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY:"
echo -e "     ${CYAN}$VITCAM_DIR/frontend/.env${RESET}"
echo ""
echo -e "  5. Edit and update SUPABASE_URL and SUPABASE_KEY:"
echo -e "     ${CYAN}$VITCAM_DIR/server/.env${RESET}"
echo ""
echo -e "${YELLOW}  Press ENTER once you have completed all steps above...${RESET}"
read -r

success ".env configuration step complete."

# -- Step 7: Python / pyenv ---------------------------------------------------
header "Step 8 / 10 -- Python $PYTHON_VERSION (pyenv)"

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
  info "Installing Python $PYTHON_VERSION (this takes a few minutes)..."
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

# -- Step 8: Backend dependencies ---------------------------------------------
header "Step 9 / 10 -- Backend dependencies"

cd "$VITCAM_DIR/server"
pip install -q -r requirements.txt
success "Backend dependencies installed."

# -- Step 9: Frontend build + nginx + systemd ---------------------------------
header "Step 10 / 10 -- Frontend build, nginx & systemd services"

cd "$VITCAM_DIR/frontend"
npm install --silent
npm run build
success "Frontend built."

# nginx config
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
sudo nginx -t

if [[ -d /run/systemd/system ]] && systemctl is-system-running --quiet 2>/dev/null; then
  sudo systemctl reload nginx
  sudo systemctl enable nginx
  success "nginx configured and enabled via systemd."
else
  sudo service nginx restart 2>/dev/null || sudo nginx || true
  warn "systemd not available -- nginx started directly. It will not auto-start on reboot."
fi
success "nginx configured -- frontend proxied on port 80."

# Frontend systemd service
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

# Backend systemd service
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

if [[ -d /run/systemd/system ]] && systemctl is-system-running --quiet 2>/dev/null; then
  sudo systemctl daemon-reload
  sudo systemctl enable vitcam-frontend
  sudo systemctl restart vitcam-frontend
  success "vitcam-frontend service enabled and started."
  sudo systemctl daemon-reload
  sudo systemctl enable vitcam-server
  sudo systemctl restart vitcam-server
  success "vitcam-server service enabled and started."
else
  warn "systemd not available -- starting services directly in background."
  warn "Services will NOT auto-start on reboot in this environment."
  warn "To enable systemd on WSL2, add to /etc/wsl.conf:"
  warn "  [boot]"
  warn "  systemd=true"
  warn "Then run: wsl --shutdown"
  # Start frontend and backend directly as background processes
  cd "$VITCAM_DIR/frontend" && nohup npm start > /tmp/vitcam-frontend.log 2>&1 &
  success "vitcam-frontend started (log: /tmp/vitcam-frontend.log)"
  cd "$VITCAM_DIR/server" && nohup "$PYTHON_BIN" main.py > /tmp/vitcam-server.log 2>&1 &
  success "vitcam-server started (log: /tmp/vitcam-server.log)"
fi

# -- Done ---------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  VitCam installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
HOST_IP=$(hostname -I | awk '{print $1}')
if $GPU_FOUND && $CUDA_INSTALLED; then
  echo -e "  Inference mode:  ${GREEN}GPU (CUDA)${RESET}"
else
  echo -e "  Inference mode:  ${YELLOW}CPU only${RESET}  (no NVIDIA GPU detected)"
fi
echo -e "  Frontend:        ${CYAN}http://${HOST_IP}${RESET}  (port 80 via nginx)"
echo -e "  Frontend direct: ${CYAN}http://localhost:${FRONTEND_PORT}${RESET}"
echo -e "  Backend API:     ${CYAN}http://localhost:${SERVER_PORT}${RESET}"
echo -e "  Supabase Studio: ${CYAN}http://localhost:${SUPABASE_PORT}${RESET}"
echo ""
echo -e "${YELLOW}  Next steps:${RESET}"
echo -e "  1. Open Supabase Studio -> Authentication -> Users"
echo -e "     and add your first login user (enable Auto Confirm)"
echo -e "  2. Open ${CYAN}http://${HOST_IP}${RESET} and sign in"
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
