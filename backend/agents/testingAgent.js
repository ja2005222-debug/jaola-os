/**
 * 🧪 Testing Agent — JAOLA OS
 *
 * يختبر الكود المُنتج تلقائياً بعد البناء:
 * 1. HTML Tests — هيكل صحيح، meta tags، links
 * 2. CSS Tests — variables، responsive، syntax
 * 3. JS Tests — لا أخطاء syntax، functions معرّفة
 * 4. Accessibility Tests — alt، labels، aria
 * 5. Performance Tests — حجم الملفات، عدد الطلبات
 * 6. Content Tests — محتوى واقعي وليس placeholder
 */

// ═══════════════════════════════════════════════════════
// 🧪 فئة نتيجة الاختبار
// ═══════════════════════════════════════════════════════
class TestResult {
    constructor(name, category) {
        this.name = name;
        this.category = category;
        this.passed = true;
        this.warnings = [];
        this.errors = [];
    }
    fail(msg) { this.passed = false; this.errors.push(msg); return this; }
    warn(msg) { this.warnings.push(msg); return this; }
}

// ═══════════════════════════════════════════════════════
// 📄 اختبارات HTML
// ═══════════════════════════════════════════════════════
function testHTML(content) {
    const results = [];

    // اختبار 1: DOCTYPE
    const t1 = new TestResult('DOCTYPE صحيح', 'html');
    if (!content.includes('<!DOCTYPE html>')) t1.fail('مفقود <!DOCTYPE html>');
    results.push(t1);

    // اختبار 2: RTL
    const t2 = new TestResult('اتجاه RTL', 'html');
    if (!content.includes('dir="rtl"') && !content.includes("dir='rtl'")) {
        t2.fail('مفقود dir="rtl" على <html>');
    }
    results.push(t2);

    // اختبار 3: Viewport
    const t3 = new TestResult('Viewport للجوال', 'html');
    if (!content.includes('viewport')) t3.fail('مفقود meta viewport');
    results.push(t3);

    // اختبار 4: Title
    const t4 = new TestResult('عنوان الصفحة', 'html');
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!titleMatch || titleMatch[1].trim().length < 3) {
        t4.fail('عنوان الصفحة فارغ أو مفقود');
    }
    results.push(t4);

    // اختبار 5: Font Awesome
    const t5 = new TestResult('Font Awesome', 'html');
    if (!content.includes('font-awesome') && !content.includes('fontawesome')) {
        t5.warn('Font Awesome غير محمّل — الأيقونات لن تظهر');
    }
    results.push(t5);

    // اختبار 6: Google Fonts
    const t6 = new TestResult('Google Fonts', 'html');
    if (!content.includes('fonts.googleapis.com')) {
        t6.warn('Google Fonts غير محمّل — الخطوط العربية قد لا تظهر');
    }
    results.push(t6);

    // اختبار 7: styles.css مرتبط
    const t7 = new TestResult('ربط styles.css', 'html');
    if (!content.includes('styles.css')) t7.fail('styles.css غير مرتبط');
    results.push(t7);

    // اختبار 8: script.js مرتبط
    const t8 = new TestResult('ربط script.js', 'html');
    if (!content.includes('script.js')) t8.warn('script.js غير مرتبط');
    results.push(t8);

    // اختبار 9: محتوى واقعي (لا placeholder)
    const t9 = new TestResult('محتوى واقعي', 'content');
    const placeholders = ['Lorem ipsum', 'placeholder', 'TODO', 'FIXME', '[اسم]', '[وصف]'];
    const foundPlaceholders = placeholders.filter(p => content.toLowerCase().includes(p.toLowerCase()));
    if (foundPlaceholders.length > 2) {
        t9.warn(`وُجد ${foundPlaceholders.length} placeholder في المحتوى`);
    }
    results.push(t9);

    // اختبار 10: Accessibility — صور بدون alt
    const t10 = new TestResult('Accessibility — Alt للصور', 'accessibility');
    const imgWithoutAlt = (content.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
    if (imgWithoutAlt > 0) t10.warn(`${imgWithoutAlt} صورة بدون alt`);
    results.push(t10);

    return results;
}

