/**
 * 📒 tradingBotLedger.js — سجل تدقيق كامل لبوت PancakeSwap (append-only)،
 * بنفس نمط ملفات signalTrackRecord.js (JSON بسيط، بلا Mongo، فشل صامت للقراءة).
 *
 * trades.json: سجل واحد لكل فرصة اعتُبرت (حتى المتجاهَلة — recordConsideration)
 * ولكل محاولة تنفيذ فعلية (recordTradeOpen/updateTradeOutcome). كل فرع تجاهل
 * (قاطع أمان، تبريد، غاز غير كافٍ...) يُسجَّل — لا صمت أبداً.
 * positions.json: المراكز المفتوحة الحالية {coinId: {...}}.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_RECORDS = 1000;

function tradesFile(dir) { return path.join(dir, 'trades.json'); }
function positionsFile(dir) { return path.join(dir, 'positions.json'); }
function newId() { return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`; }
function strOrNull(v) { return v == null ? null : String(v); }

function readTrades(dir) {
    try {
        const v = JSON.parse(fs.readFileSync(tradesFile(dir), 'utf8'));
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}
function writeTrades(dir, records) {
    fs.mkdirSync(dir, { recursive: true });
    const trimmed = records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records;
    fs.writeFileSync(tradesFile(dir), JSON.stringify(trimmed));
}

/** يسجّل فرصة اعتُبرت — سواء نُفّذت أم تجوهلت (decision: 'executed'|'skipped'، skipReason عند التجاهل). */
export function recordConsideration(dir, { coinId, signal, reasonCode = null, strength = null, decision, skipReason = null }) {
    const records = readTrades(dir);
    records.push({
        id: newId(), at: Date.now(), kind: 'consideration',
        coinId, signal, reasonCode, strength, decision, skipReason,
    });
    writeTrades(dir, records);
}

/** يسجّل بدء محاولة تنفيذ فعلية (قبل إرسال المعاملة) — status='pending'. يُرجع معرّف الصفقة. */
export function recordTradeOpen(dir, { coinId, side, signal, reasonCode = null, amountBnbWei, expectedOut = null, minOut = null }) {
    const records = readTrades(dir);
    const id = newId();
    records.push({
        id, at: Date.now(), kind: 'trade',
        coinId, side, signal, reasonCode,
        amountBnbWei: strOrNull(amountBnbWei), expectedOut: strOrNull(expectedOut), minOut: strOrNull(minOut),
        status: 'pending', txHash: null, gasCostBnb: null, realizedPnlBnb: null, error: null, updatedAt: Date.now(),
    });
    writeTrades(dir, records);
    return id;
}

/** يحدّث نتيجة صفقة (confirmed|failed|reverted|unconfirmed) بعد محاولة التنفيذ/التأكيد. */
export function updateTradeOutcome(dir, tradeId, { status, txHash = null, gasCostBnb = null, realizedPnlBnb = null, error = null } = {}) {
    const records = readTrades(dir);
    const rec = records.find(r => r.id === tradeId && r.kind === 'trade');
    if (!rec) return false;
    rec.status = status;
    if (txHash != null) rec.txHash = txHash;
    if (gasCostBnb != null) rec.gasCostBnb = String(gasCostBnb);
    if (realizedPnlBnb != null) rec.realizedPnlBnb = String(realizedPnlBnb);
    rec.error = error;
    rec.updatedAt = Date.now();
    writeTrades(dir, records);
    return true;
}

/** أحدث السجلات أولاً — للوحة التدقيق في الواجهة. */
export function listTrades(dir, { limit = 100 } = {}) {
    return readTrades(dir).slice(-limit).reverse();
}

/** كل السجلات كما هي (بلا حدّ/عكس ترتيب) — للتجميع الإحصائي (قاطع الأمان اليومي). */
export function readAllTrades(dir) {
    return readTrades(dir);
}

/** صفقات pending/unconfirmed من دورة تنفيذ سابقة (تعطّل/إعادة نشر منتصف التنفيذ) — تُحسم قبل أي فرصة جديدة. */
export function findStalePending(dir) {
    return readTrades(dir).filter(r => r.kind === 'trade' && (r.status === 'pending' || r.status === 'unconfirmed'));
}

function readPositionsFile(dir) {
    try {
        const v = JSON.parse(fs.readFileSync(positionsFile(dir), 'utf8'));
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch { return {}; }
}
function writePositionsFile(dir, positions) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(positionsFile(dir), JSON.stringify(positions, null, 2));
}

/** كل المراكز المفتوحة حالياً {coinId: {...}}. */
export function readPositions(dir) { return readPositionsFile(dir); }

/** يفتح/يحدّث مركزاً لعملة. */
export function writePosition(dir, coinId, pos) {
    const positions = readPositionsFile(dir);
    positions[coinId] = pos;
    writePositionsFile(dir, positions);
}

/** يغلق مركزاً (بعد بيع مؤكَّد). */
export function clearPosition(dir, coinId) {
    const positions = readPositionsFile(dir);
    delete positions[coinId];
    writePositionsFile(dir, positions);
}

/** للاختبارات فقط. */
export function resetTradingLedgerForTest(dir) {
    try { fs.rmSync(tradesFile(dir), { force: true }); } catch { /* لا شيء */ }
    try { fs.rmSync(positionsFile(dir), { force: true }); } catch { /* لا شيء */ }
}
