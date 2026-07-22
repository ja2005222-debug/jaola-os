// 🎨 تجويد البصمة: التخصيص الموضعي (patch) للكلون يغيّر المحتوى/العلامة فقط
// دون فقد أي دالة أو كسر أي تفاعل — الضمان الذي يعتمده مسار _buildFromClone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEditBlocks, applyEdits } from '../agents/patchEditor.js';
import { extractDefinedFunctions, detectUndefinedFunctions } from '../agents/behaviorVerifier.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

// يحاكي مخرجات LLM للبصمة الموضعية: يغيّر اسم العلامة + لون --accent فقط.
function stampBlocks(html, app, css) {
    // اسم العلامة في index.html (نأخذ سطر brandName الفعلي كي يطابق حرفياً)
    const brandLine = (html.split('\n').find(l => l.includes('brandName')) || '').trim();
    const newBrandLine = brandLine.replace(/>[^<]*<\/span>/, '>متجر البصمة</span>');
    // أول متغيّر لون في styles.css
    const accentLine = (css.split('\n').find(l => /--accent\s*:/.test(l)) || '').trim();
    const newAccentLine = accentLine.replace(/--accent\s*:\s*#[0-9a-fA-F]{3,8}/, '--accent:#ff3366');
    let out = '';
    if (brandLine && newBrandLine !== brandLine)
        out += `index.html\n<<<<<<< SEARCH\n${brandLine}\n=======\n${newBrandLine}\n>>>>>>> REPLACE\n\n`;
    if (accentLine && newAccentLine !== accentLine)
        out += `styles.css\n<<<<<<< SEARCH\n${accentLine}\n=======\n${newAccentLine}\n>>>>>>> REPLACE\n`;
    return out;
}

test('بصمة موضعية: تغيّر العلامة/اللون بلا فقد أي دالة', () => {
    const c = jaolaStore();
    const html = c.files.find(f => f.name === 'index.html').content;
    const app = c.files.find(f => f.name === 'app.js').content;
    const css = c.files.find(f => f.name === 'styles.css').content;

    const fnsBefore = new Set(extractDefinedFunctions(app));
    assert.ok(fnsBefore.size > 3, 'الكلون فيه دوال حقيقية');

    const blocks = parseEditBlocks(stampBlocks(html, app, css));
    assert.ok(blocks.length >= 1, 'تُحلَّل كتل SEARCH/REPLACE');

    const { files, applied } = applyEdits(
        [{ name: 'index.html', content: html }, { name: 'app.js', content: app }, { name: 'styles.css', content: css }],
        blocks);
    assert.ok(applied >= 1, 'طُبّق تغيير موضعي واحد على الأقل');

    // app.js لم يُلمَس أصلاً (البصمة محتوى/علامة فقط) → لا دالة تُفقد
    const appAfter = (files.find(f => f.name === 'app.js') || { content: app }).content;
    const fnsAfter = new Set(extractDefinedFunctions(appAfter));
    const lost = [...fnsBefore].filter(n => !fnsAfter.has(n));
    assert.deepEqual(lost, [], 'حارس الارتداد: لا دالة مفقودة');

    // التغيير فعلاً وقع على المحتوى الظاهر
    const htmlAfter = files.find(f => f.name === 'index.html').content;
    const cssAfter = files.find(f => f.name === 'styles.css').content;
    assert.ok(htmlAfter.includes('متجر البصمة'), 'اسم العلامة تغيّر');
    assert.ok(cssAfter.includes('#ff3366'), 'لون --accent تغيّر');

    // ما زال بلا دوال معلّقة (لم ينكسر أي تفاعل)
    assert.deepEqual(detectUndefinedFunctions({ html: htmlAfter, js: appAfter }), [], 'بلا دوال معلّقة بعد البصمة');
});

test('بصمة موضعية: ما لا يُذكر لا يُلمس (index/app يبقيان إن لم يُطابقا)', () => {
    const files = [{ name: 'app.js', content: 'function keep(){ return 1; }' }];
    // كتلة لا تطابق شيئاً
    const blocks = parseEditBlocks('app.js\n<<<<<<< SEARCH\nلا يوجد هذا النص\n=======\nبديل\n>>>>>>> REPLACE');
    const { files: out, applied, failed } = applyEdits(files, blocks);
    assert.equal(applied, 0, 'لا تطبيق عند عدم التطابق');
    assert.ok(failed.length >= 1, 'يُبلَّغ عن الكتلة غير المطابَقة');
    // لا تُعاد إلا الملفات المتغيّرة → قائمة فارغة تعني أن الأصل لم يُلمس (لا إعادة كتابة)
    assert.deepEqual(out, [], 'ما لا يُطابَق لا يُنتج ملفاً مُعاد كتابته');
});
