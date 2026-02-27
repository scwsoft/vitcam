#!/usr/bin/env bash
# =============================================================================
#  VitCam — Ubuntu 24.04 Installer (WSL2 + native Ubuntu)
#  Modes: server | client | both
#
#  Interactive:     chmod +x install-vitcam.sh && ./install-vitcam.sh
#  Non-interactive: INSTALL_MODE=server ./install-vitcam.sh
#  Via PS1:         install-vitcam.ps1 injects env vars and calls this script
# =============================================================================
set -euo pipefail

# ─── CONFIGURATION ────────────────────────────────────────────────────────────
VITCAM_REPO="${VITCAM_REPO:-https://github.com/scwsoft/vitcam.git}"
INSTALL_CUDA="${INSTALL_CUDA:-true}"
PYTORCH_CUDA_TAG="${PYTORCH_CUDA_TAG:-cu130}"
CUDA_TOOLKIT_VER="${CUDA_TOOLKIT_VER:-13.1}"
PYTHON_VERSION="3.10.11"
NODE_VERSION="20"
NVM_VERSION="0.40.0"
SUPABASE_CLI_VERSION="latest"
VITCAM_DIR="$HOME/vitcam"
VENV_NAME="vitcam-server"
LOG_FILE="$HOME/vitcam-install.log"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# ─── COLOURS & HELPERS ────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
step() { echo -e "\n${CYAN}${BOLD}==> $*${RESET}"; }
ok()   { echo -e "${GREEN}[OK]  $*${RESET}"; }
warn() { echo -e "${YELLOW}[WARN] $*${RESET}"; }
fail() { echo -e "${RED}[FAIL] $*${RESET}"; exit 1; }
_systemd_active() { systemctl is-system-running 2>/dev/null | grep -qE '^(running|degraded)$'; }

exec > >(tee -a "$LOG_FILE") 2>&1

# ─── BANNER ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║              VitCam Installer (Ubuntu 24.04)             ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo -e "  Repo: $VITCAM_REPO"
echo -e "  Log:  $LOG_FILE"
echo ""

# ─── 0. INSTALL MODE ──────────────────────────────────────────────────────────
INSTALL_SERVER=false
INSTALL_CLIENT=false

if [[ -n "${INSTALL_MODE:-}" ]]; then
    case "${INSTALL_MODE,,}" in
        server) INSTALL_SERVER=true ;;
        client) INSTALL_CLIENT=true ;;
        both)   INSTALL_SERVER=true; INSTALL_CLIENT=true ;;
        *) fail "Invalid INSTALL_MODE='$INSTALL_MODE'. Use: server | client | both" ;;
    esac
    echo -e "  Mode: ${BOLD}${INSTALL_MODE^^}${RESET} (from INSTALL_MODE env var)"
else
    echo -e "${BOLD}  What would you like to install?${RESET}"
    echo ""
    echo -e "    ${CYAN}1)${RESET} ${BOLD}Server only${RESET}  — Python, CUDA/PyTorch, Docker, Supabase local stack"
    echo -e "    ${CYAN}2)${RESET} ${BOLD}Client only${RESET}  — Node.js + Next.js frontend"
    echo -e "    ${CYAN}3)${RESET} ${BOLD}Both${RESET}         — Full stack (recommended for new installs)"
    echo ""
    while true; do
        read -rp "  Enter choice [1/2/3]: " _choice
        case "$_choice" in
            1) INSTALL_SERVER=true; break ;;
            2) INSTALL_CLIENT=true; break ;;
            3) INSTALL_SERVER=true; INSTALL_CLIENT=true; break ;;
            *) echo "  Please enter 1, 2, or 3." ;;
        esac
    done
fi

echo ""
echo -e "  ${BOLD}Installing:${RESET}"
[[ "$INSTALL_SERVER" == "true" ]] && echo -e "    ${GREEN}✓${RESET} Server  (Python $PYTHON_VERSION, CUDA $CUDA_TOOLKIT_VER, Docker, Supabase)"
[[ "$INSTALL_CLIENT" == "true" ]] && echo -e "    ${GREEN}✓${RESET} Client  (Node $NODE_VERSION, Next.js)"
echo ""

# ─── 1. SANITY CHECKS (always) ────────────────────────────────────────────────
step "Sanity checks"
# Detect environment
IS_WSL=false
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
if [[ "$IS_WSL" == "true" ]]; then
    ok "Environment: WSL2"
else
    ok "Environment: Native Ubuntu"
fi
[[ "$EUID" -eq 0 ]] && warn "Running as root — service paths will use /root"
REAL_USER="$(whoami)"
SERVER_DIR="$VITCAM_DIR/server"
FRONTEND_DIR="$VITCAM_DIR/frontend"
VENV_DIR="$SERVER_DIR/$VENV_NAME"
PYTHON_BIN="$HOME/.pyenv/versions/$PYTHON_VERSION/bin/python"
# Key vars initialised here so .env section can always reference them
SUPA_API_URL="http://127.0.0.1:54321"
SUPA_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SUPA_STUDIO_URL="http://127.0.0.1:54323"
SUPA_ANON_KEY=""; SUPA_SERVICE_KEY=""

# ─── 2. SYSTEM PACKAGES (always) ──────────────────────────────────────────────
step "Updating apt and installing system dependencies"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq \
    git curl wget unzip make ca-certificates gnupg lsb-release \
    build-essential libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev llvm libncursesw5-dev xz-utils \
    tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
    python3-openssl libx264-dev libavcodec-extra \
    software-properties-common jq
ok "System packages installed"