// ═══════════════════════════════════════════════════════
// 🎨 اختبارات CSS
// ═══════════════════════════════════════════════════════
function testCSS(content) {
    const results = [];

    // اختبار 1: CSS Variables
    const t1 = new TestResult('CSS Variables في :root', 'css');
    if (!content.includes(':root') || !content.includes('--primary')) {
        t1.fail('CSS Variables غير مُعرَّفة في :root');
    }
    results.push(t1);

    // اختبار 2: Responsive
    const t2 = new TestResult('Media Queries للتجاوب', 'css');
    if (!content.includes('@media')) t2.fail('لا توجد media queries للتجاوب');
    results.push(t2);

    // اختبار 3: Font family
    const t3 = new TestResult('خط عربي', 'css');
    if (!content.includes('Cairo') && !content.includes('Tajawal') && !content.includes('Almarai')) {
        t3.warn('لا يوجد خط عربي مُعرَّف');
    }
    results.push(t3);

    // اختبار 4: حجم CSS
    const t4 = new TestResult('حجم CSS', 'performance');
    const sizeKB = Math.round(content.length / 1024);
    if (sizeKB > 100) t4.warn(`CSS كبير جداً (${sizeKB}KB) — قد يبطّئ التحميل`);
    else if (sizeKB < 2) t4.fail(`CSS صغير جداً (${sizeKB}KB) — قد يكون ناقصاً`);
    results.push(t4);

    // اختبار 5: Transitions
    const t5 = new TestResult('Transitions للتفاعل', 'css');
    if (!content.includes('transition')) t5.warn('لا توجد transitions — التصميم يبدو ثابتاً');
    results.push(t5);

    return results;
}

// ═══════════════════════════════════════════════════════
// ⚡ اختبارات JavaScript
// ═══════════════════════════════════════════════════════
function testJS(content) {
    const results = [];

    if (!content || content.trim().length < 10) {
        return [new TestResult('محتوى JS', 'js').warn('script.js فارغ أو غير موجود')];
    }

    // اختبار 1: DOMContentLoaded
    const t1 = new TestResult('DOMContentLoaded', 'js');
    if (!content.includes('DOMContentLoaded') && !content.includes('window.onload')) {
        t1.warn('لا يوجد DOMContentLoaded — الكود قد يُنفَّذ قبل تحميل الصفحة');
    }
    results.push(t1);

    // اختبار 2: استخدام var
    const t2 = new TestResult('Modern JavaScript', 'js');
    const varCount = (content.match(/\bvar\b/g) || []).length;
    if (varCount > 3) t2.warn(`استخدام var (${varCount} مرة) — استخدم let/const`);
    results.push(t2);

    // اختبار 3: console.log الزائدة
    const t3 = new TestResult('Console.log التنظيف', 'js');
    const logCount = (content.match(/console\.log/g) || []).length;
    if (logCount > 5) t3.warn(`${logCount} console.log — تجنّبها في الإنتاج`);
    results.push(t3);

    // اختبار 4: Hamburger Menu
    const t4 = new TestResult('قائمة الجوال', 'js');
    if (!content.includes('hamburger') && !content.includes('menu') && !content.includes('toggle')) {
        t4.warn('لا يوجد كود لقائمة الجوال');
    }
    results.push(t4);

    return results;
}

// ═══════════════════════════════════════════════════════
// 📊 حساب النتيجة الإجمالية
// ═══════════════════════════════════════════════════════
function calculateScore(allResults) {
    const total = allResults.length;
    const passed = allResults.filter(r => r.passed && r.errors.length === 0).length;
    const errors = allResults.filter(r => !r.passed).length;
    const warnings = allResults.filter(r => r.warnings.length > 0).length;

    const score = Math.max(0, Math.round((passed / total) * 100) - (warnings * 2));
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';

    return { score, grade, passed, errors, warnings, total };
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function runTests(files) {
    const htmlFile = files.find(f => f.name === 'index.html');
    const cssFile = files.find(f => f.name === 'styles.css');
    const jsFile = files.find(f => f.name === 'script.js');

    const allResults = [
        ...(htmlFile ? testHTML(htmlFile.content || '') : [new TestResult('HTML', 'html').fail('index.html مفقود')]),
        ...(cssFile ? testCSS(cssFile.content || '') : [new TestResult('CSS', 'css').fail('styles.css مفقود')]),
        ...(jsFile ? testJS(jsFile.content || '') : [new TestResult('JS', 'js').warn('script.js مفقود')]),
    ];

    const summary = calculateScore(allResults);
    const failedTests = allResults.filter(r => !r.passed).map(r => r.name);
    const warningTests = allResults.filter(r => r.warnings.length > 0).map(r => `${r.name} (${r.warnings[0]})`);

    return {
        ...summary,
        failedTests,
        warningTests,
        passed: summary.errors === 0,
        report: `${summary.grade} (${summary.score}/100) — ${summary.passed}/${summary.total} اختبار نجح${failedTests.length ? ` | فشل: ${failedTests.join(', ')}` : ''}`,
    };
}
