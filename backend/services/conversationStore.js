/**
 * 🧠 Conversation Store — الذاكرة طويلة المدى للحوار
 *
 * المشكلة: كان الحوار يُقتطع لآخر 30 رسالة ويُرمى الباقي نهائياً، فيفقد
 * الوكيل سياق الموضوع بعد فترة قصيرة. كما كان مخزن الـ RAM الاحتياطي
 * يضيع مع إعادة التشغيل.
 *
 * الحل — ذاكرة تتوسّع لأمد طويل جداً بلا فقدان للسياق:
 *  1. حفظ كامل الحوار دائماً (MongoDB أولاً، ملف JSON كـ fallback ينجو من
 *     إعادة التشغيل).
 *  2. نافذة سياق محدودة تُرسل حرفياً للـ LLM (آخر CONTEXT_WINDOW رسالة).
 *  3. ملخّص متدحرج يطوي كل ما خرج من النافذة، فيبقى الموضوع حاضراً مهما
 *     طالت المحادثة.
 *
 * كل الدوال آمنة عند غياب قاعدة البيانات.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import { memoryFile } from '../core/runtime/workspaceRoots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_FILE = memoryFile('chat_memory.json');

// آخر عدد رسائل يُرسل حرفياً للنموذج
export const CONTEXT_WINDOW = 40;
// سقف أمان لحجم الحوار المخزّن (وثيقة Mongo محدودة بـ 16MB)
const MAX_STORED = 2000;
// نطوي الملخّص كلما تجاوزت الرسائل الجديدة (خارج النافذة) هذا العدد
const SUMMARY_EVERY = 20;

const online = () => mongoose.connection.readyState === 1;

// ─── مخزن RAM/قرص احتياطي (يُستخدم حين تكون Mongo غير متصلة) ───────────
const fallback = new Map(); // username → { messages, summary, summarizedCount }

function loadFallbackFromDisk() {
    try {
        if (fs.existsSync(FALLBACK_FILE)) {
            const data = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'));
            for (const [k, v] of Object.entries(data)) fallback.set(k, v);
        }
    } catch (e) {
        console.warn('[ConversationStore] فشل تحميل الذاكرة الاحتياطية:', e.message);
    }
}

function saveFallbackToDisk() {
    try {
        const dir = path.dirname(FALLBACK_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FALLBACK_FILE, JSON.stringify(Object.fromEntries(fallback), null, 2));
    } catch (e) {
        console.warn('[ConversationStore] فشل حفظ الذاكرة الاحتياطية:', e.message);
    }
}

loadFallbackFromDisk();

function getFallback(username) {
    if (!fallback.has(username)) {
        fallback.set(username, { messages: [], summary: '', summarizedCount: 0 });
    }
    return fallback.get(username);
}

// ─── تحميل الحوار الكامل ────────────────────────────────────────────
async function load(username) {
    if (online()) {
        try {
            const conv = await Conversation.findOne({ username }).lean();
            if (conv) {
                return {
                    messages: conv.messages || [],
                    summary: conv.summary || '',
                    summarizedCount: conv.summarizedCount || 0,
                };
            }
        } catch (e) { /* fall through to RAM */ }
    }
    const b = getFallback(username);
    return { messages: b.messages, summary: b.summary, summarizedCount: b.summarizedCount };
}

async function save(username, state) {
    // قصّ لسقف الأمان — المقتطع مطويّ أصلاً داخل الملخّص فلا يُفقد السياق
    if (state.messages.length > MAX_STORED) {
        const drop = state.messages.length - MAX_STORED;
        state.messages = state.messages.slice(drop);
        state.summarizedCount = Math.max(0, state.summarizedCount - drop);
    }
    if (online()) {
        try {
            await Conversation.findOneAndUpdate(
                { username },
                {
                    messages: state.messages,
                    summary: state.summary,
                    summarizedCount: state.summarizedCount,
                },
                { upsert: true }
            );
            return;
        } catch (e) { /* fall through to disk */ }
    }
    fallback.set(username, state);
    saveFallbackToDisk();
}

/**
 * يبني ما يُرسل للنموذج: نافذة الرسائل الأخيرة + الملخّص طويل المدى.
 * @returns {Promise<{ window: Array, summary: string, total: number }>}
 */
export async function loadForPrompt(username) {
    const state = await load(username);
    return {
        window: state.messages.slice(-CONTEXT_WINDOW),
        summary: state.summary,
        total: state.messages.length,
    };
}

/**
 * يسجّل دورة حوار كاملة (رسالة المستخدم + رد المساعد)، ثم يطوي الملخّص
 * إذا خرجت رسائل جديدة كافية من النافذة.
 *
 * @param {string} username
 * @param {string} userMessage
 * @param {string} assistantMessage
 * @param {(previousSummary: string, olderMessages: Array) => Promise<string>} [summarize]
 *        دالة تلخيص تُحقن من طبقة الـ LLM؛ إن غابت تبقى الرسائل بلا طيّ.
 */
export async function recordTurn(username, userMessage, assistantMessage, summarize) {
    const state = await load(username);
    const now = Date.now();
    state.messages.push({ role: 'user', content: userMessage, at: now });
    state.messages.push({ role: 'assistant', content: assistantMessage, at: now });

    // كم رسالة خرجت من النافذة ولم تُطوَ بعد؟
    const foldableEnd = state.messages.length - CONTEXT_WINDOW;
    const pendingOld = foldableEnd - state.summarizedCount;

    if (typeof summarize === 'function' && pendingOld >= SUMMARY_EVERY) {
        const toFold = state.messages.slice(state.summarizedCount, foldableEnd);
        try {
            const newSummary = await summarize(state.summary, toFold);
            if (newSummary && newSummary.trim()) {
                state.summary = newSummary.trim();
                state.summarizedCount = foldableEnd;
            }
        } catch (e) {
            // فشل التلخيص لا يُفقد أي رسالة — تبقى مخزّنة كاملة
            console.warn('[ConversationStore] فشل تحديث الملخّص:', e.message);
        }
    }

    await save(username, state);
    return { total: state.messages.length, summarizedCount: state.summarizedCount };
}

