let wss = null;

export function setWebSocketServer(server) {
    wss = server;
}

export function broadcastTimeline(message, type = 'info') {
    if (!wss) return;
    const payload = JSON.stringify({ type: 'timeline', data: { message, type, timestamp: new Date().toLocaleTimeString('ar-EG') } });
    wss.clients.forEach(client => { if (client.readyState === 1) client.send(payload); });
}

// نظام الأحداث الموحد (الأساسي)
export function emitEvent(event, payload) {
    if (!wss) return;
    const message = JSON.stringify({ event, ...payload });
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(message);
    });
}

// التوافق مع الكود القديم
export function broadcastTaskUpdate(taskId, status, details = {}) {
    emitEvent('task.updated', { taskId, status, ...details });
}

export function broadcastPlanUpdate(planId, goal) {
    emitEvent('plan.created', { planId, goal });
}

export function broadcastProjectUpdated(projectId, action) {
    emitEvent('project.updated', { projectId, action });
}

// دالة إضافية للتوافق (إن وجدت في مكان آخر)
export function broadcastUpdate(type, data) {
    if (type === 'task_update') {
        broadcastTaskUpdate(data.taskId, data.status, data);
    } else if (type === 'plan_update') {
        broadcastPlanUpdate(data.planId, data.goal);
    }
}