# ─── 3. DOCKER ENGINE (server only) ───────────────────────────────────────────
if [[ "$INSTALL_SERVER" == "true" ]]; then
    step "Installing Docker Engine"
    if command -v docker &>/dev/null; then
        ok "Docker already installed: $(docker --version)"
    else
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
            | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -qq
        sudo apt-get install -y -qq \
            docker-ce docker-ce-cli containerd.io \
            docker-buildx-plugin docker-compose-plugin
        ok "Docker installed: $(docker --version)"
    fi

    groups "$REAL_USER" | grep -q docker || sudo usermod -aG docker "$REAL_USER"
    [[ -S /var/run/docker.sock ]] && sudo chmod 666 /var/run/docker.sock
    export DOCKER_HOST="unix:///var/run/docker.sock"

    if sudo docker info &>/dev/null 2>&1; then
        ok "Docker daemon already running"
    elif _systemd_active && systemctl list-unit-files docker.service &>/dev/null 2>&1; then
        sudo systemctl enable docker --quiet 2>/dev/null || true
        sudo systemctl start docker; sleep 2
        ok "Docker started via systemd"
    elif [[ "$IS_WSL" == "true" ]]; then
        # WSL2 without systemd: start dockerd directly in background
        pgrep -x dockerd &>/dev/null || sudo dockerd > /tmp/dockerd.log 2>&1 &
        sleep 4
        sudo docker info &>/dev/null 2>&1 \
            && ok "Docker daemon started in background (WSL2 pre-systemd)" \
            || warn "Docker not reachable yet — will retry before supabase start"
    else
        warn "Docker daemon not running and systemd not active — try: sudo systemctl start docker"
    fi

    [[ -S /var/run/docker.sock ]] && sudo chmod 666 /var/run/docker.sock
    DOCKER_CMD="docker"
    docker info &>/dev/null 2>&1 || { DOCKER_CMD="sudo docker"; warn "Using sudo docker this session"; }
    ok "Docker command: $DOCKER_CMD"
fi

# ─── 4. PYENV + PYTHON (server only) ──────────────────────────────────────────
if [[ "$INSTALL_SERVER" == "true" ]]; then
    step "Installing pyenv + Python $PYTHON_VERSION"
    if [[ -d "$HOME/.pyenv" ]]; then
        ok "pyenv present — updating"; (cd "$HOME/.pyenv" && git pull --quiet)
    else
        curl -fsSL https://pyenv.run | bash; ok "pyenv installed"
    fi
    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init --path)"
    eval "$(pyenv init -)"
    grep -q 'PYENV_ROOT' "$HOME/.bashrc" 2>/dev/null || cat >> "$HOME/.bashrc" << 'BASHEOF'
# pyenv — added by VitCam installer
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"
BASHEOF
    pyenv versions --bare | grep -q "^${PYTHON_VERSION}$" \
        && ok "Python $PYTHON_VERSION already installed" \
        || { pyenv install "$PYTHON_VERSION"; ok "Python $PYTHON_VERSION installed"; }
fi

# ─── 5. CLONE REPO (both) ─────────────────────────────────────────────────────
if [[ "$INSTALL_SERVER" == "true" || "$INSTALL_CLIENT" == "true" ]]; then
    step "Cloning VitCam repository"
    if [[ -d "$VITCAM_DIR/.git" ]]; then
        ok "Already cloned — pulling latest"; git -C "$VITCAM_DIR" pull --quiet
    elif [[ -d "$VITCAM_DIR" ]]; then
        warn "$VITCAM_DIR exists but is not a git repo (leftover from a partial uninstall) — removing and re-cloning"
        rm -rf "$VITCAM_DIR"
        git clone "$VITCAM_REPO" "$VITCAM_DIR"; ok "Cloned to $VITCAM_DIR"
    else
        git clone "$VITCAM_REPO" "$VITCAM_DIR"; ok "Cloned to $VITCAM_DIR"
    fi
    [[ "$INSTALL_SERVER" == "true" ]] && (cd "$VITCAM_DIR" && pyenv local "$PYTHON_VERSION")
fi

# ─── 6. BACKEND VENV + DEPS (server only) ─────────────────────────────────────
if [[ "$INSTALL_SERVER" == "true" ]]; then
    step "Setting up Python virtual environment"
    [[ -d "$VENV_DIR" ]] \
        && ok "Virtualenv already exists" \
        || { "$PYTHON_BIN" -m venv "$VENV_DIR"; ok "Virtualenv created: $VENV_DIR"; }

    source "$VENV_DIR/bin/activate"
    echo "  Upgrading pip / setuptools / wheel..."
    pip install --upgrade pip setuptools wheel --progress-bar off
    echo "  Installing numpy<2.0..."
    pip install "numpy<2.0" --progress-bar off

    if [[ -f "$SERVER_DIR/requirements.txt" ]]; then
        echo "  Installing requirements.txt..."
        pip install -r "$SERVER_DIR/requirements.txt" \
            --progress-bar off --no-cache-dir 2>&1 \
            | grep -E '(Collecting|Downloading|Installing|Successfully|already satisfied|ERROR)' || true
        ok "requirements.txt installed"
    else
        warn "No requirements.txt at $SERVER_DIR/requirements.txt — skipping"
    fi

    pip show rfdetr &>/dev/null && ok "rfdetr already installed" || {
        echo "  Installing rfdetr..."; 
        pip install -U rfdetr --progress-bar off --no-cache-dir 2>&1 \
            | grep -E '(Collecting|Downloading|Installing|Successfully|ERROR)' || true
        ok "rfdetr installed"
    }
    deactivate
fi

