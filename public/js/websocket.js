let ws = null;
let reconnectTimer = null;

export function initWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // نشر الأحداث للتحديث
        window.dispatchEvent(new CustomEvent('jaola:update', { detail: data }));
    };
    ws.onclose = () => {
        reconnectTimer = setTimeout(initWebSocket, 3000);
    };
}

export function sendWebSocket(data) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
