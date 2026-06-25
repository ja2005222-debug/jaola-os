export class SocketManager {
    constructor(wss) {
        this.wss = wss;
    }

    broadcast(type, payload) {
        const message = JSON.stringify({ type, ...payload });
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) client.send(message);
        });
    }
}
