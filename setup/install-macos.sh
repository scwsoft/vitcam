#!/usr/bin/env bash
# =============================================================================
#  VitCam -- macOS Installer
#  Tested on macOS 13+ (Apple Silicon and Intel)
#  Requires: Homebrew, Docker Desktop running
#  Deploys frontend via nginx + launchd, backend via launchd
# =============================================================================
set -euo pipefail

# Derive VitCam root from the script's own location (parent of setup/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VITCAM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO="https://github.com/scwsoft/vitcam.git"

SERVER_PORT=8765
FRONTEND_PORT=3000
SUPABASE_PORT=8000
PYTHON_VERSION="3.10.19"

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VitCam]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[X]${RESET} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}== $* ==${RESET}\n"; }

# -- Preflight ----------------------------------------------------------------
header "VitCam Installer -- macOS"

info "VitCam directory: $VITCAM_DIR"

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

# -- Step 1 / 9: Clone VitCam -------------------------------------------------
header "Step 1 / 9 -- Clone VitCam"

if [[ -d "$VITCAM_DIR/.git" ]]; then
  info "Repository already exists -- pulling latest changes."
  git -C "$VITCAM_DIR" pull
else
  git clone "$REPO" "$VITCAM_DIR" 2>/dev/null || info "Using existing directory at $VITCAM_DIR."
fi
success "Repository ready at $VITCAM_DIR."

# -- Step 2 / 9: Supabase via Docker ------------------------------------------
header "Step 2 / 9 -- Supabase (Docker)"

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

# Create required volume directories
info "Creating Supabase storage directories..."
mkdir -p volumes/db/data
mkdir -p volumes/functions
mkdir -p volumes/logs
# Note: volumes/storage intentionally NOT created as a bind mount --
# macOS Docker Desktop bind mounts lack xattr support which breaks Supabase Storage.
# We patch docker-compose.yml to use a named Docker volume instead (see below).
success "Storage directories ready."

# -- Fix macOS xattr issue: replace storage bind mount with named Docker volume --
# macOS Docker Desktop bind mounts don't support extended attributes (xattr),
# which causes "The file system does not support extended attributes" errors
# when uploading files to Supabase Storage. The fix is a named Docker volume.
info "Patching Supabase docker-compose.yml for macOS storage compatibility..."

COMPOSE_FILE="$SUPABASE_DOCKER_DIR/docker-compose.yml"

# Only patch if not already patched
if grep -q "supabase_storage" "$COMPOSE_FILE" 2>/dev/null; then
  info "docker-compose.yml already patched -- skipping."
else
  # Replace the storage bind mount line with a named volume reference
  sed -i '' 's|./volumes/storage:/var/lib/storage|supabase_storage:/var/lib/storage|g' "$COMPOSE_FILE"

  # Append named volume declaration if not present
  if ! grep -q "^volumes:" "$COMPOSE_FILE"; then
    echo "" >> "$COMPOSE_FILE"
    echo "volumes:" >> "$COMPOSE_FILE"
    echo "  supabase_storage:" >> "$COMPOSE_FILE"
    echo "    driver: local" >> "$COMPOSE_FILE"
  elif ! grep -q "supabase_storage:" "$COMPOSE_FILE"; then
    # volumes: block exists -- append under it
    echo "  supabase_storage:" >> "$COMPOSE_FILE"
    echo "    driver: local" >> "$COMPOSE_FILE"
  fi

  success "docker-compose.yml patched -- storage will use a named Docker volume."
fi

info "Pulling latest Supabase images..."
docker compose pull

info "Starting Supabase containers (first run may take several minutes)..."
docker compose up --detach

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
  DB_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null \
    | grep -i "supabase-db\|supabase_db" | head -1 || echo "supabase-db")
  info "Using postgres container: $DB_CONTAINER"
  if docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SCHEMA_FILE" 2>/dev/null; then
    success "Database schema applied."
  else
    warn "Could not auto-apply schema."
    warn "Open http://localhost:$SUPABASE_PORT -> SQL Editor and run server/dbschema.sql manually."
  fi
fi

# -- Step 3 / 9: Configure .env files -----------------------------------------
header "Step 3 / 9 -- Configure .env files"

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

# -- Step 4 / 9: Python / pyenv -----------------------------------------------
header "Step 4 / 9 -- Python $PYTHON_VERSION (pyenv)"

if ! command -v pyenv >/dev/null; then
  info "Installing pyenv..."
  brew install pyenv
fi

export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)" 2>/dev/null || true
eval "$(pyenv virtualenv-init -)" 2>/dev/null || true