# ─── 7. CUDA + PYTORCH (server only) ──────────────────────────────────────────
if [[ "$INSTALL_SERVER" == "true" ]]; then
    if [[ "$INSTALL_CUDA" == "true" ]]; then
        step "Installing CUDA Toolkit $CUDA_TOOLKIT_VER"
        if command -v nvcc &>/dev/null; then
            ok "nvcc already available: $(nvcc --version | grep 'release')"
        else
            # WSL2 uses a dedicated wsl-ubuntu variant; native Ubuntu uses the standard repo
            if [[ "$IS_WSL" == "true" ]]; then
                CUDA_KEYRING_URL="https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-keyring_1.1-1_all.deb"
            else
                # Native Ubuntu — use ubuntu2404 repo
                CUDA_KEYRING_URL="https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb"
            fi
            TMP_DEB=$(mktemp --suffix=.deb)
            echo "  Downloading CUDA keyring..."
            if wget --show-progress "$CUDA_KEYRING_URL" -O "$TMP_DEB" 2>&1; then
                sudo dpkg -i "$TMP_DEB"; rm -f "$TMP_DEB"
                sudo apt-get update -q
                CUDA_PKG="cuda-toolkit-$(echo "$CUDA_TOOLKIT_VER" | tr '.' '-')"
                echo ""; echo "  Installing $CUDA_PKG — large download (3-5 GB)..."; echo ""
                sudo apt-get install -y "$CUDA_PKG" \
                    || { warn "Trying generic cuda-toolkit..."
                         sudo apt-get install -y cuda-toolkit \
                         || warn "CUDA install failed; continuing"; }
                ok "CUDA toolkit installed"
            else
                warn "CUDA keyring download failed — skipping CUDA"
            fi
        fi

        step "Installing PyTorch (${PYTORCH_CUDA_TAG})"
        source "$VENV_DIR/bin/activate"
        echo "  Downloading PyTorch — large download (1-3 GB)..."
        pip install torch torchvision torchaudio \
            --index-url "https://download.pytorch.org/whl/${PYTORCH_CUDA_TAG}" \
            --progress-bar on --no-cache-dir 2>&1 \
            | grep -E '(Collecting|Downloading|Installing|Successfully|ERROR)' || true
        TORCH_CUDA=$("$VENV_DIR/bin/python" -c \
            "import torch; print(torch.cuda.is_available())" 2>/dev/null || echo "check_failed")
        [[ "$TORCH_CUDA" == "True" ]] \
            && ok "torch.cuda.is_available() = True" \
            || warn "torch.cuda.is_available() = $TORCH_CUDA (OK if NVIDIA driver not yet visible)"
        deactivate
    else
        step "Installing CPU-only PyTorch"
        source "$VENV_DIR/bin/activate"
        echo "  Downloading PyTorch (CPU)..."
        pip install torch torchvision torchaudio \
            --progress-bar on --no-cache-dir 2>&1 \
            | grep -E '(Collecting|Downloading|Installing|Successfully|ERROR)' || true
        ok "CPU-only PyTorch installed"; deactivate
    fi
fi

# ─── 8. NODE.JS + FRONTEND (client only) ──────────────────────────────────────
if [[ "$INSTALL_CLIENT" == "true" ]]; then
    step "Installing nvm $NVM_VERSION + Node.js $NODE_VERSION"
    export NVM_DIR="$HOME/.nvm"
    if [[ -d "$NVM_DIR" ]]; then
        ok "nvm already installed"
    else
        curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh" | bash
        ok "nvm $NVM_VERSION installed"
    fi
    [ -s "$NVM_DIR/nvm.sh" ]          && source "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && source "$NVM_DIR/bash_completion"
    grep -q 'NVM_DIR' "$HOME/.bashrc" 2>/dev/null || cat >> "$HOME/.bashrc" << 'BASHEOF'
# nvm — added by VitCam installer
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
BASHEOF
    nvm install "$NODE_VERSION" --silent
    nvm use "$NODE_VERSION"; nvm alias default "$NODE_VERSION"
    ok "Node $(node -v) / npm $(npm -v)"

    step "Installing frontend dependencies and building"
    if [[ -d "$FRONTEND_DIR" ]]; then
        cd "$FRONTEND_DIR"
        npm install --silent; ok "npm install complete"
        if grep -q '"build"' package.json 2>/dev/null; then
            echo "  Running npm run build..."
            npm run build 2>&1 | grep -E '(error|warn|compiled|ready|failed|Route|Page|chunk)' || true
            ok "Next.js build complete"

            # ── Copy static assets into standalone dir ────────────────────────
            # Next.js standalone intentionally omits .next/static/ and public/.
            # Without these copies the Node server returns 404 for ALL CSS, JS
            # chunks, images, fonts and icons — causing a broken unstyled layout.
            NEXT_STANDALONE_COPY="$FRONTEND_DIR/.next/standalone"
            if [[ -d "$NEXT_STANDALONE_COPY" ]]; then
                echo "  Copying .next/static → standalone/.next/static ..."
                mkdir -p "$NEXT_STANDALONE_COPY/.next/static"
                rm -rf "${NEXT_STANDALONE_COPY:?}/.next/static/"*
                cp -r "$FRONTEND_DIR/.next/static/." "$NEXT_STANDALONE_COPY/.next/static/"
                ok "Copied .next/static"

                echo "  Copying public/ → standalone/public ..."
                mkdir -p "$NEXT_STANDALONE_COPY/public"
                rm -rf "${NEXT_STANDALONE_COPY:?}/public/"*
                [[ -d "$FRONTEND_DIR/public" ]] \
                    && cp -r "$FRONTEND_DIR/public/." "$NEXT_STANDALONE_COPY/public/" \
                    || warn "public/ not found — skipping"
                ok "Copied public/"
            else
                warn "standalone/ dir not found — ensure next.config.js has: output: 'standalone'"
            fi
        fi
        cd "$VITCAM_DIR"
    else
        warn "Frontend dir not found at $FRONTEND_DIR — skipping"
    fi

    # ── Write rebuild helper ──────────────────────────────────────────────────
    # Must be re-run after every code change — build alone is not enough.
    REBUILD_SCRIPT="$HOME/vitcam-rebuild-frontend.sh"
    cat > "$REBUILD_SCRIPT" << 'REBEOF'
