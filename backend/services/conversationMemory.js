import { getDB } from './database.js';

export async function saveMessage(sessionId, role, content) {
    const db = getDB();
    db.prepare(`
        INSERT INTO conversations (session_id, role, content) 
        VALUES (?, ?, ?)
    `).run(sessionId, role, content);
}
const projectCards = new Map();

export async function getProjectCard(sessionId) {
    return projectCards.get(sessionId) || null;
}

export async function updateProjectCard(sessionId, updates) {
    const current = projectCards.get(sessionId) || {};

    const updated = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    projectCards.set(sessionId, updated);

    return updated;
}

export async function getConversationHistory(sessionId, limit = 10) {
    const db = getDB();
    const rows = db.prepare(`
        SELECT role, content FROM conversations 
        WHERE session_id = ? 
        ORDER BY created_at DESC LIMIT ?
    `).all(sessionId, limit);
    return rows.reverse();
}

// دالة بسيطة لتخزين سياق مؤقت (مثل اسم المشروع الحالي) - بدون جداول معقدة
const sessionContext = new Map();

export async function setSessionContext(sessionId, context) {
    sessionContext.set(sessionId, { ...(sessionContext.get(sessionId) || {}), ...context });
}

export async function getSessionContext(sessionId) {
    return sessionContext.get(sessionId) || {};
}
