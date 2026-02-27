#!/usr/bin/env bash
# =============================================================================
#  VitCam — Uninstaller (Ubuntu 24.04 / WSL2)
#
#  Mirrors the install modes of install-vitcam.sh.
#  Shared tools (Docker, pyenv, nvm, CUDA) are kept by default
#  and only removed when explicitly opted in.
#
#  Interactive:     chmod +x uninstall-vitcam.sh && ./uninstall-vitcam.sh
#  Non-interactive: UNINSTALL_MODE=both ./uninstall-vitcam.sh
#
#  Optional flags (set as env vars before running):
#    REMOVE_DOCKER=true      — also uninstall Docker Engine
#    REMOVE_PYENV=true       — also remove pyenv + Python 3.10.11
#    REMOVE_NVM=true         — also remove nvm + Node.js
#    REMOVE_CUDA=true        — also remove CUDA toolkit packages
#    REMOVE_SUPABASE_DATA=true  — pass --no-backup to supabase stop
#                                 (wipes local DB volumes, irreversible)
# =============================================================================
set -euo pipefail

# ─── CONFIGURATION (must match installer values) ──────────────────────────────
PYTHON_VERSION="3.10.11"
NODE_VERSION="20"
VITCAM_DIR="$HOME/vitcam"
VENV_NAME="vitcam-server"
SERVER_DIR="$VITCAM_DIR/server"
FRONTEND_DIR="$VITCAM_DIR/frontend"
VENV_DIR="$SERVER_DIR/$VENV_NAME"
LOG_FILE="$HOME/vitcam-uninstall.log"
SUPABASE_BIN="$HOME/.local/bin/supabase"

# ─── COLOURS & HELPERS ────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
step()  { echo -e "\n${CYAN}${BOLD}==> $*${RESET}"; }
ok()    { echo -e "${GREEN}[OK]  $*${RESET}"; }
warn()  { echo -e "${YELLOW}[WARN] $*${RESET}"; }
skip()  { echo -e "${YELLOW}[SKIP] $*${RESET}"; }
info()  { echo -e "      $*"; }
_systemd_active() { systemctl is-system-running 2>/dev/null | grep -qE '^(running|degraded)$'; }

exec > >(tee -a "$LOG_FILE") 2>&1

# ─── BANNER ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${RED}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${RED}║           VitCam Uninstaller (Ubuntu 24.04)              ║${RESET}"
echo -e "${BOLD}${RED}╚══════════════════════════════════════════════════════════╝${RESET}"
echo -e "  Log: $LOG_FILE"
echo ""

# ─── ENVIRONMENT DETECTION ───────────────────────────────────────────────────
IS_WSL=false
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
REAL_USER="$(whoami)"

# ─── 0. UNINSTALL MODE ────────────────────────────────────────────────────────
REMOVE_SERVER=false
REMOVE_CLIENT=false

if [[ -n "${UNINSTALL_MODE:-}" ]]; then
    case "${UNINSTALL_MODE,,}" in
        server) REMOVE_SERVER=true ;;
        client) REMOVE_CLIENT=true ;;
        both)   REMOVE_SERVER=true; REMOVE_CLIENT=true ;;
        *) echo -e "${RED}Invalid UNINSTALL_MODE='$UNINSTALL_MODE'. Use: server | client | both${RESET}"; exit 1 ;;
    esac
    echo -e "  Mode: ${BOLD}${UNINSTALL_MODE^^}${RESET} (from UNINSTALL_MODE env var)"
else
    echo -e "${BOLD}  What would you like to uninstall?${RESET}"
    echo ""
    echo -e "    ${CYAN}1)${RESET} ${BOLD}Server only${RESET}  — vitcam.service, Supabase stack, pyenv/Python, venv"
    echo -e "    ${CYAN}2)${RESET} ${BOLD}Client only${RESET}  — PM2 process, nvm/Node.js, frontend build"
    echo -e "    ${CYAN}3)${RESET} ${BOLD}Both${RESET}         — Full removal (all of the above + repo)"
    echo ""
    while true; do
        read -rp "  Enter choice [1/2/3]: " _choice
        case "$_choice" in
            1) REMOVE_SERVER=true; break ;;
            2) REMOVE_CLIENT=true; break ;;
            3) REMOVE_SERVER=true; REMOVE_CLIENT=true; break ;;
            *) echo "  Please enter 1, 2, or 3." ;;
        esac
    done
fi

