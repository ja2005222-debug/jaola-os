/**
 * 🔌 Plugin Loader — اكتشاف وتحميل الإضافات
 *
 * يمسح مجلد الإضافات ويستورد كل وحدة تُصدّر manifest صالحاً.
 * كل إضافة ملف .js (أو مجلد فيه index.js) يُصدّر افتراضياً كائناً بالشكل:
 *
 *   export default {
 *     name: 'my-plugin',        // مطلوب، فريد
 *     version: '1.0.0',
 *     type: 'agent' | 'hook' | 'service',
 *     description: '...',
 *     enabled: true,            // اختياري (افتراضي true)
 *     hooks: { onLoad, beforeBuild, afterBuild, ... }  // دوال lifecycle
 *   }
 *
 * التحميل متسامح: إضافة معطوبة تُسجَّل كخطأ ولا توقف الباقي.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

function validateManifest(mod, source) {
    const m = mod?.default || mod;
    if (!m || typeof m !== 'object') {
        return { valid: false, error: 'لا يُصدّر كائن manifest افتراضي' };
    }
    if (!m.name || typeof m.name !== 'string') {
        return { valid: false, error: 'حقل name مفقود أو غير نصي' };
    }
    return {
        valid: true,
        manifest: {
            name: m.name,
            version: m.version || '0.0.0',
            type: m.type || 'hook',
            description: m.description || '',
            enabled: m.enabled !== false,
            hooks: (m.hooks && typeof m.hooks === 'object') ? m.hooks : {},
            source,
        },
    };
}

// تحميل كل الإضافات من مجلد
export async function loadPluginsFrom(pluginsDir) {
    const loaded = [];
    const errors = [];

    if (!fs.existsSync(pluginsDir)) {
        return { loaded, errors, scanned: 0 };
    }

    let entries = [];
    try { entries = fs.readdirSync(pluginsDir, { withFileTypes: true }); } catch (e) {
        return { loaded, errors: [{ source: pluginsDir, error: e.message }], scanned: 0 };
    }

    for (const entry of entries) {
        // نتخطى الملفات المخفية والقوالب
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;

        let filePath = null;
        if (entry.isFile() && entry.name.endsWith('.js')) {
            filePath = path.join(pluginsDir, entry.name);
        } else if (entry.isDirectory()) {
            const idx = path.join(pluginsDir, entry.name, 'index.js');
            if (fs.existsSync(idx)) filePath = idx;
        }
        if (!filePath) continue;

        try {
            const mod = await import(pathToFileURL(filePath).href);
            const { valid, manifest, error } = validateManifest(mod, filePath);
            if (valid) loaded.push(manifest);
            else errors.push({ source: filePath, error });
        } catch (e) {
            errors.push({ source: filePath, error: e.message });
        }
    }

    return { loaded, errors, scanned: entries.length };
}

export default { loadPluginsFrom };
