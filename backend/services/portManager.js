import { getDB } from './database.js';

const BASE_PORT = 3000;
const MAX_PORT = 4000;

// الحصول على منفذ حر لمشروع جديد
export function getFreePort() {
    const db = getDB();
    const usedPorts = db.prepare(`SELECT port FROM projects WHERE port IS NOT NULL`).all().map(p => p.port);
    for (let port = BASE_PORT; port <= MAX_PORT; port++) {
        if (!usedPorts.includes(port)) return port;
    }
    throw new Error('No free ports available');
}

// تعيين منفذ لمشروع بعد إنشائه
export function assignPort(projectId) {
    const db = getDB();
    const port = getFreePort();
    db.prepare(`UPDATE projects SET port = ? WHERE id = ?`).run(port, projectId);
    return port;
}

// الحصول على منفذ المشروع
export function getProjectPort(projectId) {
    const db = getDB();
    const row = db.prepare(`SELECT port FROM projects WHERE id = ?`).get(projectId);
    return row?.port;
}