# ─── SHARED TOOL OPTIONS (interactive when not set via env) ───────────────────
_ask_yn() {
    # _ask_yn "Question" VAR_NAME default(y/n)
    local question="$1" varname="$2" default="${3:-n}"
    if [[ -n "${!varname:-}" ]]; then return; fi
    local answer
    read -rp "  $question [y/N]: " answer
    answer="${answer:-$default}"
    printf -v "$varname" '%s' "$( [[ "${answer,,}" == "y" ]] && echo "true" || echo "false" )"
}

echo ""
echo -e "${BOLD}  Shared tool removal (safe to keep if used elsewhere):${RESET}"
if [[ "$REMOVE_SERVER" == "true" ]]; then
    _ask_yn "Remove Docker Engine?          (keep if used outside VitCam)" REMOVE_DOCKER
    _ask_yn "Remove pyenv + Python $PYTHON_VERSION?  (keep if used outside VitCam)" REMOVE_PYENV
    _ask_yn "Remove CUDA toolkit packages?  (keep if used by other projects)" REMOVE_CUDA
fi
if [[ "$REMOVE_CLIENT" == "true" ]]; then
    _ask_yn "Remove nvm + Node.js $NODE_VERSION?    (keep if used outside VitCam)" REMOVE_NVM
fi
if [[ "$REMOVE_SERVER" == "true" ]]; then
    echo ""
    echo -e "  ${RED}${BOLD}⚠  Database warning:${RESET}"
    echo -e "  Supabase stores all VitCam data (cameras, detections, recordings)"
    echo -e "  in local Docker volumes. Removing them is ${RED}${BOLD}irreversible${RESET}."
    _ask_yn "Remove Supabase Docker volumes? (all local DB data will be deleted)" REMOVE_SUPABASE_DATA
fi

# ─── CONFIRM ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  The following will be removed:${RESET}"
echo ""
if [[ "$REMOVE_SERVER" == "true" ]]; then
    echo -e "  ${RED}✗${RESET} vitcam.service (systemd)"
    echo -e "  ${RED}✗${RESET} Supabase local stack (containers + CLI)"
    [[ "${REMOVE_SUPABASE_DATA:-false}" == "true" ]] && \
        echo -e "  ${RED}✗${RESET} Supabase Docker volumes  ← ALL LOCAL DATA"
    [[ "${REMOVE_PYENV:-false}"  == "true" ]] && echo -e "  ${RED}✗${RESET} pyenv + Python $PYTHON_VERSION  (~/.pyenv)"
    [[ "${REMOVE_DOCKER:-false}" == "true" ]] && echo -e "  ${RED}✗${RESET} Docker Engine"
    [[ "${REMOVE_CUDA:-false}"   == "true" ]] && echo -e "  ${RED}✗${RESET} CUDA toolkit packages"
fi
if [[ "$REMOVE_CLIENT" == "true" ]]; then
    echo -e "  ${RED}✗${RESET} PM2 vitcam-frontend process"
    [[ "${REMOVE_NVM:-false}" == "true" ]] && echo -e "  ${RED}✗${RESET} nvm + Node.js  (~/.nvm)"
fi
if [[ "$REMOVE_SERVER" == "true" || "$REMOVE_CLIENT" == "true" ]]; then
    echo -e "  ${RED}✗${RESET} VitCam repository  ($VITCAM_DIR)"
    echo -e "  ${RED}✗${RESET} Helper scripts and .env files"
    echo -e "  ${RED}✗${RESET} ~/.bashrc entries added by VitCam installer"
fi
echo ""
echo -e "  ${YELLOW}System apt packages installed in step 2 of the installer are NOT${RESET}"
echo -e "  ${YELLOW}removed — they are likely shared by other system software.${RESET}"
echo ""

read -rp "  Type 'yes' to continue, anything else to abort: " _confirm
if [[ "$_confirm" != "yes" ]]; then
    echo -e "\n  ${YELLOW}Aborted — nothing was changed.${RESET}\n"
    exit 0
fi

# =============================================================================
#  REMOVAL STEPS
# =============================================================================