/**
 * 📜 آخرُ رسائل الحوار للعرض — من **حيث هي**، لا من قاعدةٍ واحدة.
 *
 * قِيس: مسارُ الاستعادة في `server.js` كان يسأل `Conversation.findOne` مباشرةً داخل
 * `if (isDbConnected …)`. وهذا المخزنُ له مصدران: Mongo **وملفٌّ على القرص ينجو من إعادة
 * التشغيل**. فبلا Mongo كان صاحبُ المشروع يفتح مشروعَه فلا يرى شيئاً — بينما رسائلُه
 * محفوظةٌ على القرص، ومنها **تقريرُ التسليم** الذي جُعل باقياً في `rememberMissionNote`.
 * أي أنّ ما حُفظ لأجل ألّا يضيع، كان يضيع في العرض.
 *
 * و`$slice` باقٍ على مسار Mongo كما كان: التعليقُ هناك يقول إنّ الوثيقة «قد تضمّ مئات
 * الرسائل»، فجلبُ المستند كاملاً ارتدادٌ في الأداء لا يُقبَل ثمناً لتوحيد المصدر.
 *
 * @param {string} key مفتاحُ الحوار (`username::project`)
 * @returns {Promise<Array<{role: string, content: string, at: number}>>}
 */
/**
 * قراءةُ Mongo وحدَها. **نتيجةٌ سلبيّةٌ معلَنة**: جسدُ هذه الدالّة غيرُ مغطّى — الاختباراتُ
 * تعمل بلا قاعدة، فحارسُ `online()` يعود `null` قبل بلوغِ الاستعلام، وطفرةٌ عليه تنجو.
 * والمُغطّى هو **القرارُ الذي تُغذّيه**: `null` ← يُسأل القرص (مقيسٌ بحقن `fromDb`).
 * تغطيتُها تحتاج قاعدةً حيّةً في الجناح، وذلك عملٌ آخر لم يُبنَ ولا يُدَّعى.
 */
const dbRecent = async (key, n) => {
    if (!online()) return null;
    try {
        const conv = await Conversation.findOne({ username: key }, { messages: { $slice: -n } }).lean();
        return conv?.messages?.length ? conv.messages : null;   // `null` = «لا شيءَ عندي» → يُسأل القرص
    } catch (e) { return null; }
};

export async function loadRecent(key, limit = 50, { fromDb = dbRecent } = {}) {
    const n = Math.max(1, Number(limit) || 50);
    // قراءةُ Mongo تُحقَن كي تُقاس: بلا هذا يبقى فرعُ «متّصلةٌ لكنّها فارغة» بلا اختبارٍ
    //    (الاختباراتُ تعمل بلا قاعدة، فالفرعُ لا يُبلَغ أصلاً — وقد نجت طفرتُه). والسابقةُ
    //    في هذا الملفّ نفسِه: `recordTurn(..., summarize)`.
    return (await fromDb(key, n)) || getFallback(key).messages.slice(-n);
}

/** حذف حوار مستخدم بالكامل (للاختبار/إعادة الضبط). */
export async function clearConversation(username) {
    fallback.delete(username);
    saveFallbackToDisk();
    if (online()) {
        try { await Conversation.deleteOne({ username }); } catch (e) {}
    }
}

/**
 * 🗂️ خبرُ المهمّة يبقى — يُلحق سطرَ تقريرٍ من المنصّة بحوارِ المشروع نفسِه.
 *
 * قِيس: `Socket.IO` يبثّ إلى **غرفة**؛ فإن غادر صاحبُ المشروع إلى متصفّحٍ آخر
 * صارت الغرفةُ فارغةً والحدثُ يُرمى في الفراغ. والمهمّةُ تُكمل على الخادم
 * وتُنهي ملفّاتها — لكنّ خبرَها لا يصله ولا يعود، لأنّ `chat_history` يستعيد
 * من `${username}::${project}` وحدَه، ولا يكتب فيه إلّا مسارُ الشات.
 * فما يراه ليس مهمّةً مقطوعة بل مهمّةً تمّت ولم يصله خبرُها.
 *
 * ولمَ لا `recordTurn`؟ لأنّها تدفع **دورةً** (مستخدم + مساعد)، فتختلق على
 * صاحب المشروع كلاماً لم يقلْه، ثمّ يدخل ذلك المختلَقُ نافذةَ النموذج.
 * التقريرُ سطرُ مساعدٍ واحد، ولا طيَّ ملخّصٍ معه: لا تلخيصَ بلا نموذج.
 *
 * الفشلُ هنا لا يُعطّل مسارَ المستخدم — التقريرُ بُثّ أصلاً؛ هذا حفظُه.
 */
export async function rememberMissionNote(username, project, content) {
    const text = String(content ?? '').trim();
    if (!username || !project || !text) return { stored: false };
    const key = `${username}::${project}`;
    try {
        const state = await load(key);
        state.messages.push({ role: 'assistant', content: text, at: Date.now() });
        await save(key, state);
        return { stored: true, key };
    } catch (e) {
        console.warn('[ConversationStore] تعذّر حفظ خبر المهمّة:', e.message);
        return { stored: false };
    }
}
