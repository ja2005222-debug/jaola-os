// 🛡️ حارس أمان: الدفع يتم بـ "HEAD:main --force"، فربط مشروع مستخدم بمستودع
// المنصّة نفسه (jaola-os) يمحو كودها بالكامل. isPlatformRepo يمنع ذلك.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlatformRepo } from '../services/githubSync.js';

test('مستودع المنصّة نفسه يُكتشف (بكل صيغ الرابط)', () => {
    for (const url of [
        'https://github.com/ja2005222-debug/jaola-os.git',
        'https://github.com/ja2005222-debug/jaola-os',
        'https://github.com/ja2005222-debug/jaola-os/',
        'git@github.com:ja2005222-debug/jaola-os.git',
    ]) {
        assert.equal(isPlatformRepo(url), true, `${url} → منصّة`);
    }
});

test('fork بنفس اسم المنصّة يُمنع أيضاً (owner مختلف)', () => {
    assert.equal(isPlatformRepo('https://github.com/someone-else/jaola-os.git'), true);
});

test('مستودع مشروع مستخدم منفصل مسموح', () => {
    for (const url of [
        'https://github.com/ja2005222-debug/jaola-delivery.git',
        'https://github.com/ja2005222-debug/my-restaurant',
        'https://github.com/otheruser/food-app.git',
    ]) {
        assert.equal(isPlatformRepo(url), false, `${url} → مسموح`);
    }
});

test('رابط فارغ/غير صالح → ليس منصّة (لا يكسر المنطق)', () => {
    assert.equal(isPlatformRepo(''), false);
    assert.equal(isPlatformRepo(null), false);
    assert.equal(isPlatformRepo('not-a-url'), false);
});

test('PLATFORM_REPO_SLUG قابل للضبط عبر البيئة', () => {
    const prev = process.env.PLATFORM_REPO_SLUG;
    process.env.PLATFORM_REPO_SLUG = 'acme/platform';
    assert.equal(isPlatformRepo('https://github.com/acme/platform.git'), true);
    assert.equal(isPlatformRepo('https://github.com/acme/other-project.git'), false);
    if (prev === undefined) delete process.env.PLATFORM_REPO_SLUG; else process.env.PLATFORM_REPO_SLUG = prev;
});
