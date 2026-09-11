import { randomUUID } from 'node:crypto';

const TERMINAL = new Set(['handled', 'failed']);

/**
 * Bounded idempotency/status registry for chat commands.
 *
 * This is deliberately process-local for the first protocol slice.  The
 * public contract (messageId + status events) can later be backed by Redis or
 * Postgres without changing the browser protocol.
 */
export class ChatCommandTracker {
    constructor({ ttlMs = 10 * 60_000, maxEntries = 2_000, now = Date.now } = {}) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.now = now;
        this.commands = new Map();
    }

    _key(username, project, messageId) {
        return `${username}\u0000${project}\u0000${messageId}`;
    }

    _prune() {
        const cutoff = this.now() - this.ttlMs;
        for (const [key, value] of this.commands) {
            if (value.updatedAt < cutoff) this.commands.delete(key);
        }
        while (this.commands.size >= this.maxEntries) {
            this.commands.delete(this.commands.keys().next().value);
        }
    }

    begin({ username, project, messageId = randomUUID() }) {
        this._prune();
        const key = this._key(username, project, messageId);
        const existing = this.commands.get(key);
        if (existing) return { ...existing, duplicate: true };

        const at = this.now();
        const command = { messageId, username, project, status: 'accepted', createdAt: at, updatedAt: at };
        this.commands.set(key, command);
        return { ...command, duplicate: false };
    }

    transition(command, status, extra = {}) {
        if (!command || TERMINAL.has(command.status)) return command ? { ...command } : null;
        const key = this._key(command.username, command.project, command.messageId);
        const current = this.commands.get(key);
        if (!current) return null;
        const next = { ...current, ...extra, status, updatedAt: this.now() };
        this.commands.set(key, next);
        Object.assign(command, next);
        return { ...next };
    }
}

