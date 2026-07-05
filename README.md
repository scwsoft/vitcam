# <img src="./docs/images/Logo.png" width="60" height="60" /><img src="./docs/images/ViTCam.png" width="150" height="60" />
> **Self-hosted, on-premises AI camera surveillance, video analytics, and NVR platform**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen)](https://github.com/scwsoft/vitcam)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**VitCam is a fully local, on-premises AI-powered camera surveillance, video analytics, and NVR (Network Video Recorder) platform.** Built for homes, businesses, and organizations that require complete control over their security footage — VitCam runs entirely on your own hardware, stores all recordings locally, and never sends video data to any external server or cloud service.

Unlike proprietary AI camera systems that lock you into specific hardware brands, subscription plans, or closed ecosystems, VitCam works with **any IP camera, NVR, or DVR that supports standard streaming protocols** — no matter the manufacturer. Swap cameras, change hardware, or scale your setup at any time without penalty.

Connect your existing IP cameras and NVR systems, and VitCam layers AI-powered object detection, real-time video analytics, and motion-triggered recording on top — turning any camera setup into an intelligent surveillance system with deep insight into what's happening across your premises. **Your footage stays on your network. Always.**

VitCam's AI detection runs on **both GPU and CPU** — so you can get started on any machine and upgrade to a GPU later for higher frame rates and lower latency. A dedicated NVIDIA GPU is recommended for production workloads, but not required to run VitCam.

> **No lock-in. Ever.** No proprietary hardware required. No mandatory cloud subscription. No vendor software you must keep paying for. Just open-source software running on commodity hardware you already own.

---

## Table of Contents

- [Features](#features)
- [NVR & IP Camera Compatibility](#nvr--ip-camera-compatibility)
- [Architecture Overview](#architecture-overview)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Quick Start (Ubuntu)](#quick-start-ubuntu)
  - [Windows Setup (Conda)](#windows-setup-conda)
  - [macOS Setup](#macos-setup)
  - [Raspberry Pi (Debian Bookworm)](#raspberry-pi-debian-bookworm)
- [Configuration](#configuration)
- [Screenshots](#screenshots)
- [Usage](#usage)
- [AI Models](#ai-models)
- [Open-Core Edition](#open-core-edition)
- [Contributing](#contributing)
- [License](#license)

---

## NVR & IP Camera Compatibility

VitCam supports multiple stream input protocols, so it works with a wide range of cameras, NVR systems, and even internet-based video sources — all processed and stored locally on your own machine.

| Protocol | Source Examples | Notes |
|----------|----------------|-------|
| **RTSP** | IP cameras, NVR/DVR systems (Hikvision, Dahua, Reolink, Amcrest, etc.) | Primary protocol; recommended for on-premises cameras |
| **HTTP / MJPEG** | Older IP cameras, embedded cameras, some IoT devices | Streams served as a continuous JPEG sequence over HTTP |
| **YouTube Live** | Public live streams, traffic cams, public surveillance feeds | Useful for testing or monitoring public sources |
| **USB / Local Camera** | Built-in laptop cameras, USB webcams attached to the VitCam host | Referenced by device index using `local:<index>` (e.g. `local:0`) |
| **ONVIF** | Standard-compliant IP cameras | 🔜 Auto-discovery coming soon |

> ⚠️ **Privacy & legal notice:** When connecting to any public or third-party stream (e.g. YouTube Live or public webcams), ensure you have the right to access and process that feed. VitCam does not condone unauthorized surveillance.

### Stream URL Examples

**RTSP — NVR / IP Cameras (recommended for on-premises):**

```
# Hikvision NVR — Channel 1
rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101

# Dahua NVR — Channel 2
rtsp://admin:password@192.168.1.101:554/cam/realmonitor?channel=2&subtype=0

# Reolink camera
rtsp://admin:password@192.168.1.102:554/h264Preview_01_main

# Generic
rtsp://username:password@<camera-ip>:<port>/<stream-path>
```

**HTTP / MJPEG:**

```
http://<camera-ip>/video.mjpg
http://<camera-ip>/mjpeg/1
http://username:password@<camera-ip>:<port>/videostream.cgi
```

**YouTube Live:**

```
https://www.youtube.com/watch?v=<live-stream-id>
```

**USB / Local Camera:**

```
# Built-in camera or first USB webcam
local:0

# Second USB camera (if multiple are connected)
local:1
```

> On Windows (WSL2), local cameras are accessed via the host. If `local:0` isn't detected, ensure the camera is not in use by another application.

VitCam pulls each stream and processes it locally. For on-premises cameras, no internet access or port forwarding is required.

---

## Features

### Core (Free & Open Source)

- **Live WebRTC streaming** — Low-latency real-time video feeds from multiple cameras in your browser
- **AI object detection (toggleable)** — Enable or disable AI detection per camera with a single toggle. When off, VitCam operates as a standard CCTV monitor and NVR — streaming and recording without any AI processing overhead
- **GPU & CPU inference** — Runs on NVIDIA CUDA GPUs for maximum performance; falls back to CPU automatically so detection works on any machine, including laptops and macOS
- **Object tracking** — DeepSORT-based multi-object tracking with persistent IDs across frames
- **Motion-triggered recording** — Automatically records video clips when motion or detections are detected
- **Continuous recording mode** — Always-on recording with configurable retention
- **Detection event storage** — All events stored in Supabase with timestamps, bounding boxes, and confidence scores
- **Video analytics dashboard** — Visualize detection trends, object counts, dwell times, heatmaps, and per-camera activity over time — hourly, daily, and weekly views
- **People & vehicle counting** — Real-time and historical counts of people and vehicles passing through a scene
- **Dwell time tracking** — Measure how long tracked objects remain in a zone
- **Multi-camera management** — Add, configure, and monitor multiple camera streams from one interface
- **Video management** — Browse and review recorded footage with Supabase Storage backend
- **System logs viewer** — Real-time and historical system log access from the UI
- **Datetime overlay** — Configurable timestamp overlays on video streams
- **Supabase real-time** — Live UI updates via Supabase real-time subscriptions
- **User authentication** — Full auth flows via Supabase Auth (email, OAuth)
- **Profile management** — Per-user settings and preferences
- **Self-hostable** — Runs entirely on your own hardware; your data never leaves your network

### AI Capabilities

- Person detection, counting, and dwell time analysis
- Vehicle detection and classification (car, truck, motorcycle, bus)
- Drone / UAV detection
- Safety helmet / PPE compliance detection
- Zone-based activity monitoring
- Per-camera detection event logging with snapshot capture
- Custom model support (PyTorch `.pth`)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│              Next.js Frontend (WebRTC + UI)             │
└──────────────────────┬──────────────────────────────────┘
                       │ WebRTC / REST / Realtime
┌──────────────────────▼──────────────────────────────────┐
│                  Camera Server                          │
│   aiortc WebRTC Server  │  FastAPI REST API             │
│   RF-DETR Detection     │  DeepSORT Tracking            │
│   Recording Engine      │                               │
└──────────────────────┬──────────────────────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
        Supabase             Supabase
       (Postgres)             Storage
      Auth, Events           Video Clips
```

VitCam is composed of two main services:

**Frontend** — A Next.js application handling the web UI, WebRTC video rendering, real-time subscriptions, and user interactions.

**Backend** — The Camera Server (FastAPI + aiortc) handling camera capture, AI inference with RF-DETR, object tracking with DeepSORT, and video recording.

**Supabase** — Used as the primary database (Postgres), file storage (video clips, snapshots), and authentication provider. Can be self-hosted via the Supabase CLI or used with Supabase Cloud.

---

## Requirements

### Minimum

| Component | Requirement |
|-----------|-------------|
| OS | Ubuntu 22.04 / 24.04 LTS (recommended), Debian 12, Windows 10/11 (Conda), macOS 13+, Raspberry Pi OS 64-bit (Bookworm) |
| CPU | 4 cores, x86_64 |
| RAM | 8 GB |
| Storage | 50 GB (for OS, app, and recordings) |
| GPU | Optional — CPU inference is supported out of the box; an NVIDIA GPU is recommended for real-time multi-camera workloads |
| Node.js | 18 or later |
| Python | 3.10 or later |

> **No GPU? No problem.** VitCam automatically falls back to CPU-based inference if no CUDA-capable GPU is detected. CPU mode is suitable for testing, low-camera-count setups, and macOS. For real-time detection across multiple streams, an NVIDIA RTX GPU with CUDA is recommended.

### Recommended (for real-time multi-camera AI workloads)

| Component | Recommendation |
|-----------|----------------|
| GPU | NVIDIA RTX 3060 or better (e.g., RTX 5060 Ti) |
| VRAM | 8 GB minimum |
| CUDA | 12.x |
| RAM | 16–32 GB |

> For single-camera setups or development, a modern CPU (e.g. Apple M-series, Intel Core i7+) is sufficient with no GPU required.

---

## Installation

### Quick Start (Ubuntu)

The installer runs as **root** and handles everything automatically — Docker, Supabase, Python, nginx, and systemd services. No user switching required.

> **Running inside a Docker container?** The installer detects this automatically and connects to the host Docker socket instead of starting its own daemon. Make sure the host socket is accessible:
> ```bash
> # Run on the HOST machine before starting the installer
> chmod 666 /var/run/docker.sock
> ```
> If running on a VPS or cloud panel that gives you a container terminal, it is recommended to install VitCam directly on the host via SSH instead.

#### Fresh Ubuntu Server (logged in as root)

```bash
apt update && apt install -y git
git clone https://github.com/scwsoft/vitcam.git
bash vitcam/setup/install-linux.sh
```

#### Standard Ubuntu (user with sudo)

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/scwsoft/vitcam.git
sudo bash vitcam/setup/install-linux.sh
```

The installer will automatically:

1. Install system dependencies (ffmpeg, build tools, nginx)
2. Detect and install NVIDIA CUDA drivers if a GPU is present — falls back to CPU mode if not
3. Install and start Docker Engine (or connect to host Docker socket if inside a container)
4. Install Node.js 22
5. Clone and start Supabase via Docker Compose, apply the database schema
6. Pause and prompt you to update your `.env` files with Supabase keys
7. Install Python 3.10 via pyenv and all backend dependencies
8. Build the Next.js frontend and deploy via nginx (port 80) + systemd services (auto-start on reboot)

Once complete, open **Supabase Studio at `http://localhost:8000`** — log in with username `supabase` and password `this_password_is_insecure_and_should_be_updated`. Go to **Authentication → Users** to create your VitCam login account, then open `http://localhost:3000`.

**Service management after install:**

```bash
systemctl status vitcam-frontend
systemctl status vitcam-server
journalctl -u vitcam-server -f      # live server logs
journalctl -u vitcam-frontend -f    # live frontend logs
systemctl restart vitcam-server
```

---

### Windows Setup (Conda)

VitCam supports two backend setup paths on Windows. For the fastest setup, use the provided PowerShell installer which handles Supabase, Conda environment, PyTorch, frontend build, and startup scripts automatically.

> **Prerequisites:** [Git for Windows](https://git-scm.com/download/win), [Node.js 18+](https://nodejs.org/), [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) (running), [Anaconda / Miniconda](https://docs.conda.io/en/latest/miniconda.html), and an NVIDIA GPU with the latest [NVIDIA drivers](https://www.nvidia.com/Download/index.aspx).

#### Option A — Automated Installer (recommended)

Open **Anaconda Prompt** (so `conda` is active on PATH) and run:

```powershell
git clone https://github.com/scwsoft/vitcam.git
cd vitcam\setup
```

Then run the installer from within the conda base environment:

```powershell
(base) .\install-windows.bat
```

> The installer must be run from **Anaconda Prompt** — `conda` must be available on PATH for the environment setup to work. The `.bat` file handles PowerShell execution policy automatically.

After install, go to **Supabase Studio at `http://localhost:54323` → Authentication → Users** to create your first login account, then update your `.env` files with your Supabase URL and anon key (found under **Project Settings → API**), and open `http://localhost:3000`.

#### Option B — Manual Setup

#### Step 1 — Clone the Repository (Windows)

Open **PowerShell** or **Command Prompt** and run:

```powershell
git clone https://github.com/scwsoft/vitcam.git
cd vitcam
```

#### Step 2 — Set Up Supabase (Windows)

Install the Supabase CLI globally and start the local Supabase stack:

```powershell
npm install -g supabase
supabase start
```

> Supabase requires Docker Desktop. Make sure it is running before this step.

Once started, Supabase will print your local API URL and anon key in the terminal output.

#### Step 3 — Apply the Database Schema (Windows)

1. Open **Supabase Studio** at `http://localhost:54323`
2. Navigate to the **SQL Editor**
3. Open `dbschema.sql` from the `server/` folder of your cloned `vitcam` directory
4. Paste its contents into the editor and click **Run**

#### Step 4 — Create the First User (Windows)

1. In Supabase Studio, go to **Authentication → Users**
2. Click **Add User**, enter your email and password
3. Set **Auto Confirm** to on so the account is immediately active

#### Step 4b — Get Your Supabase URL and Anon Key (Windows)

1. Open Supabase Studio at `http://localhost:54323`
2. Go to **Project Settings → API**
3. Copy the **URL** and **anon public** key

Then manually update these two files:

- **Frontend:** edit `vitcam/frontend/.env` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Server:** edit `vitcam/server/.env` and set `SUPABASE_URL` and `SUPABASE_KEY`

#### Step 5 — Install and Start the Backend

**Conda Environment (native Windows)**

> **Prerequisites:** [Anaconda](https://www.anaconda.com/download) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html) installed on Windows.

Open **Anaconda Prompt** (or any terminal with `conda` on the PATH) and navigate to the server folder:

```powershell
cd <vitcam-dir>\server
```

Create and activate the environment, then install dependencies:

```powershell
conda create -n vit-server python=3.10.11 -y
conda activate vit-server
pip install -r requirements.txt
```

Install PyTorch with CUDA 12.8 support (Blackwell / sm_120 compatible):

```powershell
pip install -U torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

Verify CUDA is detected before starting the server:

```powershell
python -c "import torch; print('CUDA Available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"
```

You should see `CUDA Available: True` and your GPU name. Then start the server:

```powershell
python main.py
```

> Each time you return to work on the server, re-activate the environment first: `conda activate vit-server`.

> **Supabase connection error?** If the server fails to start with an invalid URL or connection error, your `SUPABASE_URL` and `SUPABASE_KEY` in `server/.env` have not been set yet. Update them with the values from Supabase Studio (**Project Settings → API**), then set them as environment variables for the current session and re-run:
>
> ```powershell
> $env:SUPABASE_URL = "http://localhost:54321"
> $env:SUPABASE_KEY = "your-anon-key"
> python main.py
> ```

#### Step 6 — Build and Start the Frontend (Windows)

Back in your **Windows** terminal:

```powershell
cd frontend
npm install
npm run build
npm start
```

The frontend will be available at `http://localhost:3000`. Sign in with the user you created in Step 4.

---

### macOS Setup

VitCam runs on macOS for both development and production use on lower-camera-count setups. CUDA is not available on Apple Silicon, but VitCam's AI detection automatically runs on CPU — enabling real-time object detection without a discrete GPU.

> **Prerequisites:** [Homebrew](https://brew.sh/), [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) (running).

#### Option A — Automated Installer (recommended)

```bash
git clone https://github.com/scwsoft/vitcam.git
cd vitcam/setup
chmod +x install-macos.sh
./install-macos.sh
```

The installer handles everything: Supabase via Docker Compose with S3/MinIO storage backend (fixes the macOS xattr issue), pyenv, Python, backend deps, frontend build, nginx, and launchd service management. After install, create your first user in **Supabase Studio at `http://localhost:8000` → Authentication → Users**, then update your `.env` files with your Supabase URL and anon key, and open `http://localhost:3000`.

#### Option B — Manual Setup

#### Step 1 — Clone the Repository

```bash
git clone https://github.com/scwsoft/vitcam.git
cd vitcam/setup
```

#### Step 2 — Set Up Supabase (macOS)

Install Docker Desktop first, then clone and start the Supabase self-hosted Docker stack.

> ⚠️ **macOS xattr issue:** Docker Desktop on macOS does not support extended attributes on bind-mounted volumes, which prevents Supabase Storage from saving files. The fix is to use `docker-compose.s3.yml` which spins up a local MinIO container as the storage backend — running entirely inside Docker's Linux layer where xattr is fully supported.

```bash
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker
cp .env.example .env
```

Pull the latest images and start with the S3/MinIO storage override:

```bash
docker compose -f docker-compose.yml -f docker-compose.s3.yml pull
docker compose -f docker-compose.yml -f docker-compose.s3.yml up --detach
```

> Supabase Studio will be available at `http://localhost:8000` once all containers are healthy. This may take a few minutes on first run.

#### Step 3 — Apply the Database Schema

1. Open **Supabase Studio** at `http://localhost:8000`
2. Log in with default credentials: **Username:** `supabase` / **Password:** `this_password_is_insecure_and_should_be_updated`
3. Navigate to **SQL Editor**
4. Open `dbschema.sql` from the `server/` folder of your `vitcam` directory
5. Paste the contents and click **Run**

#### Step 4 — Create the First User

1. In Supabase Studio, go to **Authentication → Users**
2. Click **Add User**, enter your email and password
3. Enable **Auto Confirm** so the account is immediately active

#### Step 4b — Get Your Supabase URL and Anon Key (macOS)

1. In Supabase Studio go to **Project Settings → API**
2. Copy the **URL** and **anon public** key

Then manually update these two files:

- **Frontend:** edit `vitcam/frontend/.env` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Server:** edit `vitcam/server/.env` and set `SUPABASE_URL` and `SUPABASE_KEY`

#### Step 5 — Set Up the Python Environment (Backend)

Install `pyenv` to manage the Python version:

```bash
brew update
brew install pyenv
```

Add `pyenv` to your shell (zsh is the default on macOS):

```bash
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init --path)"' >> ~/.zshrc
echo 'eval "$(pyenv virtualenv-init -)"' >> ~/.zshrc
source ~/.zshrc
```

Install and set Python 3.10:

```bash
pyenv install 3.10.19
pyenv global 3.10.19
python --version   # Should print Python 3.10.19
```

#### Step 6 — Install Backend Dependencies

```bash
cd vitcam/server
pip install -r requirements.txt
```

> On Apple Silicon (M1/M2/M3/M4), if `opencv-python` fails run `pip install opencv-python-headless` instead.

#### Step 7 — Build and Start the Frontend

```bash
cd vitcam/frontend
npm install
npm run build
npm start
```

The frontend will be available at `http://localhost:3000`.

#### Step 8 — Start the Backend

Open a new terminal tab:

```bash
cd vitcam/server
python main.py
```

The backend will be available at `http://localhost:8765`. Sign in at `http://localhost:3000` with the user you created in Step 4.

> **To manage Supabase after install:**
> ```bash
> cd vitcam/supabase/docker
> docker compose -f docker-compose.yml -f docker-compose.s3.yml ps
> docker compose -f docker-compose.yml -f docker-compose.s3.yml restart
> ```

### Raspberry Pi (Debian Bookworm)

VitCam runs on Raspberry Pi 4/5 with Debian Bookworm (64-bit). There is no CUDA GPU on Raspberry Pi, so the backend runs in CPU inference mode — suitable for single-camera setups or lightweight monitoring.

> **Tested on:** Raspberry Pi 4B / 5 running Raspberry Pi OS (64-bit, Debian Bookworm). A 64-bit OS is required.

#### Option A — Automated Installer (recommended)

```bash
git clone https://github.com/scwsoft/vitcam.git
cd vitcam/setup
chmod +x install-raspberry-pi.sh
./install-raspberry-pi.sh
```

The installer handles Docker Engine, Node.js, Supabase (via Docker Compose), pyenv, Python 3.10, all dependencies, frontend build, nginx, and systemd service management. After install, create your first user in **Supabase Studio at `http://localhost:8000` → Authentication → Users**, then open `http://localhost:3000`.

> On first run, compiling Python via pyenv on Raspberry Pi can take 10–20 minutes. This is normal.

#### Option B — Manual Setup

#### Step 1 — Install Docker

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

> After adding your user to the `docker` group, **log out and back in** (or reboot) before running any `docker` commands.

#### Step 2 — Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Step 3 — Clone the Repository

```bash
git clone https://github.com/scwsoft/vitcam.git
cd vitcam
```

#### Step 4 — Set Up Supabase

Clone the Supabase self-hosted Docker stack and start it:

```bash
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker
cp .env.example .env
docker compose up --detach
```

> Supabase Studio will be available at `http://localhost:8000` once all containers are healthy. This may take a couple of minutes on first run.

#### Step 5 — Apply the Database Schema

1. Open **Supabase Studio** at `http://localhost:8000`
2. Navigate to the **SQL Editor**
3. Open `dbschema.sql` from the root of your `vitcam` directory
4. Paste its contents into the editor and click **Run**

#### Step 6 — Create the First User

1. In Supabase Studio, go to **Authentication → Users**
2. Click **Add User**, enter your email and password
3. Set **Auto Confirm** to on so the account is immediately active

#### Step 6b — Get Your Supabase URL and Anon Key (Raspberry Pi)

You need these two values for both the frontend and server `.env` files.

On Raspberry Pi, Supabase runs via Docker so the keys are set in the `supabase/docker/.env` file you copied earlier. Open it to find them:

```bash
grep "ANON_KEY\|API_EXTERNAL_URL" ~/vitcam/supabase/docker/.env
```

This will print something like:

```
API_EXTERNAL_URL=http://localhost:8000
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Alternatively, retrieve them from Supabase Studio:

1. Open Supabase Studio at `http://localhost:8000`
2. Go to **Project Settings → API**
3. Copy the **URL** and **anon public** key

Then add them to your config files:

- **Frontend:** create or edit `vitcam/frontend/.env` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- **Server:** create or edit `vitcam/server/.env` and set:

```env
SUPABASE_URL=http://localhost:8000
SUPABASE_KEY=your-anon-key
```

#### Step 7 — Build and Start the Frontend

Open a new terminal and run:

```bash
cd ~/vitcam/frontend
npm install
npm run build
npm start
```

The frontend will be available at `http://localhost:3000`. Leave this terminal open, or set it up as a systemd service for auto-start on reboot.

#### Step 8 — Set Up Python with pyenv

Install build dependencies:

```bash
sudo apt update && sudo apt install -y build-essential libssl-dev zlib1g-dev \
  libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev \
  libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev git
```

Install pyenv:

```bash
curl https://pyenv.run | bash
```

Add pyenv to your shell by appending the following lines to the end of `~/.bashrc`:

```bash
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
```

Apply the changes:

```bash
exec "$SHELL"
```

#### Step 9 — Install Python and Start the Backend

```bash
pyenv install 3.10.11
pyenv global 3.10.11
cd ~/vitcam/server
pip install -r requirements.txt
python main.py
```

The backend will be available at `http://localhost:8765`. Leave this terminal open.

---

## Configuration

All configuration is managed via a `.env` file in the server directory. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

### Key Environment Variables

```env
# ─── Supabase ───────────────────────────────────────────
SUPABASE_URL=http://localhost:54321
SUPABASE_KEY=your-anon-key

# ─── Server ─────────────────────────────────────────────
SERVER_HOST=0.0.0.0
SERVER_PORT=8765

# ─── Recording ──────────────────────────────────────────
DEFAULT_CODEC=VP9
DEFAULT_CONTAINER=webm
DEFAULT_RESOLUTION=640x480
DEFAULT_FPS=30

# ─── Performance ────────────────────────────────────────
LOG_BUFFER_SIZE=50
LOG_FLUSH_INTERVAL=10.0
PERFORMANCE_LOG_INTERVAL=60.0

# ─── Motion Detection ───────────────────────────────────
DEFAULT_SENSITIVITY=20
DEFAULT_AREA_THRESHOLD=5000

# ─── WebRTC STUN/TURN ───────────────────────────────────
WEBRTC_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
WEBRTC_TURN_SERVER=turn:127.0.0.1:3478
WEBRTC_TURN_USERNAME=webrtc
WEBRTC_TURN_CREDENTIAL=webrtc123

# ─── AI Model ───────────────────────────────────────────
# Options: Nano, Small, Medium, Large, Custom
MODEL_SIZE=Nano
MODEL_CHECKPOINT_PATH=./checkpoints/UAV/checkpoint.pth
```

> **Supabase keys:** After running `supabase start`, the CLI prints your local `API URL` and `anon key`. Use those values for `SUPABASE_URL` and `SUPABASE_KEY`. For Supabase Cloud, find them under **Project Settings → API**.

> **Model checkpoint:** Place your `.pth` checkpoint file under `checkpoints/<model-name>/` and set `MODEL_CHECKPOINT_PATH` accordingly. Set `MODEL_SIZE` to `Custom` when using a non-standard checkpoint.

### Camera Configuration

Cameras are configured through the VitCam UI under **Settings → Cameras**. Each camera supports:

- RTSP stream URL or local device index (e.g. `local:0`)
- Display name and location label
- **AI detection toggle** — enable for smart detection, disable for standard CCTV/NVR mode
- Detection model selection (when AI detection is enabled)
- Recording mode override
- Datetime overlay position and format

### AI Detection vs. Standard NVR Mode

Each camera can operate in one of two modes:

| Mode | Description |
|------|-------------|
| **Standard NVR** (AI off) | Live streaming and continuous or motion-triggered recording with no AI processing. Lightweight — runs on any hardware. |
| **AI Detection** (AI on) | Adds real-time RF-DETR object detection, DeepSORT tracking, detection event logging, and snapshot capture on top of standard recording. Recommended with a GPU for multi-camera setups. |

You can mix modes across cameras — for example, run AI detection on entrance cameras while keeping indoor cameras in standard NVR mode to save resources.

---

## Screenshots

<img src="./docs/images/VitCam-Live.gif" />

<img src="./docs/images/VitCam-Live2.gif" />

---

## Usage

### Accessing the Dashboard

Navigate to `http://localhost:3000` (or your server's IP/domain) and sign in.

### Adding a Camera

1. Go to **Cameras** → **Add Camera**
2. Enter the stream URL (e.g. `rtsp://admin:password@192.168.1.100:554/stream1` or `local:0` for a built-in camera)
3. Toggle **AI Detection** on or off
   - **On** — choose a detection model; VitCam will run real-time object detection on this stream
   - **Off** — camera runs in standard NVR mode (streaming and recording only, no AI overhead)
4. Click **Save** — the stream will appear on the main dashboard within seconds

### Viewing Live Streams

The **Dashboard** page shows all active camera feeds in a grid layout. Click any feed to expand it to full view. For cameras with AI Detection enabled, bounding boxes and labels are overlaid in real time. Cameras in standard NVR mode display a clean feed with no overlays.

### Reviewing Recordings

Go to **Video Management** to browse recorded clips organized by camera and date. Clips can be previewed, downloaded, or deleted from this view.

### Detection Events

The **Events** page shows a chronological log of all detection events with:

- Timestamp and camera source
- Detected object class and confidence score
- Snapshot thumbnail
- Bounding box coordinates

### Video Analytics

The **Analytics** dashboard gives you deep insight into activity across all your cameras:

- Detection counts over time (hourly, daily, weekly views)
- People and vehicle counts per camera
- Dwell time analysis — see how long objects linger in a scene
- Object class breakdown (pie/bar charts)
- Per-camera activity heatmaps
- Detection event timeline with snapshot thumbnails
- Recording storage usage

---

## AI Models

VitCam uses RF-DETR for object detection, with model weights stored as PyTorch `.pth` checkpoints in the `models/` directory.

> **Pre-trained models are available in VitCam Pro.** The community edition is BYOM (Bring Your Own Model) — you supply your own trained `.pth` weights. See the [Fine-Tuning](#fine-tuning-your-own-models) section below to train your own, or purchase a Pro license to access pre-trained surveillance models.

### Bring Your Own Model (Community)

VitCam supports any RF-DETR model saved as a PyTorch `.pth` checkpoint. To use your own:

1. Place your `.pth` file in the `models/` directory
2. Register it in the UI under **Settings → Models → Add Model**
3. Assign it to a camera stream

### Pre-Trained Models (Pro)

Pro subscribers get access to ready-to-use pre-trained RF-DETR models via the VitCam model library:

| Model | Classes | Notes |
|-------|---------|-------|
| `rfdetr_person.pth` | Person | General person detection and counting |
| `rfdetr_vehicle.pth` | Car, truck, motorcycle, bus | Vehicle detection and classification |
| `rfdetr_drone.pth` | Drone / UAV | Aerial drone detection |
| `rfdetr_helmet.pth` | Safety helmet (on/off) | PPE compliance monitoring |

Available at [vitcam.io](https://vitcam.io) *(coming soon)*.

### Fine-Tuning Your Own Models

See [docs/training.md](docs/training.md) for a guide on fine-tuning RF-DETR on your own dataset using Open Images V7 or custom annotations.

---

## Open-Core Edition

VitCam follows an **open-core model**:

| Feature | Community (AGPL 3.0) | Pro |
|---------|---------------------|-----|
| Live WebRTC streaming | ✅ | ✅ |
| Motion & continuous recording | ✅ | ✅ |
| Analytics dashboard | ✅ | ✅ |
| Self-hosted deployment | ✅ | ✅ |
| Multi-camera (unlimited) | ✅ | ✅ |
| Pre-trained surveillance models | ❌ | ✅ |
| Specialty AI models (marketplace) | ❌ | ✅ |
| Advanced alerting & webhooks | ❌ | ✅ |
| Role-based access control (RBAC) | ❌ | ✅ |
| Priority support | ❌ | ✅ |

Pro features are available at [vitcam.io](https://vitcam.io) *(coming soon)*.

---

## Contributing

Contributions are welcome! VitCam is maintained by a solo developer, so please read the contributing guidelines before submitting.

### How to Contribute

1. **Report bugs** — Open an issue with steps to reproduce, your OS/GPU, and relevant logs
2. **Suggest features** — Open a discussion before submitting a large PR
3. **Submit fixes** — Small, focused PRs are much easier to review than large ones

### Development Setup

```bash
# Fork and clone
git clone https://github.com/scwsoft/vitcam.git
cd vitcam

# Backend (Python)
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

# Frontend (Next.js)
cd ../frontend
npm install
npm run dev
```

### Code Style

- **Python:** Black + isort (`make lint`)
- **TypeScript/React:** ESLint + Prettier (`npm run lint`)

### Note on Pull Requests

Due to the complexity of coordinating changes across the AI pipeline, streaming server, and frontend, pull requests are reviewed carefully and may take time. Please open an issue first for any significant feature work — this avoids duplicate effort and helps ensure the change aligns with the project roadmap.

---

## Roadmap

- [ ] AI Model Marketplace (specialty detection models)
- [ ] Mobile app (iOS / Android)
- [ ] Edge deployment support (Jetson Nano / Raspberry Pi)
- [ ] ONVIF camera auto-discovery
- [ ] Face blurring / privacy masking
- [ ] Webhook integrations (Slack, Discord, email alerts)
- [ ] Multi-tenant / RBAC support (Pro)
- [ ] Cloud-managed option (Pro)

---

## License

VitCam Community Edition is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:

- You are free to use, modify, and distribute this software
- If you run a modified version as a network service (e.g., a SaaS product), you **must** release your modifications under AGPL-3.0
- Attribution to the original project is required

See [LICENSE](LICENSE) for the full license text.

```
VitCam — AI-Powered Camera Surveillance Platform
Copyright (C) 2024  Sean (VitCam Contributors)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.
```

---

## Acknowledgements

VitCam is built on top of excellent open-source projects:

- [RF-DETR](https://github.com/roboflow/rf-detr) — Real-time object detection
- [DeepSORT](https://github.com/nwojke/deep_sort) — Multi-object tracking
- [aiortc](https://github.com/aiortc/aiortc) — WebRTC for Python
- [Supabase](https://supabase.com) — Open-source Firebase alternative
- [Next.js](https://nextjs.org) — React framework

---

*Made with ❤️ in the Philippines*