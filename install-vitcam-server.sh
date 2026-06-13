#!/usr/bin/env bash
# =============================================================================
#  VitCam — SERVER installer (Python backend only)  ·  Ubuntu 24.04 / WSL2
#
#  Scope: this installer sets up ONLY the Python detection/streaming server.
#    • pyenv + Python 3.10.11
#    • clone repo, create venv, install requirements + rfdetr
#    • CUDA toolkit + PyTorch (GPU), or CPU-only PyTorch
#    • systemd service (vitcam.service)
#    • server/.env with sensible defaults
#
#  Explicitly NOT handled (do these yourself):
#    • Supabase (CLI / start / schema) — the server reads SUPABASE_* from .env
#    • Frontend (Node.js / Next.js)
#    • Docker — not needed by the Python server
#
#  Usage:
#    chmod +x install-vitcam-server.sh && ./install-vitcam-server.sh
#  Env overrides:
#    INSTALL_CUDA=false ./install-vitcam-server.sh      # CPU-only PyTorch
#    VITCAM_REPO=<git-url>  PYTORCH_CUDA_TAG=cu130  CUDA_TOOLKIT_VER=13.1
# =============================================================================

# ─── WSL2 GUARD: CRLF line endings ────────────────────────────────────────────
# A Windows-saved copy gets \r\n endings; bash then dies with "$'\r': command
# not found". Each line here ends with '#' so the stray \r is swallowed by the
# comment — letting the guard convert the file to LF and re-exec itself. Must
# stay ABOVE `set -euo pipefail` (that line is the first CRLF casualty).
if grep -q $'\r' "$0" 2>/dev/null; then #
    echo "[FIX] Windows (CRLF) line endings detected - converting to LF and re-running..." #
    _LF_SELF=$(mktemp /tmp/install-vitcam-server-lf.XXXXXX.sh) #
    tr -d '\r' < "$0" > "$_LF_SELF" #
    chmod +x "$_LF_SELF" #
    exec /usr/bin/env bash "$_LF_SELF" "$@" #
fi #

set -euo pipefail

# ─── NON-INTERACTIVE APT ──────────────────────────────────────────────────────
# Ubuntu 24.04's needrestart pops interactive dialogs mid-install that hang the
# script in WSL2. sudo strips env vars, so pass them through `env` explicitly.
SUDO_APT="sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a NEEDRESTART_SUSPEND=1 apt-get -o Dpkg::Options::=--force-confold"

# ─── CONFIGURATION ────────────────────────────────────────────────────────────
VITCAM_REPO="${VITCAM_REPO:-https://github.com/scwsoft/vitcam.git}"
INSTALL_CUDA="${INSTALL_CUDA:-true}"
PYTORCH_CUDA_TAG="${PYTORCH_CUDA_TAG:-cu130}"
CUDA_TOOLKIT_VER="${CUDA_TOOLKIT_VER:-13.1}"
PYTHON_VERSION="3.10.11"
VITCAM_DIR="$HOME/vitcam"
VENV_NAME="vitcam-server"
LOG_FILE="$HOME/vitcam-install.log"

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
echo -e "${BOLD}║          VitCam SERVER Installer (Python only)           ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo -e "  Repo: $VITCAM_REPO"
echo -e "  Log:  $LOG_FILE"
[[ "$INSTALL_CUDA" == "true" ]] \
    && echo -e "  GPU:  CUDA $CUDA_TOOLKIT_VER + PyTorch $PYTORCH_CUDA_TAG" \
    || echo -e "  GPU:  disabled (CPU-only PyTorch)"
echo ""

