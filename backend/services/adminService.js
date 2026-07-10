/**
 * 🛠️ Admin Service — إدارة الوكلاء (الإضافات) والملفات من لوحة التحكم
 *
 * يوفّر عمليات آمنة للوحة الأدمِن:
 * - صناعة وكيل بأبسط طريقة: اسم + تعليمات → إضافة عاملة تُولّد ملفها تلقائياً
 * - قراءة/تعديل/حذف كود الإضافات
 * - إدارة ملفات مشاريع المستخدمين (تصفّح/قراءة/كتابة/حذف)
 *
 * كل مسار يمرّ عبر sanitizePath. الوصول محصور بـ adminOnly في server.js.
 */

import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizePath } from '../middleware/security.js';
import { persistEntry, removeEntry, hydrateStore } from './persistence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.resolve(__dirname, '../plugins');
const WORKSPACE_DIR = path.resolve(__dirname, '../../workspace');

// ═══════════════════════════════════════════════════════
// 🔤 أدوات مساعدة
// ═══════════════════════════════════════════════════════
function toPluginFileName(name) {
    const safe = name.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/^-+|-+$/g, '');
    if (!safe || safe.length < 2) throw new Error('اسم غير صالح (حرفان على الأقل، إنجليزي/أرقام).');
    return `${safe}.js`;
}

function toCamel(name) {
    return name.trim().toLowerCase()
        .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
        .replace(/[^a-z0-9]/gi, '') || 'customAgent';
}

