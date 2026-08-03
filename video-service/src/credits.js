/**
 * 💳 credits.js — نظام الأرصدة مسبقة الدفع (قلب النموذج التجاري)
 *
 * القاعدة الذهبية: كل تكلفة توليد متغيرة تُخصم من رصيد اشتراه/مُنحه
 * المستخدم مسبقاً — الخدمة لا تتحمل تكلفة مفتوحة أبداً.
 *
 * نفس فلسفة ملفات backend/services (JSON بسيط، بلا Mongo، فشل صامت
 * للقراءة، سجل تدقيق append-only): balances.json + creditLedger.json.
 * كل حركة (منح/خصم/استرداد/ترحيبي) تُسجَّل — لا تعديل رصيد بلا أثر.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_LEDGER_RECORDS = 2000;
// رصيد ترحيبي يُمنح مرة واحدة عند أول تعامل — يطابق الباقة المجانية
// (3 فيديوهات تجريبية) في الخطة التجارية.
export const STARTER_CREDITS = 3;

function balancesFile(dir) { return path.join(dir, 'balances.json'); }
function ledgerFile(dir) { return path.join(dir, 'creditLedger.json'); }
function newId() { return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`; }

function readJson(file, fallback) {
    try {
        const v = JSON.parse(fs.readFileSync(file, 'utf8'));
        return v && typeof v === 'object' ? v : fallback;
    } catch { return fallback; }
}

function readBalances(dir) { return readJson(balancesFile(dir), {}); }
function writeBalances(dir, balances) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(balancesFile(dir), JSON.stringify(balances));
}

function readLedger(dir) {
    const v = readJson(ledgerFile(dir), []);
    return Array.isArray(v) ? v : [];
}
function appendLedger(dir, entry) {
    fs.mkdirSync(dir, { recursive: true });
    const records = readLedger(dir);
    records.push({ id: newId(), at: Date.now(), ...entry });
    const trimmed = records.length > MAX_LEDGER_RECORDS
        ? records.slice(records.length - MAX_LEDGER_RECORDS)
        : records;
    fs.writeFileSync(ledgerFile(dir), JSON.stringify(trimmed));
}

function normalizeUser(username) {
    return String(username || '').trim().toLowerCase();
}

/**
 * يضمن وجود سجل رصيد للمستخدم — أول تعامل يمنح الرصيد الترحيبي مرة
 * واحدة فقط (starterGranted يمنع تكراره حتى لو صُفّر الرصيد لاحقاً).
 */
export function ensureAccount(dir, username) {
    const user = normalizeUser(username);
    if (!user) return null;
    const balances = readBalances(dir);
    if (!balances[user]) {
        balances[user] = { credits: STARTER_CREDITS, starterGranted: true };
        writeBalances(dir, balances);
        appendLedger(dir, { kind: 'starter', username: user, amount: STARTER_CREDITS });
    }
    return balances[user];
}

export function getBalance(dir, username) {
    const user = normalizeUser(username);
    const account = ensureAccount(dir, user);
    return account ? account.credits : 0;
}

/** منح إداري — يتطلب اسم المانح للتدقيق (من فعل ماذا). */
export function grantCredits(dir, { username, amount, grantedBy, note = null }) {
    const user = normalizeUser(username);
    const value = Number(amount);
    if (!user || !Number.isInteger(value) || value <= 0 || value > 100000) return false;
    ensureAccount(dir, user);
    const balances = readBalances(dir);
    balances[user].credits += value;
    writeBalances(dir, balances);
    appendLedger(dir, { kind: 'grant', username: user, amount: value, grantedBy: String(grantedBy || ''), note });
    return true;
}

/**
 * خصم قبل إرسال أي مهمة — يرفض (false) عند رصيد غير كافٍ.
 * لا رصيد سالب أبداً؛ jobId إلزامي لربط كل خصم بمهمة قابلة للتدقيق.
 */
export function deductCredits(dir, { username, amount, jobId }) {
    const user = normalizeUser(username);
    const value = Number(amount);
    if (!user || !jobId || !Number.isInteger(value) || value <= 0) return false;
    ensureAccount(dir, user);
    const balances = readBalances(dir);
    if (balances[user].credits < value) return false;
    balances[user].credits -= value;
    writeBalances(dir, balances);
    appendLedger(dir, { kind: 'deduct', username: user, amount: value, jobId });
    return true;
}

/**
 * استرداد عند فشل المهمة — فشل المزود لا يجوز أن يكلف المستخدم رصيداً.
 * معصوم من الازدواج (idempotent) لكل مهمة: وجود استرداد سابق بنفس
 * jobId في السجل يمنع أي استرداد ثانٍ — حتى لو انهارت العملية بين
 * الاسترداد وتحديث حالة المهمة وأعاد المحرك إفشالها في دورة لاحقة.
 */
export function refundCredits(dir, { username, amount, jobId, reason = null }) {
    const user = normalizeUser(username);
    const value = Number(amount);
    if (!user || !jobId || !Number.isInteger(value) || value <= 0) return false;
    if (readLedger(dir).some(r => r.kind === 'refund' && r.jobId === jobId)) return false;
    ensureAccount(dir, user);
    const balances = readBalances(dir);
    balances[user].credits += value;
    writeBalances(dir, balances);
    appendLedger(dir, { kind: 'refund', username: user, amount: value, jobId, reason });
    return true;
}

/** سجل حركات مستخدم واحد (الأحدث أولاً) — لواجهة "رصيدي". */
export function getUserLedger(dir, username, limit = 50) {
    const user = normalizeUser(username);
    return readLedger(dir)
        .filter(r => r.username === user)
        .slice(-limit)
        .reverse();
}