if ! pyenv versions 2>/dev/null | grep -q "$PYTHON_VERSION"; then
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
    echo 'eval "$(pyenv virtualenv-init -)"'
  } >> "$SHELL_RC"
fi

# -- Step 5 / 9: Backend dependencies -----------------------------------------
header "Step 5 / 9 -- Backend dependencies"

cd "$VITCAM_DIR/server"
pip install -q -r requirements.txt

# Apple Silicon opencv fallback
if ! python -c "import cv2" 2>/dev/null; then
  warn "opencv-python failed -- trying opencv-python-headless (Apple Silicon)..."
  pip install -q opencv-python-headless
fi

success "Backend dependencies installed."

# -- Step 6 / 9: Frontend build -----------------------------------------------
header "Step 6 / 9 -- Frontend build"

cd "$VITCAM_DIR/frontend"
npm install --silent
npm run build
success "Frontend built."

# -- Step 7 / 9: nginx --------------------------------------------------------
header "Step 7 / 9 -- nginx"

if ! command -v nginx >/dev/null; then
  info "Installing nginx..."
  brew install nginx
fi

# Write nginx config
NGINX_CONF_DIR="$(brew --prefix)/etc/nginx/servers"
mkdir -p "$NGINX_CONF_DIR"

cat > "$NGINX_CONF_DIR/vitcam.conf" << NGINXCONF
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

brew services restart nginx
success "nginx configured -- frontend proxied on port 80."

# -- Step 8 / 9: Frontend launchd service -------------------------------------
header "Step 8 / 9 -- Frontend service (launchd)"

NPM_BIN="$(which npm)"
NODE_BIN="$(which node)"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$HOME/Library/LaunchAgents/io.vitcam.frontend.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.vitcam.frontend</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NPM_BIN}</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${VITCAM_DIR}/frontend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>${FRONTEND_PORT}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/vitcam-frontend.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/vitcam-frontend.log</string>
</dict>
</plist>
PLIST

launchctl unload "$HOME/Library/LaunchAgents/io.vitcam.frontend.plist" 2>/dev/null || true
launchctl load "$HOME/Library/LaunchAgents/io.vitcam.frontend.plist"
success "vitcam-frontend launchd service loaded (auto-starts on login)."

# -- Step 9 / 9: Backend launchd service --------------------------------------
header "Step 9 / 9 -- Backend service (launchd)"

PYTHON_BIN="$(pyenv which python)"

cat > "$HOME/Library/LaunchAgents/io.vitcam.server.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.vitcam.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>${PYTHON_BIN}</string>
        <string>main.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${VITCAM_DIR}/server</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${HOME}/.pyenv/shims</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/vitcam-server.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/vitcam-server.log</string>
</dict>
</plist>
PLIST

launchctl unload "$HOME/Library/LaunchAgents/io.vitcam.server.plist" 2>/dev/null || true
launchctl load "$HOME/Library/LaunchAgents/io.vitcam.server.plist"
success "vitcam-server launchd service loaded (auto-starts on login)."

# -- Done ---------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  VitCam installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Inference mode:  ${YELLOW}CPU (Apple Silicon -- no CUDA)${RESET}"
echo -e "  Frontend:        ${CYAN}http://localhost:80${RESET}  (via nginx)"
echo -e "  Frontend direct: ${CYAN}http://localhost:${FRONTEND_PORT}${RESET}"
echo -e "  Backend API:     ${CYAN}http://localhost:${SERVER_PORT}${RESET}"
echo -e "  Supabase Studio: ${CYAN}http://localhost:${SUPABASE_PORT}${RESET}"
echo ""
echo -e "${YELLOW}  Next steps:${RESET}"
echo -e "  1. Open Supabase Studio -> Authentication -> Users"
echo -e "     and confirm your login user was created"
echo -e "  2. Open ${CYAN}http://localhost${RESET} and sign in"
echo ""
echo -e "  Service commands:"
echo -e "    ${BOLD}launchctl list | grep vitcam${RESET}               (check status)"
echo -e "    ${BOLD}launchctl stop io.vitcam.server${RESET}            (stop server)"
echo -e "    ${BOLD}launchctl start io.vitcam.server${RESET}           (start server)"
echo -e "    ${BOLD}tail -f ~/Library/Logs/vitcam-server.log${RESET}  (live server logs)"
echo -e "    ${BOLD}tail -f ~/Library/Logs/vitcam-frontend.log${RESET} (live frontend logs)"
echo ""
echo -e "  Supabase:  ${BOLD}cd $VITCAM_DIR/supabase/docker && docker compose ps${RESET}"
echo -e "  nginx:     ${BOLD}brew services info nginx${RESET}"
echo ""