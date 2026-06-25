let wss = null;

export function initializeWebSocket(server) {
    wss = server;
    wss.on('connection', (ws) => {
        console.log('🔌 WebSocket client connected');
        ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to JAOLA OS' }));
        ws.on('close', () => console.log('🔌 WebSocket client disconnected'));
        ws.on('error', (err) => console.error('WebSocket error:', err));
    });
}

export function broadcastTaskUpdate(task) {
    if (!wss) return;
    const payload = JSON.stringify({
        type: 'task_update',
        agent: task.agent,
        status: task.status || 'pending',
        action: task.task || task.action,
        taskId: task.id
    });
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(payload);
    });
}

export function broadcastPlanUpdate(plan) {
    if (!wss) return;
    const payload = JSON.stringify({
        type: 'plan_update',
        goal: plan.goal || 'New Plan',
        tasks: plan.tasks || []
    });
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(payload);
    });
}
