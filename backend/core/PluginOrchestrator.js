/**
 * 🎛️ Plugin Orchestrator — سجل الإضافات ومُشغّل الـ hooks
 *
 * يحتفظ بالإضافات المُحمّلة، ويُشغّل نقاط الـ lifecycle (hooks) بالترتيب:
 * - registerAgent: إضافة تُسجّل وكيلاً جديداً في خريطة الوكلاء
 * - beforeBuild / afterBuild: تُستدعى حول كل مهمة بناء
 * - أي hook مخصص عبر runHook(name, ctx)
 *
 * كل استدعاء hook معزول: إضافة تفشل تُسجَّل ولا توقف البقية.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { loadPluginsFrom } from './PluginLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLUGINS_DIR = path.join(__dirname, '../plugins');

class PluginOrchestrator {
    constructor() {
        this.plugins = new Map();   // name → manifest
        this.agents = new Map();     // agentName → handler (من الإضافات)
        this.errors = [];
        this.initialized = false;
    }

    async init(pluginsDir = DEFAULT_PLUGINS_DIR) {
        const { loaded, errors } = await loadPluginsFrom(pluginsDir);
        this.errors = errors;

        for (const manifest of loaded) {
            if (!manifest.enabled) continue;
            if (this.plugins.has(manifest.name)) {
                this.errors.push({ source: manifest.source, error: `اسم مكرر: ${manifest.name}` });
                continue;
            }
            this.plugins.set(manifest.name, manifest);

            // hook التحميل + تسجيل الوكلاء
            await this._safeHook(manifest, 'onLoad', { orchestrator: this });
            if (manifest.type === 'agent' && typeof manifest.hooks.registerAgent === 'function') {
                try {
                    const reg = await manifest.hooks.registerAgent();
                    if (reg?.name && typeof reg.handler === 'function') {
                        this.agents.set(reg.name, reg.handler);
                    }
                } catch (e) {
                    this.errors.push({ source: manifest.source, error: `registerAgent فشل: ${e.message}` });
                }
            }
        }

        this.initialized = true;
        console.log(`🔌 [Plugins]: حُمّلت ${this.plugins.size} إضافة${this.errors.length ? ` (${this.errors.length} خطأ)` : ''}`);
        return this.status();
    }

    async _safeHook(manifest, hookName, ctx) {
        const fn = manifest.hooks?.[hookName];
        if (typeof fn !== 'function') return undefined;
        try {
            return await fn(ctx);
        } catch (e) {
            this.errors.push({ source: manifest.source, error: `${hookName} فشل: ${e.message}` });
            return undefined;
        }
    }

    // تشغيل hook عبر كل الإضافات المفعّلة (مثل beforeBuild/afterBuild)
    async runHook(hookName, ctx = {}) {
        const results = [];
        for (const manifest of this.plugins.values()) {
            if (!manifest.enabled) continue;
            const r = await this._safeHook(manifest, hookName, ctx);
            if (r !== undefined) results.push({ plugin: manifest.name, result: r });
        }
        return results;
    }

    getAgent(name) { return this.agents.get(name); }
    listAgents() { return [...this.agents.keys()]; }

    setEnabled(name, enabled) {
        const p = this.plugins.get(name);
        if (!p) return false;
        p.enabled = enabled;
        return true;
    }

    status() {
        return {
            count: this.plugins.size,
            plugins: [...this.plugins.values()].map(p => ({
                name: p.name, version: p.version, type: p.type,
                enabled: p.enabled, description: p.description,
            })),
            registeredAgents: this.listAgents(),
            errors: this.errors,
        };
    }
}

// نسخة مفردة مشتركة عبر التطبيق
export const orchestrator = new PluginOrchestrator();
export default orchestrator;