# ─── 1. SANITY CHECKS ─────────────────────────────────────────────────────────
step "Sanity checks"
IS_WSL=false
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
if [[ "$IS_WSL" == "true" ]]; then
    ok "Environment: WSL2"
    # Windows PATH interop pollutes WSL's PATH with /mnt/c/... entries, so
    # python.exe etc. can shadow the Linux tools and break pyenv detection.
    # Strip /mnt/<drive>/ entries for this session (keep /mnt/wsl/*).
    PATH="$(echo "$PATH" | tr ':' '\n' | grep -vE '^/mnt/[a-zA-Z]/' | paste -sd: -)"
    export PATH
    hash -r
    ok "Windows (/mnt/<drive>/) entries stripped from PATH for this install"

    _MEM_GB=$(awk '/MemTotal/ {printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo 0)
    if [[ "$_MEM_GB" -lt 6 ]]; then
        warn "Only ${_MEM_GB} GB RAM visible to WSL2 — large pip builds may be OOM-killed."
        warn "Increase it in C:\\Users\\<you>\\.wslconfig:  [wsl2]  memory=12GB  then 'wsl --shutdown'"
    fi
else
    ok "Environment: Native Ubuntu"
fi
[[ "$EUID" -eq 0 ]] && warn "Running as root — service paths will use /root"
REAL_USER="$(whoami)"
SERVER_DIR="$VITCAM_DIR/server"
VENV_DIR="$SERVER_DIR/$VENV_NAME"
PYTHON_BIN="$HOME/.pyenv/versions/$PYTHON_VERSION/bin/python"

# ─── 2. SYSTEM PACKAGES ───────────────────────────────────────────────────────
step "Updating apt and installing system dependencies"
$SUDO_APT update -qq
$SUDO_APT upgrade -y -qq
# Build deps for compiling Python via pyenv, plus the FFmpeg stack the server
# needs to OPEN and DECODE RTSP streams. Missing FFmpeg libs are the #1 cause
# of "RTSP won't play": cv2.VideoCapture("rtsp://...") silently returns empty
# frames when libavformat/libavcodec aren't present. The `ffmpeg` CLI is also
# installed so RTSP can be tested independently of Python (see summary).
$SUDO_APT install -y -qq \
    git curl wget unzip make ca-certificates gnupg lsb-release \
    build-essential libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev llvm libncurses-dev xz-utils \
    tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev \
    python3-openssl \
    ffmpeg \
    libavcodec-extra libavformat-dev libavutil-dev libswscale-dev \
    libavdevice-dev libavfilter-dev libswresample-dev \
    libx264-dev libx265-dev \
    libgl1 libglib2.0-0 \
    software-properties-common jq dos2unix
ok "System packages installed (incl. FFmpeg stack for RTSP)"

# ─── 3. PYENV + PYTHON ────────────────────────────────────────────────────────
step "Installing pyenv + Python $PYTHON_VERSION"
if [[ -d "$HOME/.pyenv" ]]; then
    ok "pyenv present — updating"; (cd "$HOME/.pyenv" && git pull --quiet) || warn "pyenv update skipped"
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

# ─── 4. CLONE REPO ────────────────────────────────────────────────────────────
step "Cloning VitCam repository"
if [[ -d "$VITCAM_DIR/.git" ]]; then
    ok "Already cloned — pulling latest"; git -C "$VITCAM_DIR" pull --quiet || warn "git pull skipped"
elif [[ -d "$VITCAM_DIR" ]]; then
    warn "$VITCAM_DIR exists but is not a git repo — removing and re-cloning"
    rm -rf "$VITCAM_DIR"
    git clone "$VITCAM_REPO" "$VITCAM_DIR"; ok "Cloned to $VITCAM_DIR"
else
    git clone "$VITCAM_REPO" "$VITCAM_DIR"; ok "Cloned to $VITCAM_DIR"
fi
(cd "$VITCAM_DIR" && pyenv local "$PYTHON_VERSION")

# ─── 5. VENV + DEPENDENCIES ───────────────────────────────────────────────────
step "Setting up Python virtual environment"
[[ -x "$PYTHON_BIN" ]] || fail "pyenv Python not found at $PYTHON_BIN — the pyenv build step failed (check $LOG_FILE for compile errors; missing build deps are the usual WSL2 cause)"
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
    echo "  Installing rfdetr..."
    pip install -U rfdetr --progress-bar off --no-cache-dir 2>&1 \
        | grep -E '(Collecting|Downloading|Installing|Successfully|ERROR)' || true
    ok "rfdetr installed"
}
deactivate

# ─── 6. CUDA + PYTORCH ────────────────────────────────────────────────────────
if [[ "$INSTALL_CUDA" == "true" ]]; then
    step "Installing CUDA Toolkit $CUDA_TOOLKIT_VER"
    if command -v nvcc &>/dev/null; then
        ok "nvcc already available: $(nvcc --version | grep 'release')"
    else
        # WSL2 uses a dedicated wsl-ubuntu repo variant; native Ubuntu uses ubuntu2404.
        if [[ "$IS_WSL" == "true" ]]; then
            CUDA_KEYRING_URL="https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-keyring_1.1-1_all.deb"
        else
            CUDA_KEYRING_URL="https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb"
        fi
        TMP_DEB=$(mktemp --suffix=.deb)
        echo "  Downloading CUDA keyring..."
        if wget --show-progress "$CUDA_KEYRING_URL" -O "$TMP_DEB" 2>&1; then
            sudo dpkg -i "$TMP_DEB"; rm -f "$TMP_DEB"
            $SUDO_APT update -q
            CUDA_PKG="cuda-toolkit-$(echo "$CUDA_TOOLKIT_VER" | tr '.' '-')"
            echo ""; echo "  Installing $CUDA_PKG — large download (3-5 GB)..."; echo ""
            $SUDO_APT install -y "$CUDA_PKG" \
                || { warn "Trying generic cuda-toolkit..."
                     $SUDO_APT install -y cuda-toolkit \
                     || warn "CUDA install failed; continuing (PyTorch may fall back to CPU)"; }
            ok "CUDA toolkit installed"
        else
            warn "CUDA keyring download failed — skipping CUDA toolkit"
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
        || warn "torch.cuda.is_available() = $TORCH_CUDA (OK if the NVIDIA driver isn't visible yet — on WSL2 the driver lives on Windows)"
    deactivate
