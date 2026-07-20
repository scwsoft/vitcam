// server.js - WebSocket to TCP Socket Proxy
const WebSocket = require('ws');
const net = require('net');

// Create WebSocket server
const wss = new WebSocket.Server({ port: 3001 });

wss.on('connection', function connection(ws, req) {
  console.log('WebSocket client connected');
  
  // Get the path from the URL
  const url = new URL(req.url, 'http://192.168.68.109');
  const path = url.pathname;
  
  if (path === '/ws-proxy') {
    // Create TCP socket connection to the Python server
    const tcpSocket = new net.Socket();
    let buffer = '';
    let isFirstConnection = true;
    
    // Connect to the Python aiortc server
    tcpSocket.connect(9999, '192.168.68.109', function() {
      console.log('Connected to Python TCP server');
      ws.send(JSON.stringify({ type: 'status', message: 'Connected to Python TCP server' }));
    });
    
    // Forward data from WebSocket to TCP socket
    ws.on('message', function(message) {
      console.log('Forwarding message to TCP:', message.toString().substring(0, 100) + '...');
      
      try {
        // Parse the message to see if it's JSON or raw
        let data = message.toString();
        
        // Add line breaks for Python readability if needed
        if (!data.endsWith('\n')) {
          data += '\n';
        }
        
        tcpSocket.write(data);
      } catch (e) {
        console.error('Error processing WebSocket message:', e);
        ws.send(JSON.stringify({ type: 'error', message: `Error sending to TCP: ${e.message}` }));
      }
    });
    
    // Forward data from TCP socket to WebSocket
    tcpSocket.on('data', function(data) {
      console.log('Received data from TCP:', data.toString().substring(0, 100) + '...');
      
      try {
        // For aiortc, data might come in chunks, so we need to buffer it
        buffer += data.toString();
        
        // Check if we have a complete SDP message
        if (buffer.includes('a=end-of-candidates')) {
          console.log('Complete SDP received, forwarding to WebSocket');
          ws.send(buffer);
          buffer = '';
        }
        // Try to parse as JSON
        else if (buffer.trim().startsWith('{') && buffer.trim().endsWith('}')) {
          try {
            JSON.parse(buffer.trim());
            ws.send(buffer.trim());
            buffer = '';
          } catch (e) {
            // Not valid JSON yet, keep buffering
          }
        }
        // If we have a reasonably large buffer, send it anyway
        else if (buffer.length > 1000) {
          ws.send(buffer);
          buffer = '';
        }
      } catch (e) {
        console.error('Error forwarding TCP data to WebSocket:', e);
      }
    });
    
    // Handle TCP socket errors
    tcpSocket.on('error', function(error) {
      console.error('TCP socket error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'TCP socket error: ' + error.message }));
    });
    
    // Handle TCP socket close
    tcpSocket.on('close', function() {
      console.log('TCP socket closed');
      ws.send(JSON.stringify({ type: 'status', message: 'TCP connection closed' }));
      ws.close();
    });
    
    // Handle WebSocket close
    ws.on('close', function() {
      console.log('WebSocket closed');
      tcpSocket.destroy();
    });
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid path' }));
    ws.close();
  }
});

console.log('WebSocket to TCP proxy server running on port 3001');