# ─── 1. CLIENT — PM2 FRONTEND ─────────────────────────────────────────────────
if [[ "$REMOVE_CLIENT" == "true" ]]; then
    step "Stopping PM2 vitcam-frontend process"
    if command -v pm2 &>/dev/null; then
        pm2 delete vitcam-frontend 2>/dev/null && ok "vitcam-frontend removed from PM2" \
            || skip "vitcam-frontend was not in PM2 process list"
        pm2 save --force 2>/dev/null || true
        # Remove PM2 startup hook
        PM2_UNSTARTUP=$(pm2 unstartup 2>&1 | grep 'sudo' | tail -1 || true)
        if [[ -n "$PM2_UNSTARTUP" ]]; then
            eval "$PM2_UNSTARTUP" 2>/dev/null \
                && ok "PM2 startup hook removed" \
                || warn "Could not remove PM2 startup hook — run manually: pm2 unstartup"
        fi
        # Only fully uninstall PM2 if no other processes remain
        PM2_PROCS=$(pm2 jlist 2>/dev/null | python3 -c \
            "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
        if [[ "$PM2_PROCS" == "0" ]]; then
            npm uninstall -g pm2 --silent 2>/dev/null \
                && ok "PM2 uninstalled (no other processes were using it)" \
                || warn "PM2 uninstall failed — remove manually: npm uninstall -g pm2"
        else
            skip "PM2 has $PM2_PROCS other process(es) — keeping PM2 installed"
        fi
    else
        skip "PM2 not found on PATH"
    fi

    step "Removing rebuild helper script"
    rm -f "$HOME/vitcam-rebuild-frontend.sh" \
        && ok "Removed ~/vitcam-rebuild-frontend.sh" \
        || skip "~/vitcam-rebuild-frontend.sh not found"
fi

# ─── 2. SERVER — SYSTEMD SERVICE ──────────────────────────────────────────────
if [[ "$REMOVE_SERVER" == "true" ]]; then
    step "Stopping and removing vitcam systemd service"
    if _systemd_active && [[ -f /etc/systemd/system/vitcam.service ]]; then
        sudo systemctl stop    vitcam.service 2>/dev/null || true
        sudo systemctl disable vitcam.service 2>/dev/null || true
        sudo rm -f /etc/systemd/system/vitcam.service
        sudo systemctl daemon-reload
        ok "vitcam.service stopped, disabled, and removed"
    else
        skip "/etc/systemd/system/vitcam.service not found (systemd not active or service not installed)"
    fi
    # Remove the fallback file written when systemd was not active at install time
    rm -f "$HOME/vitcam.service" && ok "Removed ~/vitcam.service" 2>/dev/null || true
fi

# ─── 3. SERVER — SUPABASE STACK ───────────────────────────────────────────────
if [[ "$REMOVE_SERVER" == "true" ]]; then
    step "Stopping Supabase local stack"
    export DOCKER_HOST="unix:///var/run/docker.sock"
    SUPABASE_CMD="$(command -v supabase 2>/dev/null || echo "$SUPABASE_BIN")"

    if [[ -x "$SUPABASE_CMD" ]] && [[ -f "$VITCAM_DIR/supabase/config.toml" ]]; then
        cd "$VITCAM_DIR"
        if [[ "${REMOVE_SUPABASE_DATA:-false}" == "true" ]]; then
            info "Running: supabase stop --no-backup  (volumes will be deleted)"
            sudo -E env DOCKER_HOST="$DOCKER_HOST" "$SUPABASE_CMD" stop --no-backup 2>/dev/null \
                && ok "Supabase stopped and volumes removed" \
                || warn "supabase stop --no-backup failed — volumes may need manual cleanup"
            info "Removing any lingering supabase Docker volumes..."
            sudo docker volume ls --format '{{.Name}}' 2>/dev/null \
                | grep -E '^supabase_' \
                | xargs -r sudo docker volume rm 2>/dev/null \
                && ok "Supabase Docker volumes removed" || true
        else
            info "Running: supabase stop  (volumes preserved)"
            sudo -E env DOCKER_HOST="$DOCKER_HOST" "$SUPABASE_CMD" stop 2>/dev/null \
                && ok "Supabase stopped (data volumes preserved)" \
                || warn "supabase stop failed — containers may still be running"
        fi
        cd "$HOME"
    else
        skip "Supabase CLI not found or project not initialised — skipping supabase stop"
        # Attempt a best-effort container cleanup by name pattern
        if command -v docker &>/dev/null || sudo docker info &>/dev/null 2>&1; then
            info "Attempting best-effort Docker container cleanup (supabase_* pattern)..."
            sudo docker ps -a --format '{{.Names}}' 2>/dev/null \
                | grep -E '^supabase_' \
                | xargs -r sudo docker rm -f 2>/dev/null \
                && ok "Supabase containers removed" || true
        fi
    fi

    step "Removing Supabase CLI binary"
    if [[ -x "$SUPABASE_BIN" ]]; then
        rm -f "$SUPABASE_BIN"
        ok "Removed $SUPABASE_BIN"
    elif command -v supabase &>/dev/null; then
        SUPA_PATH="$(command -v supabase)"
        sudo rm -f "$SUPA_PATH" \
            && ok "Removed $SUPA_PATH" \
            || warn "Could not remove $SUPA_PATH — remove manually: sudo rm $SUPA_PATH"
    else
        skip "Supabase CLI binary not found"
    fi
fi

# ─── 4. SERVER — PYENV + PYTHON ───────────────────────────────────────────────
if [[ "$REMOVE_SERVER" == "true" ]]; then
    if [[ "${REMOVE_PYENV:-false}" == "true" ]]; then
        step "Removing pyenv and Python $PYTHON_VERSION"
        if [[ -d "$HOME/.pyenv" ]]; then
            rm -rf "$HOME/.pyenv"
            ok "Removed ~/.pyenv (Python $PYTHON_VERSION and all other pyenv versions)"
        else
            skip "~/.pyenv not found"
        fi
    else
        # Just remove the specific Python version installed by VitCam,
        # leaving pyenv and other versions intact.
        step "Removing Python $PYTHON_VERSION from pyenv (keeping pyenv)"
        if [[ -d "$HOME/.pyenv/versions/$PYTHON_VERSION" ]]; then
            export PYENV_ROOT="$HOME/.pyenv"
            export PATH="$PYENV_ROOT/bin:$PATH"
            eval "$("$PYENV_ROOT/bin/pyenv" init --path 2>/dev/null)" 2>/dev/null || true
            "$PYENV_ROOT/bin/pyenv" uninstall -f "$PYTHON_VERSION" 2>/dev/null \
                && ok "Python $PYTHON_VERSION uninstalled from pyenv" \
                || { rm -rf "$HOME/.pyenv/versions/$PYTHON_VERSION"
                     ok "Python $PYTHON_VERSION removed manually"; }
        else
            skip "Python $PYTHON_VERSION not found in pyenv"
        fi
    fi
fi

# ─── 5. CLIENT — NVM + NODE.JS ────────────────────────────────────────────────
if [[ "$REMOVE_CLIENT" == "true" ]]; then
    if [[ "${REMOVE_NVM:-false}" == "true" ]]; then
        step "Removing nvm and Node.js"
        if [[ -d "$HOME/.nvm" ]]; then
            # Unload nvm if active in this shell
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" 2>/dev/null || true
            rm -rf "$HOME/.nvm"
            ok "Removed ~/.nvm (all Node.js versions)"
        else
            skip "~/.nvm not found"
        fi
    else
        step "Removing Node.js $NODE_VERSION from nvm (keeping nvm)"
        if [[ -d "$HOME/.nvm" ]]; then
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" 2>/dev/null || true
            if nvm ls "$NODE_VERSION" &>/dev/null 2>&1; then
                nvm uninstall "$NODE_VERSION" 2>/dev/null \
                    && ok "Node.js $NODE_VERSION uninstalled from nvm" \
                    || warn "nvm uninstall $NODE_VERSION failed — run manually"
            else
                skip "Node.js $NODE_VERSION not found in nvm"
            fi
        else
            skip "~/.nvm not found"
        fi
    fi
fi

# ─── 6. SERVER — DOCKER ENGINE ────────────────────────────────────────────────
if [[ "$REMOVE_SERVER" == "true" && "${REMOVE_DOCKER:-false}" == "true" ]]; then
    step "Removing Docker Engine"
    sudo systemctl stop docker docker.socket containerd 2>/dev/null || true
    sudo apt-get remove -y --purge \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin 2>/dev/null \
        && ok "Docker packages removed" \
        || warn "Docker apt removal encountered errors — some packages may remain"
    sudo apt-get autoremove -y --purge 2>/dev/null || true
    sudo rm -f /etc/apt/sources.list.d/docker.list
    sudo rm -f /etc/apt/keyrings/docker.gpg
    sudo apt-get update -qq 2>/dev/null || true
    ok "Docker apt source and keyring removed"
    # Remove user from docker group
    if groups "$REAL_USER" 2>/dev/null | grep -q docker; then
        sudo gpasswd -d "$REAL_USER" docker 2>/dev/null \
            && ok "Removed $REAL_USER from docker group" \
            || warn "Could not remove $REAL_USER from docker group"
    fi
else
    [[ "$REMOVE_SERVER" == "true" ]] && skip "Docker Engine kept (REMOVE_DOCKER not set)"
fi

# ─── 7. SERVER — CUDA TOOLKIT ─────────────────────────────────────────────────
if [[ "$REMOVE_SERVER" == "true" && "${REMOVE_CUDA:-false}" == "true" ]]; then
    step "Removing CUDA toolkit packages"
    set +e
    sudo apt-get remove -y --purge \
        'cuda-toolkit-*' 'cuda-toolkit' 'cuda-keyring' 2>/dev/null
    sudo apt-get autoremove -y --purge 2>/dev/null || true
    # Remove NVIDIA CUDA apt source and keyring
    sudo rm -f /etc/apt/sources.list.d/cuda-*.list \
               /etc/apt/sources.list.d/nvidia-*.list \
               /usr/share/keyrings/cuda-archive-keyring.gpg 2>/dev/null || true
    sudo apt-get update -qq 2>/dev/null || true
    set -e
    ok "CUDA packages and apt sources removed"
else
    [[ "$REMOVE_SERVER" == "true" ]] && skip "CUDA toolkit kept (REMOVE_CUDA not set)"
fi

# ─── 8. VITCAM REPOSITORY ─────────────────────────────────────────────────────
# Removal is mode-aware so a partial uninstall doesn't destroy the other half.
#   both   → remove entire ~/vitcam
#   server → remove server/ and supabase/, preserve frontend/ if present
#   client → remove frontend/, preserve server/ if present
# In all cases, if ~/vitcam ends up empty afterwards it is also removed.
step "Removing VitCam files"
if [[ ! -d "$VITCAM_DIR" ]]; then
    skip "$VITCAM_DIR not found"
elif [[ "$REMOVE_SERVER" == "true" && "$REMOVE_CLIENT" == "true" ]]; then
    # Supabase and server dirs may contain root-owned files — use sudo
    sudo rm -rf "$VITCAM_DIR"
    ok "Removed $VITCAM_DIR (full)"
else
    if [[ "$REMOVE_SERVER" == "true" ]]; then
        # server venv and supabase dirs can have root-owned files
        sudo rm -rf "$SERVER_DIR"
        ok "Removed $SERVER_DIR"
        sudo rm -rf "$VITCAM_DIR/supabase"
        ok "Removed $VITCAM_DIR/supabase"
        rm -f "$VITCAM_DIR/.python-version" 2>/dev/null || true
    fi
    if [[ "$REMOVE_CLIENT" == "true" ]]; then
        rm -rf "$FRONTEND_DIR"
        ok "Removed $FRONTEND_DIR"
    fi
    # If nothing meaningful remains, remove the whole directory
    _remaining=$(find "$VITCAM_DIR" -mindepth 1 -not -path '*/.git*' 2>/dev/null | wc -l)
    if [[ "$_remaining" -eq 0 ]]; then
        sudo rm -rf "$VITCAM_DIR"
        ok "Removed $VITCAM_DIR (nothing remaining)"
    else
        ok "Kept $VITCAM_DIR (other component still present)"
    fi
fi

# ─── 9. BASHRC CLEANUP ────────────────────────────────────────────────────────
step "Cleaning ~/.bashrc entries added by VitCam installer"
BASHRC="$HOME/.bashrc"
if [[ -f "$BASHRC" ]]; then
    # Back up before editing
    cp "$BASHRC" "${BASHRC}.vitcam-uninstall-backup"
    info "Backup written: ${BASHRC}.vitcam-uninstall-backup"

    # Remove pyenv block (server)
    if [[ "$REMOVE_SERVER" == "true" && "${REMOVE_PYENV:-false}" == "true" ]]; then
        sed -i '/# pyenv — added by VitCam installer/,/eval "\$(pyenv init -)"/d' "$BASHRC" 2>/dev/null || true
        ok "Removed pyenv block from ~/.bashrc"
    fi

    # Remove nvm block (client)
    if [[ "$REMOVE_CLIENT" == "true" && "${REMOVE_NVM:-false}" == "true" ]]; then
        sed -i '/# nvm — added by VitCam installer/,/\[ -s "\$NVM_DIR\/bash_completion" \]/d' "$BASHRC" 2>/dev/null || true
        ok "Removed nvm block from ~/.bashrc"
    fi

    # Remove .local/bin PATH line (server — Supabase CLI path)
    if [[ "$REMOVE_SERVER" == "true" ]]; then
        sed -i '/export PATH="\$HOME\/.local\/bin:\$PATH"/d' "$BASHRC" 2>/dev/null || true
        ok "Removed .local/bin PATH entry from ~/.bashrc"
    fi
else
    skip "~/.bashrc not found"
fi

# ─── 10. INSTALL LOG ──────────────────────────────────────────────────────────
step "Removing install log"
if [[ -f "$HOME/vitcam-install.log" ]]; then
    rm -f "$HOME/vitcam-install.log"
    ok "Removed ~/vitcam-install.log"
else
    skip "~/vitcam-install.log not found"
fi

# ─── 11. WSL.CONF — SYSTEMD ENTRY (WSL2 only, optional) ──────────────────────
if [[ "$IS_WSL" == "true" && "$REMOVE_SERVER" == "true" ]]; then
    if grep -q 'systemd=true' /etc/wsl.conf 2>/dev/null; then
        echo ""
        read -rp "  Remove 'systemd=true' from /etc/wsl.conf? [y/N]: " _wsl_answer
        if [[ "${_wsl_answer,,}" == "y" ]]; then
            sudo sed -i '/^\[boot\]$/,/^systemd=true$/{/^systemd=true$/d}' /etc/wsl.conf
            # Remove empty [boot] section if it's now empty
            sudo sed -i '/^\[boot\]$/{N;/^\[boot\]\n$/d}' /etc/wsl.conf 2>/dev/null || true
            ok "Removed systemd=true from /etc/wsl.conf"
            warn "Run 'wsl --shutdown' from PowerShell then relaunch to apply."
        else
            skip "Kept systemd=true in /etc/wsl.conf"
        fi
    fi
fi

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              VitCam Uninstall Complete                              ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  What was removed:                                                   ║"
[[ "$REMOVE_SERVER" == "true" ]] && \
echo "║    ✓ vitcam.service  ✓ Supabase CLI  ✓ venv  ✓ ~/vitcam             ║"
[[ "$REMOVE_CLIENT" == "true" ]] && \
echo "║    ✓ PM2 process  ✓ ecosystem.config.js  ✓ rebuild script            ║"
[[ "${REMOVE_PYENV:-false}"  == "true" ]] && echo "║    ✓ pyenv + Python $PYTHON_VERSION                                    ║"
[[ "${REMOVE_NVM:-false}"    == "true" ]] && echo "║    ✓ nvm + Node.js $NODE_VERSION                                        ║"
[[ "${REMOVE_DOCKER:-false}" == "true" ]] && echo "║    ✓ Docker Engine                                                   ║"
[[ "${REMOVE_CUDA:-false}"   == "true" ]] && echo "║    ✓ CUDA toolkit                                                    ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  What was NOT removed (intentionally):                               ║"
echo "║    • System apt packages (build-essential, git, curl, etc.)          ║"
[[ "${REMOVE_DOCKER:-false}" != "true" && "$REMOVE_SERVER" == "true" ]] && \
echo "║    • Docker Engine  (use REMOVE_DOCKER=true to include)              ║"
[[ "${REMOVE_PYENV:-false}" != "true" && "$REMOVE_SERVER" == "true" ]] && \
echo "║    • pyenv / Python  (use REMOVE_PYENV=true to include)              ║"
[[ "${REMOVE_NVM:-false}" != "true" && "$REMOVE_CLIENT" == "true" ]] && \
echo "║    • nvm / Node.js   (use REMOVE_NVM=true to include)                ║"
[[ "${REMOVE_CUDA:-false}" != "true" && "$REMOVE_SERVER" == "true" ]] && \
echo "║    • CUDA toolkit    (use REMOVE_CUDA=true to include)               ║"
[[ "${REMOVE_SUPABASE_DATA:-false}" != "true" && "$REMOVE_SERVER" == "true" ]] && \
echo "║    • Supabase Docker volumes / local DB data                         ║"
echo "║    • ~/.bashrc backup: ~/.bashrc.vitcam-uninstall-backup             ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                                         ║"
echo "║    • Open a new shell (or: source ~/.bashrc) to apply PATH changes   ║"
[[ "${REMOVE_SUPABASE_DATA:-false}" != "true" && "$REMOVE_SERVER" == "true" ]] && {
echo "║    • To also remove Supabase data volumes later:                     ║"
echo "║        sudo docker volume ls | grep supabase_                        ║"
echo "║        sudo docker volume rm <volume-name>                           ║"
}
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

exit 0