else
    step "Installing CPU-only PyTorch"
    source "$VENV_DIR/bin/activate"
    echo "  Downloading PyTorch (CPU)..."
    pip install torch torchvision torchaudio \
        --progress-bar on --no-cache-dir 2>&1 \
        | grep -E '(Collecting|Downloading|Installing|Successfully|ERROR)' || true
    ok "CPU-only PyTorch installed"
    deactivate
fi

# ─── 7. BACKEND .env ──────────────────────────────────────────────────────────
step "Writing server/.env"
mkdir -p "$SERVER_DIR"
if [[ -f "$SERVER_DIR/.env" ]]; then
    ok "server/.env already exists — leaving it untouched"
else
    cat > "$SERVER_DIR/.env" << 'ENVEOF'
# VitCam Backend configuration
# Fill in the Supabase values from your own Supabase project/stack:
#   (local CLI)  cd ~/vitcam && supabase status -o env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Signaling / WebRTC
SIGNALING_HOST=0.0.0.0
SIGNALING_PORT=8765

# Detection
DEFAULT_MODEL=rfdetr
DETECTION_CONFIDENCE=0.5
DEVICE=cuda

# RTSP / OpenCV FFmpeg transport.
# Many IP cameras stream H.264 over RTSP and lose frames over UDP, making
# cv2.VideoCapture return empty frames ("can't play"). Forcing TCP transport
# fixes the most common case — and on WSL2 specifically, TCP is needed where
# UDP silently fails. OpenCV's FFmpeg backend reads this exact env var.
# Format note: option;value, multiple options joined by '|'. Keep it minimal —
# a single unrecognised option (e.g. the renamed stimeout/timeout) can void the
# whole string. Add more only if your camera needs them.
OPENCV_FFMPEG_CAPTURE_OPTIONS=rtsp_transport;tcp
# Some stacks also read this directly:
RTSP_TRANSPORT=tcp

# Optional TLS for the signaling server
SSL_CERT_FILE=
SSL_KEY_FILE=
ENVEOF
    ok "Backend .env written: $SERVER_DIR/.env"
    warn "Edit $SERVER_DIR/.env and set the SUPABASE_* values before starting the service"
fi

# ─── 8. SYSTEMD SERVICE ───────────────────────────────────────────────────────
step "Creating systemd service (vitcam.service)"
PYTHON_EXEC="$VENV_DIR/bin/python"
MAIN_PY="$SERVER_DIR/main.py"
if [[ -f "$MAIN_PY" ]]; then
    ok "Server entry point: $MAIN_PY"
else
    warn "Entry point not found: $MAIN_PY"
    warn "Ensure main.py exists in $SERVER_DIR before starting the service"
fi

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
    ok "systemd service installed and enabled (start with: sudo systemctl start vitcam)"
else
    echo "$SERVICE_CONTENT" > "$HOME/vitcam.service"
    warn "systemd not active — service saved to ~/vitcam.service"
    if [[ "$IS_WSL" == "true" ]]; then
        warn "Enable systemd in /etc/wsl.conf ([boot] systemd=true), run 'wsl --shutdown', relaunch,"
        warn "then: sudo cp ~/vitcam.service /etc/systemd/system/ && sudo systemctl enable --now vitcam"
    else
        warn "Then: sudo cp ~/vitcam.service /etc/systemd/system/ && sudo systemctl enable --now vitcam"
    fi
fi

# ─── 9. WSL.CONF — SYSTEMD (WSL2 only) ────────────────────────────────────────
if [[ "$IS_WSL" == "true" ]]; then
    if grep -q "systemd=true" /etc/wsl.conf 2>/dev/null; then
        ok "systemd already enabled in /etc/wsl.conf"
    else
        printf '\n[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf > /dev/null
        ok "Added systemd=true to /etc/wsl.conf"
        warn "IMPORTANT: from PowerShell run 'wsl --shutdown', then relaunch Ubuntu so"
        warn "vitcam.service is managed by systemd."
    fi
