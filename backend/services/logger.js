import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = './logs';
const LOG_FILE = path.join(LOG_DIR, 'jaola.log');

// تأكد من وجود مجلد logs
async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (err) {}
}

// كتابة سجل (info, warn, error)
async function log(level, message, meta = {}) {
    await ensureLogDir();
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...meta
    };
    const logLine = JSON.stringify(logEntry) + '\n';
    try {
        await fs.appendFile(LOG_FILE, logLine);
    } catch (err) {}
    // أيضا طباعة في console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${level.toUpperCase()}] ${message}`, meta);
}

export const logger = {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta)
};