// هروب آمن للنص داخل سلسلة JS (backtick)
function escapeForTemplate(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

// ═══════════════════════════════════════════════════════
// 🤖 صناعة وكيل بأبسط طريقة: اسم + وصف + تعليمات
// ═══════════════════════════════════════════════════════
export function generateAgentPluginCode({ name, description = '', instructions = '', temperature = 0.4 }) {
    const camel = toCamel(name);
    const safeName = name.trim();
    const temp = Math.min(1, Math.max(0, Number(temperature) || 0.4));

    return `/**
 * 🤖 ${escapeForTemplate(safeName)} — وكيل مُنشأ من لوحة التحكم
 * ${escapeForTemplate(description)}
 */

export default {
  name: ${JSON.stringify(name.trim())},
  version: '1.0.0',
  type: 'agent',
  description: ${JSON.stringify(description)},
  enabled: true,

  hooks: {
    async registerAgent() {
      return {
        name: ${JSON.stringify(camel)},
        handler: async (input = {}) => {
          const { smartChat } = await import('../agents/baseAgent.js');
          const userText = typeof input === 'string'
            ? input
            : (input.text || input.message || JSON.stringify(input));
          const reply = await smartChat([
            { role: 'system', content: \`${escapeForTemplate(instructions || 'أنت وكيل مساعد. نفّذ ما يطلبه المستخدم بدقة.')}\` },
            { role: 'user', content: userText },
          ], { max_tokens: 1500, temperature: ${temp} });
          return { agent: ${JSON.stringify(name.trim())}, reply };
        },
      };
    },
  },
};
`;
}

// ═══════════════════════════════════════════════════════
// 📁 إدارة ملفات الإضافات
// ═══════════════════════════════════════════════════════
export async function createAgentPlugin({ name, description, instructions, rawCode, temperature }) {
    const fileName = toPluginFileName(name);
    const target = sanitizePath(fileName, PLUGINS_DIR);

    if (fs.existsSync(target)) {
        throw new Error(`إضافة بهذا الاسم موجودة بالفعل (${fileName}).`);
    }

    // rawCode للوضع المتقدم، وإلا نولّد وكيل LLM من التعليمات
    const code = (rawCode && rawCode.trim().length > 20)
        ? rawCode
        : generateAgentPluginCode({ name, description, instructions, temperature });

    await fsp.mkdir(PLUGINS_DIR, { recursive: true });
    await fsp.writeFile(target, code);
    // 💾 حفظ دائم في MongoDB — قرص Render يُمسح مع كل إعادة نشر، وبدون هذا
    // يختفي الوكيل الجديد بعد إعادة التشغيل.
    persistEntry('plugins', fileName, { code, updatedAt: Date.now() });
    return { file: fileName, created: true };
}

export function listPluginFiles() {
    try {
        return fs.readdirSync(PLUGINS_DIR)
            .filter(f => f.endsWith('.js'))
            .map(f => ({
                file: f,
                name: f.replace(/\.js$/, ''),
                size: fs.statSync(path.join(PLUGINS_DIR, f)).size,
                modifiedAt: fs.statSync(path.join(PLUGINS_DIR, f)).mtimeMs,
            }));
    } catch {
        return [];
    }
}

export async function readPluginCode(fileName) {
    const target = sanitizePath(path.basename(fileName), PLUGINS_DIR);
    if (!fs.existsSync(target)) throw new Error('الملف غير موجود.');
    return fsp.readFile(target, 'utf-8');
}

export async function writePluginCode(fileName, code) {
    if (typeof code !== 'string' || code.length < 10) throw new Error('الكود قصير جداً أو غير صالح.');
    const base = path.basename(fileName);
    const target = sanitizePath(base, PLUGINS_DIR);
    await fsp.writeFile(target, code);
    // 💾 تحديث النسخة الدائمة كي لا يعود التعديل للخلف بعد إعادة النشر
    persistEntry('plugins', base, { code, updatedAt: Date.now() });
    return { file: base, saved: true };
}

export async function deletePluginFile(fileName) {
    const base = path.basename(fileName);
    const target = sanitizePath(base, PLUGINS_DIR);
    const existed = fs.existsSync(target);
    if (existed) await fsp.rm(target, { force: true });
    // 🗑️ احذف النسخة الدائمة أيضاً وإلا عاد الوكيل بعد إعادة التشغيل
    removeEntry('plugins', base);
    return { deleted: existed };
}

// ═══════════════════════════════════════════════════════
// ♻️ استرجاع الوكلاء المُنشأة من MongoDB إلى القرص
//    يُستدعى عند جاهزية قاعدة البيانات قبل مسح الـ orchestrator،
//    فتبقى الوكلاء الجديدة موجودة بعد كل إعادة نشر/تشغيل.
// ═══════════════════════════════════════════════════════
export async function restorePluginsFromDB() {
    await fsp.mkdir(PLUGINS_DIR, { recursive: true });
    let restored = 0;
    await hydrateStore('plugins', (fileName, value) => {
        try {
            if (!value?.code) return;
            const base = path.basename(fileName);
            const target = sanitizePath(base, PLUGINS_DIR);
            // اكتب فقط إذا كان الملف مفقوداً أو نسخة القاعدة أحدث — لا نطمس تعديلاً محلياً أحدث
            let write = true;
            if (fs.existsSync(target)) {
                const mtime = fs.statSync(target).mtimeMs;
                write = (value.updatedAt || 0) > mtime;
            }
            if (write) {
                fs.writeFileSync(target, value.code);
                restored++;
            }
        } catch (e) {
            console.warn(`[AdminService] فشل استرجاع الإضافة ${fileName}:`, e.message);
        }
    });
    if (restored) console.log(`♻️ [Plugins] استُعيد ${restored} وكيل من قاعدة البيانات`);
    return restored;
}

// ═══════════════════════════════════════════════════════
// 🗂️ إدارة ملفات مشاريع المستخدمين
// ═══════════════════════════════════════════════════════
const SKIP = new Set(['.git', '.backups', 'node_modules', '.next', 'dist']);

// شجرة المستخدمين → المشاريع
export function listWorkspaceTree() {
    const tree = [];
    try {
        for (const user of fs.readdirSync(WORKSPACE_DIR)) {
            if (user.startsWith('.')) continue;
            const userPath = path.join(WORKSPACE_DIR, user);
            if (!fs.statSync(userPath).isDirectory()) continue;
            const projects = fs.readdirSync(userPath)
                .filter(p => !p.startsWith('.') && fs.statSync(path.join(userPath, p)).isDirectory());
            tree.push({ user, projects });
        }
    } catch { /* فارغ */ }
    return tree;
}

// ملفات مشروع محدد (بمساراتها النسبية)
export function listProjectFiles(user, project) {
    const root = sanitizePath(path.join(sanitize(user), sanitize(project)), WORKSPACE_DIR);
    const acc = [];
    const walk = (dir) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (e.name.startsWith('.') && e.name !== '.gitignore') continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full); }
            else if (e.isFile()) acc.push(path.relative(root, full).split(path.sep).join('/'));
        }
    };
    if (fs.existsSync(root)) walk(root);
    return acc;
}

export async function readProjectFile(user, project, relPath) {
    const root = sanitizePath(path.join(sanitize(user), sanitize(project)), WORKSPACE_DIR);
    const target = sanitizePath(relPath, root);
    if (!fs.existsSync(target)) throw new Error('الملف غير موجود.');
    return fsp.readFile(target, 'utf-8');
}

export async function writeProjectFile(user, project, relPath, content) {
    if (typeof content !== 'string') throw new Error('المحتوى غير صالح.');
    const root = sanitizePath(path.join(sanitize(user), sanitize(project)), WORKSPACE_DIR);
    const target = sanitizePath(relPath, root);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, content);
    return { saved: true };
}

export async function deleteProjectFile(user, project, relPath) {
    const root = sanitizePath(path.join(sanitize(user), sanitize(project)), WORKSPACE_DIR);
    const target = sanitizePath(relPath, root);
    if (!fs.existsSync(target)) return { deleted: false };
    await fsp.rm(target, { force: true });
    return { deleted: true };
}

function sanitize(seg) {
    return (seg || '').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
}
