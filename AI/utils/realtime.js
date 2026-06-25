/**
 * Realtime Updates - وحدة WebSocket للتحديثات الفورية
 * بديل آمن وفعال لـ Polling
 */

export class RealtimeUpdater {
    constructor(options = {}) {
        this.url = options.url || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}://${location.host}`;
        this.reconnectDelay = options.reconnectDelay || 3000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
        this.heartbeatInterval = options.heartbeatInterval || 30000;

        this.ws = null;
        this.handlers = new Map();
        this.reconnectAttempts = 0;
        this.isManualClose = false;
        this.messageQueue = [];
        this.connected = false;
        this.heartbeatTimeout = null;
        this.localEvents = new Set(['connected', 'disconnected', 'error', 'failed']);
    }

    /**
     * الاتصال بـ WebSocket
     */
    connect() {
        if (this.connected) {
            console.warn('Already connected');
            return;
        }

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.processQueue();
                this.startHeartbeat();
                this.dispatch('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.resetHeartbeat();
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse message:', error, event.data);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.dispatch('error', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.connected = false;
                this.stopHeartbeat();
                this.dispatch('disconnected');

                if (!this.isManualClose) {
                    this.attemptReconnect();
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.attemptReconnect();
        }
    }

    /**
     * محاولة إعادة الاتصال
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnect attempts reached');
            this.dispatch('failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
    }

    /**
     * معالجة الرسالة الواردة
     */
    handleMessage(data) {
        const event = data.event || (data.type === 'task_update' ? 'task.updated' : null);
        const payload = data.payload || data;
        if (!event) {
            console.warn('Message without event type:', data);
            return;
        }

        this.dispatch(event, payload);
    }

    dispatch(event, payload) {
        const handlers = this.handlers.get(event) || [];
        handlers.forEach(handler => {
            try {
                handler(payload);
            } catch (error) {
                console.error(`Error in handler for event '${event}':`, error);
            }
        });
    }

    /**
     * الاستماع لـ event معين
     */
    on(eventType, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push(handler);

        // إرجاع دالة للـ unsubscribe
        return () => this.off(eventType, handler);
    }

    /**
     * إيقاف الاستماع
     */
    off(eventType, handler) {
        if (!this.handlers.has(eventType)) return;
        const handlers = this.handlers.get(eventType);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * الاستماع مرة واحدة فقط
     */
    once(eventType, handler) {
        const unsubscribe = this.on(eventType, (payload) => {
            handler(payload);
            unsubscribe();
        });
    }

    /**
     * إرسال رسالة
     */
    emit(eventType, payload = null) {
        if (this.localEvents.has(eventType)) {
            this.dispatch(eventType, payload);
            return;
        }

        const message = { event: eventType, payload };

        if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            // قائمة انتظار الرسائل إذا لم يكن متصلاً
            this.messageQueue.push(message);
            console.warn('Message queued (not connected):', eventType);
        }
    }

    /**
     * معالجة قائمة انتظار الرسائل
     */
    processQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Heartbeat - للتأكد من الاتصال
     */
    startHeartbeat() {
        this.heartbeatTimeout = setInterval(() => {
            if (this.connected && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ event: 'ping' }));
            }
        }, this.heartbeatInterval);
    }

    /**
     * إعادة تعيين Heartbeat
     */
    resetHeartbeat() {
        if (this.heartbeatTimeout) {
            clearInterval(this.heartbeatTimeout);
        }
        this.startHeartbeat();
    }

    /**
     * إيقاف Heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatTimeout) {
            clearInterval(this.heartbeatTimeout);
        }
    }

    /**
     * إغلاق الاتصال
     */
    close() {
        this.isManualClose = true;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
        }
        this.connected = false;
    }

    /**
     * الحصول على حالة الاتصال
     */
    isConnected() {
        return this.connected;
    }

    /**
     * إعادة تعيين الاتصال
     */
    reset() {
        this.close();
        this.reconnectAttempts = 0;
        this.messageQueue = [];
        this.isManualClose = false;
    }
}

/**
 * مثال على الاستخدام:
 *
 * const updater = new RealtimeUpdater();
 *
 * updater.on('task.updated', (payload) => {
 *     console.log('Task updated:', payload);
 *     updateTaskUI(payload);
 * });
 *
 * updater.on('agent.status', (payload) => {
 *     console.log('Agent status changed:', payload);
 *     updateAgentUI(payload);
 * });
 *
 * updater.connect();
 *
 * // إرسال رسالة
 * updater.emit('request.task', { id: '123' });
 *
 * // إيقاف الاستماع
 * const unsubscribe = updater.on('event', handler);
 * unsubscribe();
 */

export default RealtimeUpdater;
