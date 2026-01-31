"use client";
import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, RotateCcw, Maximize, Minimize, VideoOff, CircleDot, Circle, PlayIcon } from 'lucide-react';
import {ICameraProps} from "@types/CameraType";

interface VideoPlayerProps extends ICameraProps {
  stunServers?: string[];
}

export default function VideoPlayer({ Name, Url, IsRealTimeDetection, ServerName, stunServers}: VideoPlayerProps){
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReset, setReset] = useState(false);
  const [isDetection, setDetection] = useState(IsRealTimeDetection);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const [connected, setConnected] = useState(false);
  const [isRemoteStream, setRemoteStream] = useState(false);
  const [stateConnection, setStateConnection] = useState("");
  const [serverName, setServerName] = useState(ServerName);

  // Auto-reconnect feature states
  const [autoReconnectEnabled, setAutoReconnectEnabled] = useState(true);
  const [hasHadSuccessfulConnection, setHasHadSuccessfulConnection] = useState(false);
  const [isCurrentlyDisconnected, setIsCurrentlyDisconnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendToServer = (data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(data));
        console.log(`[${Name}] Sent to server:`, data.type, data.action);
      } catch (error) {
        console.log(`[${Name}] Error sending to server:`, error);
      }
    }
  };

  const cleanupPeerConnection = () => {
    if (peerConnection.current) {
      console.log(`[${Name}] Cleaning up peer connection`);
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    if (videoTimeoutRef.current) {
      clearTimeout(videoTimeoutRef.current);
      videoTimeoutRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleConnectionFailure = () => {
    console.log(`[${Name}] Handling connection failure`);
    
    setConnected(false);
    setRemoteStream(false);
    setReset(false);
    setStateConnection("failed");
    
    cleanupPeerConnection();
    
    // Auto-reconnect with exponential backoff
    if (autoReconnectEnabled && hasHadSuccessfulConnection && reconnectAttempts < 5) {
      const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`[${Name}] Auto-reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/5)`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        startVideo();
      }, delay);
    } else {
      setIsCurrentlyDisconnected(true);
    }
  };

  const createAndSendOffer = async (rtsp_url: string) => {
    try {
      if (!peerConnection.current) {
        console.log(`[${Name}] No peer connection for offer`);
        return;
      }
      
      console.log(`[${Name}] Creating offer...`);
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      sendToServer({
        type: 'offer',
        sdp: peerConnection.current.localDescription,
        rtsp_url: rtsp_url,
        is_detect: isDetection,
        screen_type: "full_screen",
      });

      // Set 1-min timeout for video feed
      videoTimeoutRef.current = setTimeout(() => {
        if (!isRemoteStream && peerConnection.current) {
          console.warn(`[${Name}] Video timeout - no feed received after 15s`);
          handleConnectionFailure();
        }
      }, 60000);

    } catch (error) {
      console.log(`[${Name}] Error creating offer:`, error);
      handleConnectionFailure();
    }
  };

  const handleSignalingMessage = async (message: any) => {
    try {
      if (!peerConnection.current) return;
      
      if (message.type === 'answer' && message.sdp && peerConnection.current.connectionState !== "closed") {
        console.log(`[${Name}] Received answer, setting remote description`);
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(message.sdp)
        );
      } else if (message.type === 'ice_candidate' && message.candidate) {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(message.candidate)
        );
      }
    } catch (error) {
      console.log(`[${Name}] Error handling signaling message:`, error);
    }
  };

  const initConnection = async () => {
    try {
      cleanupPeerConnection();

      console.log(`[${Name}] Initializing WebRTC connection...`);
      
      
      // Use STUN servers from props
      const iceServers: RTCIceServer[] = stunServers && stunServers.length > 0
        ? stunServers.map(url => ({ urls: url }))
        : [];
      
      peerConnection.current = new RTCPeerConnection({ iceServers });
      
      peerConnection.current.addTransceiver('video', { direction: 'recvonly' });

      peerConnection.current.onconnectionstatechange = () => {
        if (!peerConnection.current) return;
        
        const state = peerConnection.current.connectionState;
        console.log(`[${Name}] Connection state:`, state);
        setStateConnection("connecting");
        
        if (state === 'connected') {
          console.log(`[${Name}] ✅ WebRTC connected successfully`);
          setConnected(true);
          setStateConnection("connected");
          setHasHadSuccessfulConnection(true);
          setIsCurrentlyDisconnected(false);
          setReconnectAttempts(0);
        }
        else if (['disconnected', 'failed', 'closed'].includes(state)) {
          setConnected(false);
          setRemoteStream(false);
          setReset(false);
          setStateConnection("closed");
          
          if (peerConnection.current) {
            peerConnection.current.close();
          }
          
          if (state === 'failed') {
            console.log(`[${Name}] ❌ Connection failed`);
            handleConnectionFailure();
          } else if (state === 'disconnected') {
            console.log(`[${Name}] ⚠️ Connection disconnected`);
            setTimeout(() => {
              if (peerConnection.current?.connectionState === 'disconnected') {
                handleConnectionFailure();
              }
            }, 5000);
          }
          
          if (hasHadSuccessfulConnection && state !== 'closed') {
            setIsCurrentlyDisconnected(true);
          }
        }
        else if (state === 'connecting') {
          setConnected(false);
          setStateConnection("connecting");
        }
      };

      peerConnection.current.addEventListener("iceconnectionstatechange", () => {
        if (!peerConnection.current) return;
        
        const iceState = peerConnection.current.iceConnectionState;
        console.log(`[${Name}] ICE state:`, iceState);
        
        if (iceState === 'failed') {
          console.log(`[${Name}] ICE connection failed`);
          setConnected(false);
          setRemoteStream(false);
          setReset(false);
          if (peerConnection.current) {
            peerConnection.current.close();
          }
          
          if (hasHadSuccessfulConnection) {
            setIsCurrentlyDisconnected(true);
          }
        }
        // ✅ FIXED: Don't kill stream on checking/connected
      });

      peerConnection.current.ontrack = (event) => {
        console.log(`[${Name}] 🎥 Track received:`, event.streams.length, 'streams');
        
        if (videoRef.current && event.streams[0]) {
          if (videoTimeoutRef.current) {
            clearTimeout(videoTimeoutRef.current);
            videoTimeoutRef.current = null;
          }

          console.log(`[${Name}] ✅ Setting video stream`);
          videoRef.current.srcObject = event.streams[0];
          setIsPlaying(true);
          setRemoteStream(true);
          setReset(false);
          setHasHadSuccessfulConnection(true);
          setIsCurrentlyDisconnected(false);
        }
      };

      createAndSendOffer(Url);

    } catch (error) {
      console.log(`[${Name}] Error initializing connection:`, error);
      handleConnectionFailure();
    }
  };

  // ✅ CRITICAL: Empty dependency array - only connect once!
  useEffect(() => {
    console.log(`[${Name}] Connecting to WebSocket:`, serverName);
    
    ws.current = new WebSocket(serverName);

    ws.current.onopen = () => {
      console.log(`[${Name}] ✅ WebSocket connected`);
      setConnected(true);
      setTimeout(() => {
        initConnection();
      }, 100);
    };

    ws.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      await handleSignalingMessage(message);
    };

    ws.current.onerror = (error) => {
      console.log(`[${Name}] WebSocket error:`, error);
    };

    ws.current.onclose = () => {
      console.log(`[${Name}] WebSocket closed`);
      setConnected(false);
      
      if (hasHadSuccessfulConnection) {
        setIsCurrentlyDisconnected(true);
      }
    };

    return () => {
      console.log(`[${Name}] Component unmounting`);
      
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      
      cleanupPeerConnection();
    };
  }, []); // ✅ Empty array!

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const stop = () => {
    try {
      console.log(`[${Name}] Stopping stream`);
      
      setReset(false);
      setRemoteStream(false);
      setIsCurrentlyDisconnected(true);
      setReconnectAttempts(0);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (peerConnection.current !== null) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      
      sendToServer({
        type: "control",
        rtsp_url: Url,
        is_detect: isDetection,
        action: 'stop'
      });

      stopVideo();

    } catch (error) {
      console.log(`[${Name}] Error stopping:`, error);
    }
  };

  const stopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setReset(false);
      setRemoteStream(false);
      setStateConnection("stopped");

    }
  };

  const startVideo = async () => {
    try {
      console.log(`[${Name}] Starting/restarting stream`);
      
      setIsCurrentlyDisconnected(false);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      
      sendToServer({
        type: "control",
        rtsp_url: Url,
        is_detect: isDetection,
        screen_type: "small_screen",
        action: 'restart'
      });
      
      stopVideo();
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
      setReset(true);
      setConnected(false);
      setRemoteStream(false);
      setStateConnection("restarting");
      
      setTimeout(() => {
        initConnection();
      }, 1000);

    } catch (error) {
      console.log(`[${Name}] Error restarting:`, error);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!videoContainerRef.current) return;
    
    const rect = videoContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const offsetX = mouseX - centerX;
    const offsetY = mouseY - centerY;
    
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoomLevel = Math.max(0.6, Math.min(3, zoomLevel + zoomDelta));
    
    if (newZoomLevel !== zoomLevel) {
      const zoomRatio = newZoomLevel / zoomLevel;
      const newPanX = panPosition.x * zoomRatio + offsetX * (1 - zoomRatio) * 0.5;
      const newPanY = panPosition.y * zoomRatio + offsetY * (1 - zoomRatio) * 0.5;
      
      const maxPanX = (newZoomLevel - 1) * rect.width / 2;
      const maxPanY = (newZoomLevel - 1) * rect.height / 2;
      
      const boundedPanX = Math.max(-maxPanX, Math.min(newPanX, maxPanX));
      const boundedPanY = Math.max(-maxPanY, Math.min(newPanY, maxPanY));
      
      setZoomLevel(newZoomLevel);
      setPanPosition({ x: boundedPanX, y: boundedPanY });
      
      if (newZoomLevel <= 1) {
        setPanPosition({ x: 0, y: 0 });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY
      });
      setLastPanPosition(panPosition);
      
      if (videoContainerRef.current) {
        videoContainerRef.current.style.cursor = 'grabbing';
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && zoomLevel > 1 && videoContainerRef.current) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      const rect = videoContainerRef.current.getBoundingClientRect();
      const maxPanX = (zoomLevel - 1) * rect.width / 2;
      const maxPanY = (zoomLevel - 1) * rect.height / 2;
      
      let newX = lastPanPosition.x + deltaX;
      let newY = lastPanPosition.y + deltaY;
      
      newX = Math.max(-maxPanX, Math.min(newX, maxPanX));
      newY = Math.max(-maxPanY, Math.min(newY, maxPanY));
      
      setPanPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (videoContainerRef.current) {
      videoContainerRef.current.style.cursor = zoomLevel > 1 ? 'grab' : 'default';
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    if (videoContainerRef.current) {
      videoContainerRef.current.style.cursor = zoomLevel > 1 ? 'grab' : 'default';
    }
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const toggleFullscreen = async () => {
    try {
      if (!containerRef.current) {
        console.log("Container ref not found");
        return;
      }

      if (!document.fullscreenElement) {
        const container = containerRef.current;
        
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }
        
        sendToServer({
          type: "control",
          action: "change_bitrate",
          rtsp_url: Url,
          is_detect: isDetection,
          screen_type: "full_screen",
        });
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        
        sendToServer({
          type: "control",
          action: "change_bitrate",
          rtsp_url: Url,
          is_detect: isDetection,
          screen_type: "small_screen",
        });
      }
    } catch (error) {
      console.log("Error toggling fullscreen:", error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="flex flex-col w-full bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden border-2 border-gray-300 dark:border-gray-600"
    >
      {/* Video Container */}
      <div className="relative aspect-video bg-black rounded-t-lg overflow-hidden border-b-2 border-gray-300 dark:border-gray-600">
        <div 
          ref={videoContainerRef}
          className="relative w-full h-full"
          style={{ 
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            overflow: 'hidden'
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline 
            className="w-full h-full object-fill transition-transform duration-150 ease-out"
            style={{ 
              transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`
            }}
          />
        </div>
        
        {/* Zoom indicator */}
        {zoomLevel !== 1 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
            {Math.round(zoomLevel * 100)}%
          </div>
        )}

        {/* Reconnect attempts indicator */}
        {reconnectAttempts > 0 && (
          <div className="absolute top-2 left-2 bg-yellow-600 bg-opacity-80 text-white px-2 py-1 rounded text-xs">
            Reconnecting... ({reconnectAttempts}/5)
          </div>
        )}

        {/* No Stream Overlay */}
        {!isRemoteStream && !isReset && stateConnection !== "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center">
              <VideoOff className="text-white opacity-60 mx-auto mb-1 w-6 h-6 sm:w-8 sm:h-8" />
              <p className="text-white text-xs opacity-80">No Video Stream</p>
              {stateConnection === "failed" && (
                <p className="text-red-400 text-xs mt-1">Connection Failed</p>
              )}
            </div>
          </div>
        )}  

        {/* Loading Overlay */}
        {(stateConnection === "connecting" || stateConnection === "restarting" || isReset) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="animate-spin mx-auto mb-1 w-5 h-5 sm:w-6 sm:h-6" fill="#fff" viewBox="0 0 26.349 26.35">
                <circle cx="13.792" cy="3.082" r="3.082" />
                <circle cx="13.792" cy="24.501" r="1.849" />
                <circle cx="6.219" cy="6.218" r="2.774" />
                <circle cx="21.365" cy="21.363" r="1.541" />
                <circle cx="3.082" cy="13.792" r="2.465" />
                <circle cx="24.501" cy="13.791" r="1.232" />
                <path d="M4.694 19.84a2.155 2.155 0 0 0 0 3.05 2.155 2.155 0 0 0 3.05 0 2.155 2.155 0 0 0 0-3.05 2.146 2.146 0 0 0-3.05 0z" />
                <circle cx="21.364" cy="6.218" r=".424" />
              </svg>
              <p className="text-white text-xs">
                {stateConnection === "restarting" ? "Restarting..." : "Connecting..."}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Control Panel */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-2 py-1.5 sm:px-3 sm:py-2">
        {/* Camera Name and Status */}
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <h3 className="text-ms font-medium text-gray-800 dark:text-white truncate">
            {Name}
          </h3>
          
          {/* Status Indicator */}
          <div className="flex items-center space-x-1 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded-full shadow-sm border-2 border-gray-200 dark:border-gray-600">
            <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${
              isRemoteStream ? 'bg-green-500 animate-pulse' : 
              (stateConnection === "connecting" || isReset) ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`}></div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {isRemoteStream ? 'Live' : 
               (stateConnection === "connecting" || isReset) ? 'Connecting' : 
               'Offline'}
            </span>
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="flex items-center justify-center space-x-1.5 sm:space-x-2">
          <button
            onClick={stop}
            disabled={!isRemoteStream && !connected && stateConnection !== "connecting" && stateConnection !== "restarting"}
            className="group bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50 text-white p-1.5 sm:p-2 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-sm"
            title={(!isRemoteStream && !connected) ? "Stream Already Stopped" : "Stop Stream"}
          >
            <Square className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:scale-110 transition-transform" />
          </button>
          
          <button
            onClick={startVideo}
            disabled={isRemoteStream || stateConnection === "connecting" || stateConnection === "restarting" || isReset}
            className="group bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50 text-white p-1.5 sm:p-2 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-sm"
            title={isRemoteStream ? "Stream Already Playing" : "Start/Reconnect Stream"}
          >
            <PlayIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:scale-110 transition-transform" />
          </button>

          {/* Reset View Button */}
          {(zoomLevel !== 1 || panPosition.x !== 0 || panPosition.y !== 0) && (
            <button
              onClick={resetView}
              className="group bg-blue-500 hover:bg-blue-600 text-white p-1.5 sm:p-2 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105"
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:scale-110 transition-transform" />
            </button>
          )}
          
          <button
            onClick={toggleFullscreen}
            className="group bg-purple-500 hover:bg-purple-600 text-white p-1.5 sm:p-2 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:scale-110 transition-transform" />
            ) : (
              <Maximize className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:scale-110 transition-transform" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}