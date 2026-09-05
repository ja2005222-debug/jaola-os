// 🌐 حارسُ الاحتياطات اللغويّة (JCR/21): `getUserLanguage` لا تعود فارغةً أبداً (جلسة ← ملفٌّ دائم ← 'en')،
// فكلُّ `getUserLanguage(...) || 'xx'` احتياطٌ ميّت — أربعةُ اكتشافاتٍ متتالية (JCR/متابعة-أ، JCR/14، JCR/15، JCR/18) قالت ذلك
// بطفراتٍ نجت. هنا يُثبَّت الأمران: الدالّةُ لا تعود فارغةً في كلِّ حال، ولا احتياطَ ميّتاً بعدها في الشجرة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { getUserLanguage, setUserLanguage, clearUserLanguage } from '../agents/languageDetector.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname; const ROOT = path.join(HERE, '..');
const user = (t) => `__langfb_${t}_${process.pid}__`;

test('getUserLanguage لا تعود فارغةً: مجهولٌ → en، بعد المسح → en، غيرُ نصٍّ → en، ولغةٌ مضبوطة تعود كما هي', () => {
    for (const u of [user('unknown'), '', null, undefined, 42]) assert.equal(getUserLanguage(u), 'en', String(u));
    const u = user('set'); setUserLanguage(u, 'ar'); assert.equal(getUserLanguage(u), 'ar');
    clearUserLanguage(u); assert.equal(getUserLanguage(u), 'en', 'المسحُ لا يُنتج فراغاً');
    setUserLanguage(u, 'fr'); assert.equal(getUserLanguage(u), 'fr', 'لغةٌ ثالثة تبقى كما ضُبطت'); clearUserLanguage(u);
});

test('لا احتياطَ ميّتاً بعد getUserLanguage في الشجرة (agents/core/services/server.js)', () => {
    const files = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
    for (const d of ['agents', 'core', 'services']) walk(path.join(ROOT, d)); files.push(path.join(ROOT, 'server.js'));
    const hits = [];
    for (const f of files) {
        const src = fs.readFileSync(f, 'utf8');
        for (const m of src.matchAll(/getUserLanguage\([^()]*\)\s*\|\|\s*['"]/g)) hits.push(`${path.relative(ROOT, f)}:${src.slice(0, m.index).split('\n').length}`);
    }
    assert.deepEqual(hits, [], 'احتياطٌ ميّت عاد: ' + hits.join(', '));
});
