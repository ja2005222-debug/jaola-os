import { WebSocketServer } from 'ws';
import { setWebSocketServer } from './broadcast.js';

let wss = null;

export function initializeWebSocket(server) {
    wss = new WebSocketServer({ server });
    setWebSocketServer(wss);
    
    wss.on('connection', (ws) => {
        console.log('🔌 WebSocket client connected');
        ws.on('close', () => console.log('🔌 WebSocket client disconnected'));
    });
    
    return { wss };
}

export function getWss() {
    return wss;
}
