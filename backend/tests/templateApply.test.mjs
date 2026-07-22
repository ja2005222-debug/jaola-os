// 🧩 «ابدأ من قالب»: نواة التطبيق الحتميّة (getCloneById → كتابة الملفات +
// الهوية البصرية) تُنتج مشروعاً عاملاً ومُعلَّماً — تعكس منطق /api/template/apply.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getCloneById, listClones } from '../agents/cloneTemplates/index.js';
import { assetsFor, injectFaviconTag } from '../agents/cloneAssets.js';
import { detectUndefinedFunctions } from '../agents/behaviorVerifier.js';

// يحاكي ما تفعله نقطة النهاية على القرص (بلا خادم).
function applyClone(cloneId) {
    const clone = getCloneById(cloneId);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jtpl-'));
    for (const f of clone.files) fs.writeFileSync(path.join(dir, f.name), f.content);
    const assets = assetsFor(clone.name || clone.id);
    fs.writeFileSync(path.join(dir, 'brand.svg'), assets.favicon);
    const idx = path.join(dir, 'index.html');
    fs.writeFileSync(idx, injectFaviconTag(fs.readFileSync(idx, 'utf8'), 'brand.svg'));
    return { clone, dir };
}

test('apply: قالب غير معروف → null', () => {
    assert.equal(getCloneById('nope'), null);
});

test('apply: كل قالب معروض قابل للتطبيق ويُنتج مشروعاً عاملاً ومُعلَّماً', () => {
    for (const meta of listClones()) {
        const { clone, dir } = applyClone(meta.id);
        // الملفات كُتبت
        for (const f of clone.files) assert.ok(fs.existsSync(path.join(dir, f.name)), `${meta.id}: ${f.name} مكتوب`);
        // الهوية البصرية
        assert.ok(fs.existsSync(path.join(dir, 'brand.svg')), `${meta.id}: brand.svg موجود`);
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        assert.ok(/rel=["']icon["']/.test(html), `${meta.id}: أيقونة محقونة`);
        // لا دوال معلّقة (التطبيق ما زال عاملاً)
        const app = clone.files.find(f => f.name === 'app.js');
        if (app) assert.deepEqual(detectUndefinedFunctions({ html, js: app.content }), [], `${meta.id}: بلا دوال معلّقة`);
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
