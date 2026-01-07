// pages/api/signaling.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';

// Keep track of WebSocket server instance
let wsServer: WebSocketServer | null = null;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // This function only sets up the WebSocket server if it doesn't exist yet
  if (!res.socket) {
    res.status(500).json({ error: 'No socket found' });
    return;
  }

  if (!wsServer) {
    const httpServer = res.socket.server as unknown as HttpServer;
    
    if (!httpServer.listening) {
      res.status(500).json({ error: 'HTTP server not listening' });
      return;
    }

    // Create WebSocket server
    wsServer = new WebSocketServer({ noServer: true });
    
    // Track connected clients
    const clients = new Set<WebSocket>();

    // Handle WebSocket connections
    wsServer.on('connection', (ws: WebSocket) => {
      clients.add(ws);
      console.log('Client connected, total clients:', clients.size);

      ws.onmessage = (event) => {
        // Relay signaling messages to all other clients
        const message = event.data.toString();
        
        for (const client of clients) {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(message);
          }
        }
      };

      ws.onclose = () => {
        clients.delete(ws);
        console.log('Client disconnected, total clients:', clients.size);
      };
    });

    // Handle WebSocket upgrade
    httpServer.on('upgrade', (request, socket, head) => {
      if (!wsServer) return;
      
      const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
      
      if (pathname === '/api/signaling') {
        wsServer.handleUpgrade(request, socket, head, (ws) => {
          wsServer?.emit('connection', ws, request);
        });
      }
    });
  }

  // Send a simple response for HTTP requests to this endpoint
  res.status(200).json({ message: 'WebSocket signaling server running' });
}

// Disable body parsing, we only need WebSocket connections
export const config = {
  api: {
    bodyParser: false,
  },
};