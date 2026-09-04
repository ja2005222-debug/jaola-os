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

export class PluginOrchestrator {
    constructor() {
        this.plugins = new Map();   // name → manifest
        this.agents = new Map();     // agentName → handler (من الإضافات)
        this.errors = [];
        this.initialized = false;
    }

    async init(pluginsDir = DEFAULT_PLUGINS_DIR) {
        this._pluginsDir = pluginsDir;
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
        // 🔴 مُشغّلُ اختبارات Node يُرسل نتائج كل ملفٍ إلى العملية الأمّ
        //    **مُسلسَلةً على المخرَج القياسيّ نفسه**. وطباعةُ هذا السطر من
        //    داخل الطفل أثناء ذلك تُقحم بايتاتٍ في تلك القناة، فتعجز الأمُّ
        //    عن فكّها ويسقط الملفُّ كلُّه بـ:
        //      ERR_TEST_FAILURE: Unable to deserialize cloned data
        //    قِيس: الملفّان الوحيدان اللذان سقطا بهذا الخطأ هما الوحيدان
        //    اللذان يستدعيان `init()` — siteChecker وadminAgentGrounding —
        //    ولم يسقط أيٌّ منهما منفرداً (٠ من ٢٠)، بل في التزاحم وحده.
        //    فالبيانُ يُحجب عن مُشغّل الاختبارات وحده؛ ولا يتغيّر سلوكُ
        //    المنسّق، ولا يُخفى شيءٌ في الإنتاج (`NODE_TEST_CONTEXT` يضبطه
        //    Node في أبناء الاختبار حصراً).
        if (!process.env.NODE_TEST_CONTEXT) {
            console.log(`🔌 [Plugins]: حُمّلت ${this.plugins.size} إضافة${this.errors.length ? ` (${this.errors.length} خطأ)` : ''}`);
        }
        return this.status();
    }

    // إعادة تحميل كاملة — يمسح السجل ويعيد المسح (بعد إنشاء/حذف/تعديل إضافة)
    // cache-busting: import مع طابع زمني ليقرأ النسخة الجديدة من القرص
    async reload() {
        this.plugins.clear();
        this.agents.clear();
        this.errors = [];
        this.initialized = false;
        return this.init(this._pluginsDir);
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

    // 📐 عقد Capability: فهرس القدرات المُعلَنة في manifests الإضافات المفعّلة.
    // مستهلكه الحيّ `status()` → `/api/admin/plugins`، والفهرس يتبع التفعيل
    // فوراً بلا إعادة تحميل.
    //
    // ⚠️ حُذفت معها `findByCapability(name)` التي شُحنت في Sprint 1: لم يكن
    // لها مستهلكٌ إنتاجي واحد — اختبارها وحده — وهذا بالضبط ما يمنعه المبدأ
    // العاشر «لا تجريد بلا مستهلك حقيقي»، وقد طبّقتُه على غيري في Sprints
    // 3 و4 فوجب تطبيقه على ما كتبتُه. تعود يوم يوجد موجِّهٌ يسأل «من يقدر
    // على X؟» فعلاً — وهي سطرٌ واحد فوق `capabilities()` القائمة.
    capabilities() {
        const out = [];
        for (const p of this.plugins.values()) {
            if (!p.enabled) continue;
            for (const c of p.capabilities || []) out.push({ capability: c, plugin: p.name });
        }
        return out;
    }

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
                capabilities: p.capabilities || [],
            })),
            capabilities: this.capabilities(),
            registeredAgents: this.listAgents(),
            errors: this.errors,
        };
    }
}

// نسخة مفردة مشتركة عبر التطبيق
export const orchestrator = new PluginOrchestrator();
export default orchestrator;
