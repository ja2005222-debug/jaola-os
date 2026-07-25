/**
 * ✈️ ناشر تيليجرام — أول قناة نشر مباشر (وكلاء القنوات — الجولة ٣).
 *
 * المالك ينشئ بوتاً عبر @BotFather ويضيفه مشرفاً في قناته، ثم يربطه هنا.
 * التوكن يُخزَّن مشفّراً (secretVault) في ملف تكاملات المستخدم — لا يُعاد
 * للواجهة أبداً، والحالة تكشف اسم البوت والقناة فقط.
 */

import fs from 'fs';
import path from 'path';
import { encryptSecret, decryptSecret } from '../utils/secretVault.js';

const TG_API = 'https://api.telegram.org';
const fileOf = (dir, user) => path.join(dir, String(user || '').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');

export const validBotToken = (v) => /^\d{6,}:[\w-]{30,}$/.test(String(v || '').trim());
export const validChatId = (v) => /^@[A-Za-z]\w{3,}$/.test(String(v || '').trim()) || /^-?\d{6,}$/.test(String(v || '').trim());

function readAll(dir, user) {
    try { return JSON.parse(fs.readFileSync(fileOf(dir, user), 'utf8')) || {}; }
    catch { return {}; }
}
function writeAll(dir, user, obj) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fileOf(dir, user), JSON.stringify(obj));
}

/** حالة الربط للواجهة — بلا أي توكن. */
export function readTelegramConfig(dir, user) {
    const t = readAll(dir, user).telegram;
    if (!t?.tokenEnc || !t?.chatId) return { configured: false };
    return { configured: true, chatId: t.chatId, botName: t.botName || null };
}

export function saveTelegramConfig(dir, user, { botToken, chatId, botName }) {
    const all = readAll(dir, user);
    all.telegram = { tokenEnc: encryptSecret(String(botToken).trim()), chatId: String(chatId).trim(), botName: String(botName || '').slice(0, 60) };
    writeAll(dir, user, all);
    return { ok: true };
}

export function deleteTelegramConfig(dir, user) {
    const all = readAll(dir, user);
    delete all.telegram;
    writeAll(dir, user, all);
    return { ok: true };
}

/** يتحقق من صلاحية التوكن عبر getMe ويعيد اسم البوت. */
export async function checkTelegramToken(botToken, deps = {}) {
    const fetchImpl = deps.fetchImpl || fetch;
    try {
        const r = await fetchImpl(`${TG_API}/bot${botToken}/getMe`);
        const d = await r.json().catch(() => ({}));
        if (!d.ok) return { error: 'توكن البوت غير صالح — تحقق منه في @BotFather.' };
        return { ok: true, botName: d.result?.username ? `@${d.result.username}` : 'bot' };
    } catch (e) {
        return { error: 'تعذّر الوصول لتيليجرام: ' + e.message };
    }
}

/** ينشر نصاً في قناة المالك المربوطة. */
export async function sendTelegramMessage(dir, user, text, deps = {}) {
    const fetchImpl = deps.fetchImpl || fetch;
    const t = readAll(dir, user).telegram;
    if (!t?.tokenEnc || !t?.chatId) return { error: 'تيليجرام غير مربوط — اربط قناتك أولاً.', notConfigured: true };
    let token;
    try { token = decryptSecret(t.tokenEnc); } catch { return { error: 'تعذّر فكّ توكن البوت.' }; }
    const body = { chat_id: t.chatId, text: String(text || '').slice(0, 4000) };
    if (!body.text.trim()) return { error: 'النص فارغ.' };
    try {
        const r = await fetchImpl(`${TG_API}/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const d = await r.json().catch(() => ({}));
        if (!d.ok) return { error: `رفض تيليجرام النشر (${d.description || r.status}) — تأكد أن البوت مشرف في القناة.` };
        return { ok: true };
    } catch (e) {
        return { error: 'تعذّر الوصول لتيليجرام: ' + e.message };
    }
}

/** نصّ المنشور الجاهز: المتن + الهاشتاقات. */
export function formatPost(post = {}) {
    const tags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : '';
    return [String(post.text || '').trim(), tags.trim()].filter(Boolean).join('\n\n');
}
