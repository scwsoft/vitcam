#FROM python:3.11-slim

# ENV SUPABASE_URL=http://127.0.0.1:54321
# ENV SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# ENV RUN_TIME=123


# # Set working directory
# WORKDIR /server/app

# Install system dependencies
# RUN apt-get update && apt-get install -y \
#     build-essential \
#     pkg-config \
#     cmake \
#     ffmpeg \
#     libavcodec-dev \
#     libavformat-dev \
#     libswscale-dev \
#     libgstreamer1.0-dev \
#     libgstreamer-plugins-base1.0-dev \
#     libgtk-3-dev \
#     libpng-dev \
#     libjpeg-dev \
#     libopenexr-dev \
#     libtiff-dev \
#     libdvdnav4 \
#     libwebp-dev \
#     libopencv-dev \
#     python3-opencv \
#     git \
#     curl \
#     && rm -rf /var/lib/apt/lists/*


FROM ubuntu:latest

ENV SUPABASE_URL=http://127.0.0.1:54321
ENV SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Install Python and system dependencies in one layer
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt-get update && \
    apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    libgtk-3-dev \
    libpng-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

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