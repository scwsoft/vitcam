FROM python:3.11-slim

ENV SUPABASE_URL=http://127.0.0.1:54321
ENV SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

ENV RUN_TIME=123


# Set working directory
WORKDIR /server/app

RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    cmake \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    libgtk-3-dev \
    libpng-dev \
    libjpeg-dev \
    libopenexr-dev \
    libtiff-dev \
    libdvdnav4 \
    libwebp-dev \
    libopencv-dev \
    python3-opencv \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*


# Set Python 3.11 as default

# Copy requirements first
COPY requirements.txt .

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Install full opencv-python (not headless) OR build with proper flags
RUN pip3 install opencv-contrib-python

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV OPENCV_FFMPEG_CAPTURE_OPTIONS="rtsp_transport;tcp"

# Expose ports
EXPOSE 8765
EXPOSE 554

ENV HOSTNAME="0.0.0.0"

# Run the application
CMD ["python3", "main.py"]