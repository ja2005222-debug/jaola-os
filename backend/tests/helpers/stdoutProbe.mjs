// 🔇 مِجَسُّ القناة — يُشغَّل ابناً، وعقدُه أن يكتب **صفرَ بايت** على المخرَج القياسيّ.
//
// مُشغّلُ اختبارات Node يُسلسل نتائجَ كل ملفِ اختبارٍ (V8-serialized) ويرسلها
// من الابن إلى الأب على المخرَج القياسيّ نفسه. فأيُّ كتابةٍ أخرى هناك أثناء
// التشغيل تُقحِم بايتاتٍ وسط الدفق فيسقط فكُّ التسلسل:
//   ERR_TEST_FAILURE: Unable to deserialize cloned data …
// وهو ما وقع في #486 (بيانُ PluginOrchestrator) وكاد يتكرّر مع لافتة dotenv@17.
//
// يستنبط قائمةَ الوحدات من الاختبارات نفسها لا من قائمةٍ مكتوبة بيدٍ، كي
// تشمل الحراسةُ كلَّ وحدةٍ تُضاف غداً دون أن يتذكّرها أحد.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESTS = path.resolve(HERE, '..');
const BACKEND = path.resolve(TESTS, '..');

// `from '../x.js'` و`import('../x.js')` معاً. والمسحُ يدلّ ولا يحكم: النمطُ
// يلتقط أيضاً ما يقع داخل نصٍّ حرفيّ في تجهيزةِ اختبار (مثل `models/Order.js`
// في dependencyAgent) — فيُصفّى بوجودِ الملف على القرص، لا بالثقة بالنمط.
export function testImports() {
    const found = new Set();
    for (const f of fs.readdirSync(TESTS)) {
        if (!f.endsWith('.test.mjs')) continue;
        const src = fs.readFileSync(path.join(TESTS, f), 'utf8');
        for (const m of src.matchAll(/(?:from|import\s*\()\s*'\.\.\/([A-Za-z0-9_/.-]+\.js)'/g)) {
            if (fs.existsSync(path.join(BACKEND, m[1]))) found.add(m[1]);
        }
    }
    return [...found].sort();
}

// يُشغَّل ابناً مباشرةً: يستورد كلَّ الوحدات، ثم يسلك مسارَ التشغيل الذي طبع
// في #486 (`orchestrator.init()` — يستدعيه siteChecker وadminAgentGrounding).
// تقريرُ التغطية يذهب إلى **مَخرَج الأخطاء** عمداً: القناةُ المحروسة تبقى صامتة.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const mods = testImports();
    // العدُّ عند الاستيراد الفعليّ لا عند النيّة: لو أُبلغ عن طول القائمة
    // لصار تقريرُ التغطية دعوى نيّةٍ لا قياسَ إنجاز، وهو عينُ العطب المحروس.
    let imported = 0;
    for (const m of mods) { await import(path.join(BACKEND, m)); imported += 1; }
    const { orchestrator } = await import(path.join(BACKEND, 'core/PluginOrchestrator.js'));
    await orchestrator.init();
    process.stderr.write(JSON.stringify({ count: imported }));
}