#!/usr/bin/env bash
# VitCam — rebuild and redeploy frontend
# Run this after every code change to the frontend.
set -euo pipefail
REBEOF
    # Inject paths (expanded at installer runtime)
    cat >> "$REBUILD_SCRIPT" << REBEOF
FRONTEND_DIR="$FRONTEND_DIR"
REBEOF
    cat >> "$REBUILD_SCRIPT" << 'REBEOF'
NEXT_STANDALONE="$FRONTEND_DIR/.next/standalone"

echo "==> Building..."
cd "$FRONTEND_DIR"
npm run build

echo "==> Copying static assets into standalone..."
mkdir -p "$NEXT_STANDALONE/.next/static"
mkdir -p "$NEXT_STANDALONE/public"
rm -rf "${NEXT_STANDALONE:?}/.next/static/"*
rm -rf "${NEXT_STANDALONE:?}/public/"*
cp -r "$FRONTEND_DIR/.next/static/." "$NEXT_STANDALONE/.next/static/"
[[ -d "$FRONTEND_DIR/public" ]] && cp -r "$FRONTEND_DIR/public/." "$NEXT_STANDALONE/public/"

echo "==> Restarting PM2..."
pm2 restart vitcam-frontend

echo "Done — http://localhost:$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; procs=json.load(sys.stdin); [print(e['pm2_env']['env']['PORT']) for e in procs if e['name']=='vitcam-frontend']" 2>/dev/null || echo 3000)"
REBEOF
    chmod +x "$REBUILD_SCRIPT"
    ok "Rebuild script: $REBUILD_SCRIPT"

    # ─── 8b. Run frontend with PM2 ───────────────────────────────────────────
    step "Setting up frontend with PM2 (port $FRONTEND_PORT)"

    NEXT_STANDALONE="$FRONTEND_DIR/.next/standalone"

    if [[ ! -d "$NEXT_STANDALONE" ]]; then
        warn "Standalone dir not found at $NEXT_STANDALONE"
        warn "Ensure next.config.js has: output: 'standalone'"
        warn "Then re-run: cd ~/vitcam/frontend && npm run build"
    fi

    # Install PM2 globally if not present
    if command -v pm2 &>/dev/null; then
        ok "PM2 already installed: $(pm2 --version)"
    else
        echo "  Installing PM2..."
        npm install -g pm2 --silent
        ok "PM2 installed: $(pm2 --version)"
    fi

    # Write PM2 ecosystem config
    PM2_CONFIG="$FRONTEND_DIR/ecosystem.config.js"
    NODE_BIN="$(command -v node)"
    cat > "$PM2_CONFIG" << PM2EOF