fi

# ─── 10. VERIFICATION ─────────────────────────────────────────────────────────
step "Verifying server install"
VERIFIED=true
[[ -x "$VENV_DIR/bin/python" ]] && ok "venv python present" || { VERIFIED=false; warn "venv python MISSING: $VENV_DIR/bin/python"; }
if [[ -x "$VENV_DIR/bin/python" ]]; then
    "$VENV_DIR/bin/python" -c "import torch" 2>/dev/null \
        && ok "torch importable ($("$VENV_DIR/bin/python" -c 'import torch; print(torch.__version__)' 2>/dev/null))" \
        || { VERIFIED=false; warn "torch NOT importable in venv"; }
    "$VENV_DIR/bin/python" -c "import rfdetr" 2>/dev/null \
        && ok "rfdetr importable" \
        || warn "rfdetr not importable (OK if the repo vendors its own model code)"
fi
[[ -f "$SERVER_DIR/.env" ]] && ok "server/.env present" || { VERIFIED=false; warn "server/.env MISSING"; }

# RTSP capability: confirm the ffmpeg CLI is present and that OpenCV (whichever
# build the requirements pulled in) reports FFmpeg support. No FFmpeg → no RTSP.
command -v ffmpeg &>/dev/null \
    && ok "ffmpeg CLI present ($(ffmpeg -version 2>/dev/null | head -1 | awk '{print $1,$2,$3}'))" \
    || { VERIFIED=false; warn "ffmpeg CLI MISSING — RTSP capture will fail"; }
if [[ -x "$VENV_DIR/bin/python" ]]; then
    _CVFF=$("$VENV_DIR/bin/python" - <<'PYEOF' 2>/dev/null || echo "no-cv2"
try:
    import cv2, re
    info = cv2.getBuildInformation()
    m = re.search(r"FFMPEG:\s*(\w+)", info)
    print(m.group(1) if m else "unknown")
except Exception:
    print("no-cv2")
PYEOF
)
    case "$_CVFF" in
        YES) ok "OpenCV reports FFMPEG: YES — RTSP supported" ;;
        no-cv2) warn "cv2 not importable yet (installed via requirements at runtime?) — verify RTSP after first run" ;;
        *) warn "OpenCV FFMPEG support = $_CVFF — RTSP may not work; consider reinstalling opencv-python in the venv" ;;
    esac
fi

# ─── 11. SUMMARY ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
if [[ "$VERIFIED" == "true" ]]; then
echo "║              VitCam SERVER install complete!                         ║"
else
echo "║   VitCam SERVER install FINISHED WITH WARNINGS — see above           ║"
fi
echo "╠══════════════════════════════════════════════════════════════════════╣"
printf "║  Repo:   %-61s║\n" "$VITCAM_DIR"
printf "║  Venv:   %-61s║\n" "$VENV_DIR"
echo "║  Log:    ~/vitcam-install.log                                        ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  NEXT STEPS                                                          ║"
echo "║                                                                      ║"
echo "║  1. Edit Supabase values (server is not wired to a DB without them): ║"
echo "║       nano ~/vitcam/server/.env                                     ║"
echo "║  2. Start the service:                                               ║"
echo "║       sudo systemctl start vitcam                                    ║"
echo "║       sudo journalctl -u vitcam -f      # follow logs                ║"
echo "║  3. Or run it directly for debugging:                                ║"
echo "║       cd ~/vitcam/server                                            ║"
echo "║       ./$VENV_NAME/bin/python main.py                                ║"
echo "║  4. Verify GPU (optional):                                          ║"
echo "║       ~/vitcam/server/$VENV_NAME/bin/python -c \\                     ║"
echo "║         'import torch; print(torch.cuda.is_available())'            ║"
echo "║  5. Test an RTSP stream independently of the app:                   ║"
echo "║       ffmpeg -rtsp_transport tcp -i 'rtsp://user:pass@CAM_IP:554/..' \\ ║"
echo "║         -t 3 -f null -                # should show frame= lines      ║"
echo "║     If ffmpeg plays it but the app doesn't, the TCP transport env    ║"
echo "║     var in server/.env (OPENCV_FFMPEG_CAPTURE_OPTIONS) is the fix.   ║"
echo "║                                                                      ║"
echo "║  Note: Supabase and the frontend are NOT installed by this script.  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

exit 0