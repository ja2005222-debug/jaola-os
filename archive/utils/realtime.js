export default class RealtimeUpdater {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${location.host}`);
        
        this.ws.onopen = () => {
            console.log('🔌 WebSocket connected');
            this.emit('connected');
            this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit(data.type || 'message', data);
            } catch(e) { console.warn('Invalid WebSocket data:', e); }
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            this.emit('disconnected');
            this.reconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 3000 * this.reconnectAttempts);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) callbacks.forEach(cb => cb(data));
    }

    close() {
        if (this.ws) this.ws.close();
    }
}
