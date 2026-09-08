// 🔁 «الإعادةُ تلفّ سلسلةَ المزوّدين وحدَها» — قياسٌ مكتوبٌ لما لم يُصلَح بعد، لا دعوى إصلاح.
//
// #171 جعلت «نعيد المحاولة» وعداً يُوفى: `createWithFailover` يجرّب السلسلةَ كاملةً ثمّ يُعيد
// `AI_MAX_RETRIES` مرّاتٍ بتراجعٍ تصاعديّ على **العابر وحدَه**. وهذا الملفُّ يُثبّت أين يصل
// ذلك الوعدُ وأين لا يصل — كي يكون التوسيعُ قراراً بدليله، لا انزلاقاً ولا نسياناً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AI_MAX_RETRIES, retryDelayMs } from '../core/providers/llm.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODER = fs.readFileSync(path.join(HERE, '../agents/coderAgent.js'), 'utf8');
const LLM = fs.readFileSync(path.join(HERE, '../core/providers/llm.js'), 'utf8');

test('الإعادةُ موجودةٌ ومحدودة، وتراجُعُها تصاعديّ — والمستخدمُ ينتظر أمام شاشة', () => {
    assert.ok(AI_MAX_RETRIES >= 1 && AI_MAX_RETRIES <= 3, `الحدُّ ${AI_MAX_RETRIES}`);
    const waits = [0, 1, 2].map(retryDelayMs);
    assert.ok(waits[1] > waits[0] && waits[2] > waits[1], 'تصاعديّ');
    assert.ok(waits.slice(0, AI_MAX_RETRIES).reduce((a, b) => a + b, 0) <= 5000, `المجموعُ محسوب: ${waits}`);
});

test('📏 الإعادةُ تلفّ `attemptChain` وحدَها — وهو موضعُها الوحيد', () => {
    assert.equal((LLM.match(/await attemptChain\(/g) || []).length, 1, 'نداءٌ واحدٌ داخل حلقة الإعادة');
    assert.match(LLM, /if \(err\?\.aiUnavailable \|\| attempt >= AI_MAX_RETRIES\) throw err;/,
        'ولا إعادةَ على الدائم — «تُحرق على بابٍ مغلق» أُغلقت في #588');
});

test('📏 **مقيسٌ لم يُصلَح**: مولّدُ الشفرة يبني سلسلتَه بنفسِه، وأوّلُ خطوةٍ فيها هي السلسلةُ كلُّها', () => {
    // `callGroq` ينادي `groq` — وهو **غلافُ `createWithFailover`** لا عميلَ Groq الخام. أي أنّ
    // الخطوةَ الأولى تجرّب Groq ثمّ DeepSeek ثمّ Gemini ثمّ OpenAI، **وتُعيد** على العابر.
    // ثمّ تعود حلقةُ المولّد فتجرّب DeepSeek وGemini **خامَّين**: مزوّدان استُنفدا سلفاً، وبلا إعادة.
    assert.match(CODER, /const stream = await groq\.chat\.completions\.create\(/, 'callGroq عبر الغلاف');
    assert.match(CODER, /await deepseek\.chat\.completions\.create\(/, 'callDeepSeek على العميل الخام');
    assert.match(CODER, /await ai\.models\.generateContent\(/, 'callGemini على العميل الخام');
    // وحلقتان في هذا الملفّ تبنيان الترتيبَ نفسَه بأيديهما
    assert.equal((CODER.match(/callGroq\(userMessage, onChunk, systemPrompt\)/g) || []).length, 2,
        'حلقتان: البناءُ الكامل والتعديل');
    // ⚠️ لا يُدَّعى هنا إصلاح: هذا **قياسٌ مثبَّت**. إعادةُ بناء سلسلة المولّد تمسّ المسارَ الذي
    //    يكتب موقعَ المستخدم، فتُفصل ببندها ودليلها — «تدريجيٌّ ومُتحقَّقٌ دوماً».
});

test('📏 وفي جانب الحماية: كلُّ خطوةٍ في سلسلة المولّد تمرّ بمرشِّح `AI_PROVIDERS`', () => {
    assert.match(CODER, /export function selectModels\(pipeline\) \{\s*return pipeline\.filter\(\(m\) => isProviderEnabled\(m\.provider\)\);/,
        'المرشِّحُ قائمٌ — وهو ما يمنع مزوّداً مستبعَداً من العمل عبر النداء الخام');
});