module.exports = {
  apps: [
    {
      name: 'vitcam-frontend',
      script: '$NEXT_STANDALONE/server.js',
      interpreter: '$NODE_BIN',
      cwd: '$NEXT_STANDALONE',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '$FRONTEND_PORT',
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
PM2EOF
    ok "PM2 ecosystem config written: $PM2_CONFIG"

    if [[ -d "$NEXT_STANDALONE" ]]; then
        # Stop existing instance if running, then start fresh
        pm2 delete vitcam-frontend 2>/dev/null || true
        pm2 start "$PM2_CONFIG"
        ok "vitcam-frontend started via PM2 — http://localhost:$FRONTEND_PORT"

        # Save PM2 process list and configure startup
        pm2 save
        # Generate and install the pm2 startup hook (works on systemd and non-systemd)
        PM2_STARTUP=$(pm2 startup 2>&1 | grep 'sudo' | tail -1 || true)
        if [[ -n "$PM2_STARTUP" ]]; then
            echo "  Running PM2 startup hook: $PM2_STARTUP"
            eval "$PM2_STARTUP" && ok "PM2 startup hook installed (survives reboots)"                 || warn "Could not install PM2 startup hook — run manually: pm2 startup"
        fi
    else
        warn "Build not found — PM2 config written but not started"
        warn "Run:  ~/vitcam-rebuild-frontend.sh  (builds, copies assets, starts PM2)"
    fi
fi

# ─── 9. SUPABASE (server only — always installed with server) ──────────────────
if [[ "$INSTALL_SERVER" == "true" ]]; then

    # 9a. Supabase CLI
    step "Installing Supabase CLI"
    SUPABASE_BIN="$HOME/.local/bin/supabase"
    mkdir -p "$HOME/.local/bin"
    grep -q '.local/bin' "$HOME/.bashrc" 2>/dev/null \
        || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    export PATH="$HOME/.local/bin:$PATH"

    _install_supabase_cli() {
        local arch asset TMP_DIR DOWNLOAD_URL VERSION_TAG
        arch=$(uname -m)
        case "$arch" in
            x86_64)  asset="supabase_linux_amd64.tar.gz" ;;
            aarch64) asset="supabase_linux_arm64.tar.gz" ;;
            *)       warn "Unsupported arch: $arch"; return 1 ;;
        esac
        # Method 1: official apt install script
        echo "    Method 1: official apt install..."
        curl -fsSL https://packages.supabase.com/install.sh | sudo bash 2>&1 && return 0
        warn "apt install failed"
        # Method 2: GitHub release
        echo "    Method 2: GitHub release download..."
        if [[ "$SUPABASE_CLI_VERSION" != "latest" ]]; then
            DOWNLOAD_URL="https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/${asset}"
        else
            VERSION_TAG=$(curl -fsSL -H "Accept: application/vnd.github+json" \
                "https://api.github.com/repos/supabase/cli/releases/latest" 2>/dev/null \
                | grep '"tag_name"' | head -1 \
                | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/' || true)
            [[ -n "$VERSION_TAG" ]] \
                && DOWNLOAD_URL="https://github.com/supabase/cli/releases/download/${VERSION_TAG}/${asset}" \
                || DOWNLOAD_URL=""
        fi
        if [[ -n "$DOWNLOAD_URL" ]]; then
            TMP_DIR=$(mktemp -d)
            wget --show-progress "$DOWNLOAD_URL" -O "$TMP_DIR/$asset" 2>&1 && \
            tar -xzf "$TMP_DIR/$asset" -C "$TMP_DIR" && \
            find "$TMP_DIR" -maxdepth 2 -name "supabase" -type f | head -1 | \
                xargs -I{} mv {} "$SUPABASE_BIN" && \
            chmod +x "$SUPABASE_BIN" && rm -rf "$TMP_DIR" && return 0
            rm -rf "$TMP_DIR" 2>/dev/null || true
        fi
        # Method 3: npm
        echo "    Method 3: npm install -g supabase..."
        npm install -g supabase 2>&1 | grep -v "^npm warn" && return 0
        return 1
    }

    if command -v supabase &>/dev/null; then
        ok "Supabase CLI on PATH: $(supabase --version)"
    elif [[ -x "$SUPABASE_BIN" ]]; then
        ok "Supabase CLI installed: $($SUPABASE_BIN --version)"
    else
        _install_supabase_cli || fail "Supabase CLI installation failed after all methods"
        command -v supabase &>/dev/null || [[ -x "$SUPABASE_BIN" ]] \
            || fail "Supabase CLI binary not found after install"
    fi
    SUPABASE_BIN_PATH="$(command -v supabase 2>/dev/null || echo "$SUPABASE_BIN")"
    [[ -x "$SUPABASE_BIN_PATH" ]] || fail "Supabase CLI not executable: $SUPABASE_BIN_PATH"
    ok "Supabase CLI: $("$SUPABASE_BIN_PATH" --version)"
    SUPABASE_CMD="env DOCKER_HOST=unix:///var/run/docker.sock $SUPABASE_BIN_PATH"
    SUPABASE_SUDO_CMD="sudo -E env DOCKER_HOST=unix:///var/run/docker.sock $SUPABASE_BIN_PATH"

    # 9b. supabase init
    step "Initialising Supabase local project"
    cd "$VITCAM_DIR"
    [[ -f "$VITCAM_DIR/supabase/config.toml" ]] \
        && ok "Already initialised" \
        || { $SUPABASE_SUDO_CMD init; ok "Supabase project initialised"; }

    # 9c. Migration SQL — always overwrite to ensure no storage.* present
    step "Writing database migration"
    MIGRATION_DIR="$VITCAM_DIR/supabase/migrations"
    mkdir -p "$MIGRATION_DIR"
    MIGRATION_FILE="$MIGRATION_DIR/20240101000000_vitcam_schema.sql"
    [[ -f "$MIGRATION_FILE" ]] && { warn "Removing stale migration"; rm -f "$MIGRATION_FILE"; }
    cat > "$MIGRATION_FILE" << 'MIGEOF'
-- ============================================================================
-- VitCam Schema Migration
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── camera ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.camera (
  id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name          TEXT,
  type          TEXT,
  url           TEXT,
  description   TEXT,
  odthreshold   INTEGER,
  is_detection  BOOLEAN DEFAULT FALSE,
  odclasses     TEXT,
  encoder       TEXT,
  resolution    TEXT,
  fps           INTEGER,
  rectype       TEXT
);

-- ── general_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.general_settings (
  id                  SERIAL PRIMARY KEY,
  user_id             UUID UNIQUE REFERENCES auth.users(id),
  signaling_protocol  TEXT    DEFAULT 'ws',
  signaling_ip        TEXT,
  signaling_port      TEXT,
  signaling_name      TEXT,
  datetime_enabled    BOOLEAN DEFAULT TRUE,
  datetime_format     TEXT    DEFAULT 'YYYY-MM-DD HH:mm:ss',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE,
  avatar_url  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  full_name   TEXT,
  website     TEXT
);

-- ── object_detection_events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.object_detection_events (
  id                  BIGSERIAL PRIMARY KEY,
  camera_id           INTEGER     NOT NULL,
  camera_name         TEXT        NOT NULL,
  camera_url          TEXT,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  object_class_id     INTEGER     NOT NULL,
  object_class_name   TEXT        NOT NULL,
  confidence          REAL        NOT NULL
                          CHECK (confidence >= 0 AND confidence <= 1),
  bbox_x              REAL        NOT NULL DEFAULT 0,
  bbox_y              REAL        NOT NULL DEFAULT 0,
  bbox_width          REAL        NOT NULL DEFAULT 0,
  bbox_height         REAL        NOT NULL DEFAULT 0,
  frame_width         INTEGER     NOT NULL DEFAULT 0,
  frame_height        INTEGER     NOT NULL DEFAULT 0,
  session_id          UUID,
  detection_metadata  JSONB       DEFAULT '{}'::JSONB,
  image_url           TEXT,
  tracker_id          INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── system_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_logs (
  id                  BIGSERIAL PRIMARY KEY,
  timestamp           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  level               VARCHAR(20)  NOT NULL,
  category            VARCHAR(50)  NOT NULL,
  subcategory         VARCHAR(50),
  source_file         VARCHAR(255),
  source_function     VARCHAR(255),
  line_number         INTEGER,
  message             TEXT         NOT NULL,
  details             JSONB,
  camera_id           INTEGER REFERENCES public.camera(id),
  camera_url          TEXT,
  session_id          UUID,
  client_id           TEXT,
  stack_trace         TEXT,
  performance_metrics JSONB,
  resolved            BOOLEAN      DEFAULT FALSE,
  resolution_notes    TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes: object_detection_events ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_detection_events_camera_id
    ON public.object_detection_events (camera_id);
CREATE INDEX IF NOT EXISTS idx_detection_events_timestamp
    ON public.object_detection_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_detection_events_object_class
    ON public.object_detection_events (object_class_name);
CREATE INDEX IF NOT EXISTS idx_detection_events_camera_timestamp
    ON public.object_detection_events (camera_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_detection_events_session
    ON public.object_detection_events (session_id);
CREATE INDEX IF NOT EXISTS idx_object_detection_events_image_url
    ON public.object_detection_events (image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracker_id
    ON public.object_detection_events (tracker_id);

-- Analytics / pagination composite indexes
CREATE INDEX IF NOT EXISTS idx_events_timestamp
    ON public.object_detection_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_camera_timestamp
    ON public.object_detection_events (camera_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_object_timestamp
    ON public.object_detection_events (object_class_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_camera_name_timestamp
    ON public.object_detection_events (camera_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_covering
    ON public.object_detection_events
    (timestamp DESC, camera_id, object_class_name, confidence)
    INCLUDE (camera_name, tracker_id, bbox_x, bbox_y, bbox_width, bbox_height);

ANALYZE public.object_detection_events;

-- ── Trigger: auto-create profile on signup ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, website, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'website',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.camera                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_detection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
-- system_logs: RLS intentionally OFF (server-side service role writes)

DROP POLICY IF EXISTS "camera_policy"                  ON public.camera;
DROP POLICY IF EXISTS "general_settings_policy"        ON public.general_settings;
DROP POLICY IF EXISTS "object_detection_events_policy" ON public.object_detection_events;
DROP POLICY IF EXISTS "profiles_policy"                ON public.profiles;

CREATE POLICY "camera_policy" ON public.camera
    AS PERMISSIVE FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "general_settings_policy" ON public.general_settings
    AS PERMISSIVE FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "object_detection_events_policy" ON public.object_detection_events
    AS PERMISSIVE FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "profiles_policy" ON public.profiles
    AS PERMISSIVE FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

MIGEOF
    grep -q 'storage\.' "$MIGRATION_FILE" \
        && fail "BUG: storage.* in migration — remove before supabase start"
    ok "Migration written: $MIGRATION_FILE"

    # 9d. Seed SQL
    SEED_FILE="$VITCAM_DIR/supabase/seed.sql"
    [[ -f "$SEED_FILE" ]] && ok "Seed file exists — skipping" || {
        cat > "$SEED_FILE" << 'SEEDEOF'
-- ============================================================================
-- VitCam Seed
-- Add any application seed data here.
-- Auth users should be created manually via Supabase Studio or the Admin API
-- after installation — see the summary printed at the end of install.
-- ============================================================================
SEEDEOF
        ok "Seed SQL written: $SEED_FILE"
    }

    # 9e. Start Supabase — wait for Docker first
    step "Starting Supabase local stack (first run pulls ~1 GB)"
    DOCKER_WAIT=0
    until sudo docker info &>/dev/null 2>&1; do
        [[ $DOCKER_WAIT -ge 30 ]] && {
            if _systemd_active 2>/dev/null; then
                sudo systemctl start docker || true
            elif [[ "$IS_WSL" == "true" ]]; then
                pgrep -x dockerd &>/dev/null || sudo dockerd > /tmp/dockerd.log 2>&1 &
            fi
            sleep 5; break
        }
        echo "  Waiting for Docker... (${DOCKER_WAIT}s)"; sleep 3
        DOCKER_WAIT=$((DOCKER_WAIT + 3))
    done
    [[ -S /var/run/docker.sock ]] && sudo chmod 666 /var/run/docker.sock

    if ! sudo docker info &>/dev/null 2>&1; then
        warn "Docker not reachable — skipping supabase start"
        warn "Start Docker then run:  cd ~/vitcam && supabase start"
    else
        ok "Docker ready"
        cd "$VITCAM_DIR"
        if $SUPABASE_SUDO_CMD status 2>/dev/null | grep -q "API URL"; then
            ok "Supabase already running"
        else
            echo ""
            echo "  Starting Supabase — output streamed live."
            echo "  First run: Docker image pull takes 3-10 min. Please wait..."
            echo ""
            SUPA_START_LOG=$(mktemp)
            set +e
            $SUPABASE_SUDO_CMD start 2>&1 | tee "$SUPA_START_LOG"
            SUPA_EXIT=${PIPESTATUS[0]}
            set -e
            [[ $SUPA_EXIT -eq 0 ]] && ok "Supabase started" || {
                warn "supabase start exited $SUPA_EXIT"
                warn "Re-run: cd ~/vitcam && sudo -E supabase start"
            }
        fi

        # 9f. Extract keys
        step "Extracting Supabase connection details"
        SUPABASE_STATUS_OUT=$($SUPABASE_SUDO_CMD status 2>&1 || true)
        SUPA_LOG_CONTENT=""; [[ -f "${SUPA_START_LOG:-}" ]] && SUPA_LOG_CONTENT=$(cat "$SUPA_START_LOG")
        _extract_key() {
            local val
            val=$(echo "$SUPABASE_STATUS_OUT" | grep -oP "$1" | head -1 || true)
            [[ -z "$val" ]] && val=$(echo "$SUPA_LOG_CONTENT" | grep -oP "$1" | head -1 || true)
            echo "$val"
        }
        SUPA_API_URL=$(_extract_key     'API URL:\s*\K\S+')
        SUPA_ANON_KEY=$(_extract_key    'anon key:\s*\K\S+')
        [[ -z "$SUPA_ANON_KEY" ]]    && SUPA_ANON_KEY=$(_extract_key 'Publishable\s+\K\S+')
        SUPA_SERVICE_KEY=$(_extract_key 'service_role key:\s*\K\S+')
        [[ -z "$SUPA_SERVICE_KEY" ]] && SUPA_SERVICE_KEY=$(_extract_key 'Secret\s+\K\S+')
        SUPA_DB_URL=$(_extract_key      'DB URL:\s*\K\S+')
        SUPA_STUDIO_URL=$(_extract_key  'Studio URL:\s*\K\S+')
        SUPA_API_URL="${SUPA_API_URL:-http://127.0.0.1:54321}"
        SUPA_DB_URL="${SUPA_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
        SUPA_STUDIO_URL="${SUPA_STUDIO_URL:-http://127.0.0.1:54323}"
        echo "  API URL:          $SUPA_API_URL"
        echo "  Studio URL:       $SUPA_STUDIO_URL"
        echo "  anon key:         ${SUPA_ANON_KEY:-(not captured)}"
        echo "  service_role key: ${SUPA_SERVICE_KEY:-(not captured)}"

        # 9g. Storage setup via psql (post-start only)
        step "Configuring storage buckets and policies"
        STORAGE_SQL_FILE="$VITCAM_DIR/supabase/storage_setup.sql"
        cat > "$STORAGE_SQL_FILE" << 'STOREOF'
-- ============================================================================
-- VitCam Storage Setup  (post-start only — storage schema must already exist)
-- ============================================================================

-- Buckets
INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
SELECT 'vitcam-recordings', 'vitcam-recordings', TRUE, 52428800,
       ARRAY['video/mp4','video/webm','video/quicktime',
             'image/jpeg','image/png','image/webp']::TEXT[],
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vitcam-recordings');

INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
SELECT 'detection-images', 'detection-images', TRUE, NULL,
       ARRAY['image/*']::TEXT[],
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'detection-images');

-- RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all storage policies (idempotent)
DO $$
DECLARE pol TEXT;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE tablename = 'buckets' AND schemaname = 'storage' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.buckets', pol);
  END LOOP;
END $$;

CREATE POLICY "vitcam_rec_select" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'vitcam-recordings');
CREATE POLICY "vitcam_rec_insert" ON storage.objects
    FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'vitcam-recordings');
CREATE POLICY "vitcam_rec_update" ON storage.objects
    FOR UPDATE TO anon, authenticated USING (bucket_id = 'vitcam-recordings');
CREATE POLICY "vitcam_rec_delete" ON storage.objects
    FOR DELETE TO anon, authenticated USING (bucket_id = 'vitcam-recordings');

CREATE POLICY "det_img_select" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'detection-images');
CREATE POLICY "det_img_insert" ON storage.objects
    FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'detection-images');
CREATE POLICY "det_img_update" ON storage.objects
    FOR UPDATE TO anon, authenticated USING (bucket_id = 'detection-images');
CREATE POLICY "det_img_delete" ON storage.objects
    FOR DELETE TO anon, authenticated USING (bucket_id = 'detection-images');

CREATE POLICY "service_role_full_access" ON storage.objects
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "bucket_public_read" ON storage.buckets
    FOR SELECT TO anon, authenticated USING (true);

SELECT 'Storage setup complete' AS status;

STOREOF
        command -v psql &>/dev/null || sudo apt-get install -y -qq postgresql-client
        _RUN_DB_URL="${SUPA_DB_URL}"
        if PGPASSWORD=postgres psql "$_RUN_DB_URL" -c "SELECT 1" &>/dev/null 2>&1; then
            set +e
            PSQL_OUT=$(PGPASSWORD=postgres psql "$_RUN_DB_URL" --no-password -f "$STORAGE_SQL_FILE" 2>&1)
            PSQL_EXIT=$?; set -e
            [[ $PSQL_EXIT -eq 0 ]] && ok "Storage buckets and policies configured" || {
                warn "Storage SQL failed (exit $PSQL_EXIT):"; echo "$PSQL_OUT"
                warn "Re-run: psql '$_RUN_DB_URL' -f ~/vitcam/supabase/storage_setup.sql"
            }
        else
            warn "DB not reachable — skipping storage SQL"
            warn "Re-run after supabase start: psql '$_RUN_DB_URL' -f ~/vitcam/supabase/storage_setup.sql"
        fi
    fi

    # Save credentials
    CREDS_FILE="$VITCAM_DIR/supabase/.local-credentials"
    mkdir -p "$(dirname "$CREDS_FILE")"
    cat > "$CREDS_FILE" << CREDSEOF
# VitCam Local Supabase Credentials — $(date)
# LOCAL DEVELOPMENT ONLY
SUPABASE_API_URL=${SUPA_API_URL}
SUPABASE_STUDIO_URL=${SUPA_STUDIO_URL}
SUPABASE_DB_URL=${SUPA_DB_URL}
SUPABASE_ANON_KEY=${SUPA_ANON_KEY:-run: cd ~/vitcam and supabase status}
SUPABASE_SERVICE_ROLE_KEY=${SUPA_SERVICE_KEY:-run: cd ~/vitcam and supabase status}
CREDSEOF
    ok "Credentials saved: $CREDS_FILE"

fi  # end server/supabase block

# ─── 10. SYSTEMD SERVICE (server only) ────────────────────────────────────────
if [[ "$INSTALL_SERVER" == "true" ]]; then
    step "Creating systemd service (vitcam.service)"
    PYTHON_EXEC="$VENV_DIR/bin/python"
    MAIN_PY="$SERVER_DIR/main.py"
    [[ ! -f "$MAIN_PY" ]] && MAIN_PY="$SERVER_DIR/vitcam-server.py"

    SERVICE_CONTENT="[Unit]
Description=VitCam Camera Service
After=network.target

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$SERVER_DIR
ExecStart=$PYTHON_EXEC $MAIN_PY
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=\"PATH=$VENV_DIR/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin\"

[Install]
WantedBy=multi-user.target
"
    if _systemd_active; then
        echo "$SERVICE_CONTENT" | sudo tee /etc/systemd/system/vitcam.service > /dev/null
        sudo systemctl daemon-reload
        sudo systemctl enable vitcam.service
        ok "systemd service installed and enabled"
    else
        echo "$SERVICE_CONTENT" > "$HOME/vitcam.service"
        warn "systemd not active — service saved to ~/vitcam.service"
        warn "Enable systemd then run: sudo cp ~/vitcam.service /etc/systemd/system/ && sudo systemctl enable vitcam"
    fi
fi

# ─── 11. ENV FILES ────────────────────────────────────────────────────────────
step "Writing .env files"
if [[ "$INSTALL_SERVER" == "true" && ! -f "$SERVER_DIR/.env" ]]; then
    mkdir -p "$SERVER_DIR"
    cat > "$SERVER_DIR/.env" << ENVEOF
# VitCam Backend
SUPABASE_URL=${SUPA_API_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPA_SERVICE_KEY:-your_service_role_key_here}
SUPABASE_ANON_KEY=${SUPA_ANON_KEY:-your_anon_key_here}
SUPABASE_DB_URL=${SUPA_DB_URL}
SIGNALING_HOST=0.0.0.0
SIGNALING_PORT=8765
DEFAULT_MODEL=rfdetr
DETECTION_CONFIDENCE=0.5
DEVICE=cuda
SSL_CERT_FILE=
SSL_KEY_FILE=
ENVEOF
    ok "Backend .env written: $SERVER_DIR/.env"
elif [[ "$INSTALL_SERVER" == "true" ]]; then
    ok "Backend .env already exists — not overwritten"
fi

if [[ "$INSTALL_CLIENT" == "true" && ! -f "$FRONTEND_DIR/.env.local" ]]; then
    mkdir -p "$FRONTEND_DIR"
    cat > "$FRONTEND_DIR/.env.local" << ENVEOF
# VitCam Frontend
NEXT_PUBLIC_SUPABASE_URL=${SUPA_API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPA_ANON_KEY:-your_anon_key_here}
NEXT_PUBLIC_SIGNALING_WS_URL=ws://localhost:8765
ENVEOF
    ok "Frontend .env.local written: $FRONTEND_DIR/.env.local"
elif [[ "$INSTALL_CLIENT" == "true" ]]; then
    ok "Frontend .env.local already exists — not overwritten"
fi

# ─── 12. WSL.CONF — SYSTEMD (WSL2 only) ──────────────────────────────────────
if [[ "$INSTALL_SERVER" == "true" && "$IS_WSL" == "true" ]]; then
    grep -q "systemd=true" /etc/wsl.conf 2>/dev/null \
        && ok "systemd already enabled in /etc/wsl.conf" || {
        printf '\n[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf > /dev/null
        ok "Added systemd=true to /etc/wsl.conf"
        warn "Run 'wsl --shutdown' from PowerShell then relaunch Ubuntu to activate."
    }
elif [[ "$INSTALL_SERVER" == "true" ]]; then
    ok "Native Ubuntu — systemd active by default, no wsl.conf needed"
fi

# ─── 13. SUMMARY ──────────────────────────────────────────────────────────────
_MODE_LABEL="Client only"
[[ "$INSTALL_SERVER" == "true" && "$INSTALL_CLIENT" == "true" ]] && _MODE_LABEL="Both (server + client)"
[[ "$INSTALL_SERVER" == "true" && "$INSTALL_CLIENT" == "false" ]] && _MODE_LABEL="Server only"

echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              VitCam Installation Complete!                          ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
printf "║  Mode:  %-62s║\n" "$_MODE_LABEL"
echo "║  Log:   ~/vitcam-install.log                                         ║"
if [[ "$INSTALL_SERVER" == "true" ]]; then
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  Supabase local                                                      ║"
printf "║    Studio: %-59s║\n" "${SUPA_STUDIO_URL}"
printf "║    API:    %-59s║\n" "${SUPA_API_URL}"
echo "║    Keys:   ~/vitcam/supabase/.local-credentials                      ║"
echo "║    Manage: cd ~/vitcam && supabase status                            ║"
fi
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  NEXT STEPS                                                          ║"
if [[ "$INSTALL_SERVER" == "true" ]]; then
echo "║                                                                      ║"
echo "║  1. Verify keys:  cat ~/vitcam/supabase/.local-credentials           ║"
echo "║  2. Start backend: sudo systemctl start vitcam                       ║"
echo "║     Logs:          sudo journalctl -u vitcam -f                      ║"
echo "║  3. Verify GPU:    source ~/vitcam/server/vitcam-server/bin/activate ║"
echo "║                    python -c 'import torch; print(torch.cuda.is_available())'"
echo "║  Create your first user:                                             ║"
echo "║    Studio: http://127.0.0.1:54323 → Authentication → Users → Add   ║"
echo "║    API:    POST /auth/v1/admin/users  (Bearer <service_role_key>)   ║"
fi
if [[ "$INSTALL_CLIENT" == "true" ]]; then
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  Frontend (PM2)                                                      ║"
printf "║    URL:     http://localhost:%-41s║\n" "${FRONTEND_PORT:-3000}"
echo "║    Status:  pm2 status                                               ║"
echo "║    Logs:    pm2 logs vitcam-frontend                                 ║"
echo "║    Restart: pm2 restart vitcam-frontend                              ║"
echo "║    Rebuild: ~/vitcam-rebuild-frontend.sh                             ║"
fi
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

exit 0
