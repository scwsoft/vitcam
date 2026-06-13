# <img src="./docs/images/Logo.png" width="60" height="60" /><img src="./docs/images/ViTCam.png" width="150" height="60" /> 
> **Self-hosted, on-premises AI camera surveillance and NVR platform**
 
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen)](https://github.com/scwsoft/vitcam)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
 
**VitCam is a fully local, on-premises AI-powered camera surveillance and NVR (Network Video Recorder) platform.** Built for homes, businesses, and organizations that require complete control over their security footage — VitCam runs entirely on your own hardware, stores all recordings locally, and never sends video data to any external server or cloud service.
 
Unlike proprietary AI camera systems that lock you into specific hardware brands, subscription plans, or closed ecosystems, VitCam works with **any IP camera, NVR, or DVR that supports standard streaming protocols** — no matter the manufacturer. Swap cameras, change hardware, or scale your setup at any time without penalty.
 
Connect your existing IP cameras and NVR systems, and VitCam layers AI-powered object detection, real-time video streaming, and motion-triggered recording on top — turning any camera setup into an intelligent surveillance system. **Your footage stays on your network. Always.**
 
> **No lock-in. Ever.** No proprietary hardware required. No mandatory cloud subscription. No vendor software you must keep paying for. Just open-source software running on commodity hardware you already own.
 
---
 
## Table of Contents
 
- [Features](#features)
- [NVR & IP Camera Compatibility](#nvr--ip-camera-compatibility)
- [Architecture Overview](#architecture-overview)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Quick Start (Ubuntu)](#quick-start-ubuntu)
  - [Windows Setup (WSL2)](#windows-setup-wsl2)
- [Configuration](#configuration)
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
- **AI object detection** — RF-DETR-based detection with support for people, vehicles, drones, helmets, and more
- **Object tracking** — DeepSORT-based multi-object tracking with persistent IDs across frames
- **Motion-triggered recording** — Automatically records video clips when motion or detections are detected
- **Continuous recording mode** — Always-on recording with configurable retention
- **Detection event storage** — All events stored in Supabase with timestamps, bounding boxes, and confidence scores
- **Analytics dashboard** — Visualize detection trends, heatmaps, and activity over time
- **Multi-camera management** — Add, configure, and monitor multiple camera streams from one interface
- **Video management** — Browse and review recorded footage with Supabase Storage backend
- **System logs viewer** — Real-time and historical system log access from the UI
- **Datetime overlay** — Configurable timestamp overlays on video streams
- **Supabase real-time** — Live UI updates via Supabase real-time subscriptions
- **User authentication** — Full auth flows via Supabase Auth (email, OAuth)
- **Profile management** — Per-user settings and preferences
- **Self-hostable** — Runs entirely on your own hardware; your data never leaves your network
### AI Capabilities
 
- Person detection and counting
- Vehicle detection and classification
- Drone / UAV detection
- Safety helmet detection
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
│                  Camera Server                         │
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
| OS | Ubuntu 22.04 / 24.04 LTS (recommended), Debian 12, Windows 10/11 via WSL2 |
| CPU | 4 cores, x86_64 |
| RAM | 8 GB |
| Storage | 50 GB (for OS, app, and recordings) |
| GPU | Optional — NVIDIA GPU strongly recommended for AI inference |
| Node.js | 18 or later |
| Python | 3.10 or later |

### Recommended (for AI workloads)

| Component | Recommendation |
|-----------|----------------|
| GPU | NVIDIA RTX 3060 or better (e.g., RTX 5060 Ti) |
| VRAM | 8 GB minimum |
| CUDA | 12.x |
| RAM | 16–32 GB |

---
 
## Installation
 
### Quick Start (Ubuntu)
 
The fastest way to get VitCam running on a fresh Ubuntu machine:
 
```bash
# Clone the repository
git clone https://github.com/scwsoft/vitcam.git
cd vitcam
 
# Run the installer script
chmod +x install.sh
./install.sh
```
 
The installer will:
 
1. Install system dependencies (Node.js, Python, ffmpeg, libGL, etc.)
2. Set up a local Supabase instance
3. Apply the database schema migrations
4. Install frontend and backend dependencies
5. Configure PM2 to manage the frontend and backend processes
6. Start all services
Once complete, open your browser at `http://localhost:3000`.
 
Default credentials are printed at the end of the install script. **Change them immediately.**
 
---

### Windows Setup (WSL2)

VitCam's backend requires a Linux environment for GPU access and system services. On Windows, this is done by running the server inside **WSL2** (Windows Subsystem for Linux) while the frontend and Supabase CLI run natively in Windows PowerShell or Command Prompt.

> **Prerequisites:** [Git for Windows](https://git-scm.com/download/win), [Node.js 18+](https://nodejs.org/), and an NVIDIA GPU with the latest [NVIDIA drivers](https://www.nvidia.com/Download/index.aspx). For the backend, choose either [Anaconda / Miniconda](https://docs.conda.io/en/latest/miniconda.html) (native Windows, recommended) or [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) with Ubuntu 22.04 or 24.04.

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

> Supabase requires Docker Desktop. Make sure it's running before this step.

Once started, Supabase will print your local API URL and keys — copy these into your `.env` file (see [Configuration](#configuration)).

#### Step 3 — Apply the Database Schema (Windows)

1. Open **Supabase Studio** at `http://localhost:54323`
2. Navigate to the **SQL Editor**
3. Open `dbschema.sql` from the root of your cloned `vitcam` directory
4. Paste its contents into the editor and click **Run**

#### Step 4 — Create the First User (Windows)

1. In Supabase Studio, go to **Authentication → Users**
2. Click **Add User**, enter your email and password
3. Set **Auto Confirm** to on so the account is immediately active

#### Step 5 — Install and Start the Backend

Choose **one** of the two options below depending on your preference. The conda environment option runs natively on Windows and is recommended for users who want direct GPU access without WSL2.

---

**Option A — Conda Environment (native Windows, recommended)**

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

---

**Option B — WSL2 (Linux service, systemd-managed)**

Open a **WSL2 terminal** (Ubuntu from the Start Menu, or run `wsl` in PowerShell). Your Windows drives are mounted at `/mnt/c/`, `/mnt/d/`, etc.:

```bash
cd /mnt/c/Users/<YourUser>/path/to/vitcam
```

Run the installer with sudo:

```bash
sudo ./install-vitcam-server.sh
```

Once installed, start and monitor the backend service:

```bash
sudo systemctl start vitcam
journalctl -u vitcam -f
```

> Leave this terminal open to watch live logs. Press `Ctrl+C` to stop following — the service itself keeps running.

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

- RTSP stream URL
- Display name and location label
- Detection model selection
- Recording mode override
- Datetime overlay position and format

---
 
## Usage
 
### Accessing the Dashboard
 
Navigate to `http://localhost:3000` (or your server's IP/domain) and sign in.
 
### Adding a Camera
 
1. Go to **Cameras** → **Add Camera**
2. Enter the RTSP URL (e.g., `rtsp://admin:password@192.168.1.100:554/stream1`)
3. Choose a detection model
4. Click **Save** — the stream will appear on the main dashboard within seconds
### Viewing Live Streams
 
The **Dashboard** page shows all active camera feeds in a grid layout. Click any feed to expand it to full view. Detection bounding boxes and labels are overlaid in real time.
 
### Reviewing Recordings
 
Go to **Video Management** to browse recorded clips organized by camera and date. Clips can be previewed, downloaded, or deleted from this view.
 
### Detection Events
 
The **Events** page shows a chronological log of all detection events with:
 
- Timestamp and camera source
- Detected object class and confidence score
- Snapshot thumbnail
- Bounding box coordinates
### Analytics
 
The **Analytics** dashboard shows:
 
- Detection counts over time (hourly, daily, weekly views)
- Object class breakdown (pie/bar charts)
- Per-camera activity heatmaps
- Recording storage usage
---
 
## AI Models
 
VitCam uses RF-DETR for object detection, with model weights stored as PyTorch `.pth` checkpoints in the `models/` directory.
 
> **Pre-trained models are available in VitCam Pro.** The community edition is BYOM (Bring Your Own Model) — you supply your own trained `.pth` weights. See the [Fine-Tuning](#fine-tuning-your-own-models) section below to train your own, or purchase a Pro license to access Anthropic's pre-trained surveillance models.
 
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
| AI object detection (BYOM — bring your own model) | ✅ | ✅ |
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