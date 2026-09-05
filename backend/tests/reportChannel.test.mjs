// 🚰 حارسُ قناة التقرير — Sprint 4c
//
// العطبُ الذي يحرسه: ملفُّ اختبارٍ يستورد وحدةً تطبع نصّاً غيرَ لاتينيّ أثناء
// التشغيل، فتختلط طباعتُها بقناة تقرير `node --test` على stdout، فيقرأ الأبُ
// طولَ رسالةٍ سالباً (إزاحةٌ ذاتُ إشارة) ويُمرّر النصَّ إلى مُفكِّك التسلسل،
// فيسقط الملفُّ كلُّه — لا اختبارٌ واحد. التفصيلُ في helpers/reportChannel.mjs.
//
// الحارسُ مُشتقٌّ لا مكتوب: يقرأ الوحداتِ الطابعةَ من القرص، والاستيراداتِ من
// كلِّ ملفِّ اختبار. فإن أُضيفت وحدةٌ طابعةٌ أو اختبارٌ جديد، وقع الحارسُ من
// نفسه دون أن يُحدِّثه أحد.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCANNED = ['services', 'agents', 'utils', 'models', 'routes', 'middleware', 'plugin-templates', 'config'];
const NON_ASCII = /[^\x00-\x7F]/;

// وسائلُ إخلاء القناة المعروفة — القاعدةُ على الأثر لا على اسمٍ بعينه
const CLEARS_CHANNEL = /divertConsoleToStderr|quietConsole/;

function printingModules() {
    const found = new Map();
    for (const dir of SCANNED) {
        const abs = path.join(root, dir);
        if (!fs.existsSync(abs)) continue;
        for (const file of fs.readdirSync(abs)) {
            if (!/\.(mjs|js)$/.test(file)) continue;
            const src = fs.readFileSync(path.join(abs, file), 'utf8');
            const loud = (src.match(/console\.(log|warn|error|info|debug)\([^\n]*/g) || [])
                .filter((line) => NON_ASCII.test(line));
            if (loud.length) found.set(`${dir}/${file}`, loud.length);
        }
    }
    return found;
}

test('الاشتقاقُ نفسُه ليس فارغاً — حارسٌ لا يجد شيئاً يمرُّ فراغاً', () => {
    const printers = printingModules();
    assert.ok(printers.size >= 15,
        `وُجدت ${printers.size} وحدةً طابعةً فقط؛ الاشتقاقُ معطوبٌ لا المستودعُ نظيف`);
});

test('كلُّ اختبارٍ يستورد وحدةً طابعةً يُخلي قناةَ التقرير', () => {
    const printers = printingModules();
    const testsDir = path.join(root, 'tests');
    const exposed = [];

    for (const file of fs.readdirSync(testsDir)) {
        if (!/\.test\.mjs$/.test(file)) continue;
        const src = fs.readFileSync(path.join(testsDir, file), 'utf8');
        if (CLEARS_CHANNEL.test(src)) continue;
        const loud = [...src.matchAll(/from\s+'\.\.\/([^']+)'/g)]
            .map((m) => m[1])
            .filter((spec) => printers.has(spec));
        if (loud.length) exposed.push(`${file} ← ${loud.join(', ')}`);
    }

    assert.deepStrictEqual(exposed, [],
        `ملفّاتٌ تستورد وحدةً طابعةً بلا إخلاء القناة:\n  ${exposed.join('\n  ')}`);
});

test('الوسيلةُ تفعل ما تدّعيه: console.log يذهب إلى stderr لا stdout', async () => {
    const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');
    const realLog = console.log;
    const realOut = process.stdout.write.bind(process.stdout);
    const realErr = process.stderr.write.bind(process.stderr);
    const toStdout = [];
    const toStderr = [];

    process.stdout.write = (chunk) => { toStdout.push(String(chunk)); return true; };
    process.stderr.write = (chunk) => { toStderr.push(String(chunk)); return true; };
    try {
        divertConsoleToStderr();
        console.log('🗄️ سطرٌ عربيٌّ بإيموجي');
    } finally {
        process.stdout.write = realOut;
        process.stderr.write = realErr;
        console.log = realLog;
    }

    assert.deepStrictEqual(toStdout, [], 'تسرّب سطرٌ إلى stdout — قناةُ التقرير ملوّثة');
    assert.strictEqual(toStderr.length, 1, 'لم يصل السطرُ إلى stderr');
    assert.match(toStderr[0], /سطرٌ عربيٌّ/);
});
