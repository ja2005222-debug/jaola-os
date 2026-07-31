import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCoderSystemPrompt } from '../agents/coderAgent.js';

test('المشاريع العادية: تصميم مخصّص بلا إطار (لا Tailwind)', () => {
    const prompt = buildCoderSystemPrompt('ar', false);
    assert.match(prompt, /لا تستخدم Bootstrap/);
    assert.doesNotMatch(prompt, /cdn\.tailwindcss\.com/);
});

test('مشروع كبير (libraryAware): يوصي بـ Tailwind Play CDN بعلامة data-jlib', () => {
    const prompt = buildCoderSystemPrompt('ar', true);
    assert.match(prompt, /cdn\.tailwindcss\.com/);
    assert.match(prompt, /data-jlib="tailwind"/);
    assert.doesNotMatch(prompt, /لا تستخدم Bootstrap/);
});

test('لغة المشروع (dir/lang) تبقى صحيحة بغضّ النظر عن libraryAware', () => {
    const prompt = buildCoderSystemPrompt('en', true);
    assert.match(prompt, /dir="ltr" lang="en"/);
});
