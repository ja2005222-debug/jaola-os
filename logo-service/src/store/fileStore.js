/**
 * 📁 fileStore.js — تخزين بملفات JSON (نفس فلسفة مخزن خدمة الفيديو)
 *
 * العقد صغير عمداً — ثلاث عائلات فقط:
 *   جولات المسودات  → عدّ السقوف (عام/IP/مستخدم) + جلب الجولة للنهائي.
 *   النسخ النهائية  → عدّ السقف الشهري + "شعاراتي".
 *   الأعلام         → منع تكرار تنبيه التكلفة اليومي.
 *
 * الواجهة async رغم تزامن العمليات — ليُستبدل بمخزن Postgres لاحقاً
 * بلا مسّ بالمنطق (نفس درس store/index.js في خدمة الفيديو).
 * **لا يصلح للإنتاج** على قرص Render المؤقت — للإنتاج DATABASE_URL
 * ومخزن Postgres (مرحلة لاحقة موثقة في README).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_DRAFT_ROUNDS = 5000;  // ~أسبوعان بأقصى سقف يومي — كافٍ للعدّ والتشخيص
const MAX_FINALS = 5000;

function newId() { return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`; }

function readJson(file, fallback) {
    try {
        const v = JSON.parse(fs.readFileSync(file, 'utf8'));
        return v && typeof v === 'object' ? v : fallback;
    } catch { return fallback; }
}

function writeJson(dir, file, value) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
}

export function createFileStore({ dataDir }) {
    if (!dataDir) throw new Error('dataDir مطلوب لمخزن الملفات.');
    const draftsFile = path.join(dataDir, 'draftRounds.json');
    const finalsFile = path.join(dataDir, 'finals.json');
    const flagsFile = path.join(dataDir, 'flags.json');

    const readDrafts = () => { const v = readJson(draftsFile, []); return Array.isArray(v) ? v : []; };
    const readFinals = () => { const v = readJson(finalsFile, []); return Array.isArray(v) ? v : []; };

    function writeDrafts(rounds) {
        writeJson(dataDir, draftsFile,
            rounds.length > MAX_DRAFT_ROUNDS ? rounds.slice(-MAX_DRAFT_ROUNDS) : rounds);
    }
    function writeFinals(finals) {
        writeJson(dataDir, finalsFile,
            finals.length > MAX_FINALS ? finals.slice(-MAX_FINALS) : finals);
    }

    return {
        // نفس عقد postgresStore — لا تهيئة ولا إغلاق لملفات JSON
        async init() {},
        async close() {},

        // ─── جولات المسودات ─────────────────────────────────────────
        async recordDraftRound({ ipHash, username = null, prompt, params, images }) {
            const rounds = readDrafts();
            const round = { id: newId(), at: Date.now(), ipHash, username, prompt, params, images };
            rounds.push(round);
            writeDrafts(rounds);
            return round;
        },
        async getDraftRound(id) {
            return readDrafts().find(r => r.id === id) || null;
        },
        async countDraftRoundsSince(since) {
            return readDrafts().filter(r => r.at >= since).length;
        },
        async countDraftRoundsSinceForIp(ipHash, since) {
            return readDrafts().filter(r => r.at >= since && r.ipHash === ipHash).length;
        },
        async countDraftRoundsSinceForUser(username, since) {
            return readDrafts().filter(r => r.at >= since && r.username === username).length;
        },

        // ─── النسخ النهائية ─────────────────────────────────────────
        async recordFinal({ username, roundId, prompt, params, imageUrl }) {
            const finals = readFinals();
            const final = { id: newId(), at: Date.now(), username, roundId, prompt, params, imageUrl };
            finals.push(final);
            writeFinals(finals);
            return final;
        },
        async countFinalsSinceForUser(username, since) {
            return readFinals().filter(f => f.at >= since && f.username === username).length;
        },
        async listFinalsByUser(username) {
            return readFinals().filter(f => f.username === username).sort((a, b) => b.at - a.at);
        },

        // ─── الأعلام ────────────────────────────────────────────────
        async getFlag(key) {
            return readJson(flagsFile, {})[key] ?? null;
        },
        async setFlag(key, value) {
            const flags = readJson(flagsFile, {});
            flags[key] = value;
            writeJson(dataDir, flagsFile, flags);
        },
    };
}
