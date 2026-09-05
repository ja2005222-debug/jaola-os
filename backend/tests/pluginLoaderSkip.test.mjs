// 🧩 قاعدةُ التخطّي في محمِّل الإضافات — Sprint 4e
//
// كان تعليقُ المحمِّل يقول «نتخطى الملفات المخفية والقوالب»، وآليّتُه بادئةُ
// `.` أو `_` فقط. والقالبُ الوحيدُ في المستودع لا يحمل بادئة: نجاتُه سببُها
// أنّه في `plugin-templates/` وهو مجلَّدٌ لا يُمسح، لا أنّ الشرطَ يمسكه.
// فمَن وثق بالتعليق وسمّى قالباً بلا بادئةٍ داخل `plugins/` حمّله.
//
// هذا الاختبارُ يثبّت القاعدةَ **كما تعمل**، لا كما كانت توصَف.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPluginsFrom } from '../core/PluginLoader.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(root, 'plugin-templates/AgentPluginTemplate.js');
const dirs = [];

function tmpPluginDir(files) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-'));
    dirs.push(d);
    const body = fs.readFileSync(TEMPLATE, 'utf8');
    for (const name of files) fs.writeFileSync(path.join(d, name), body);
    return d;
}

test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

test('البادئةُ `_` تُتخطّى، وغيابُها يُحمّل — ولو كان الملفُّ قالباً حرفيّاً', async () => {
    const dir = tmpPluginDir(['AgentPluginTemplate.js', '_AgentPluginTemplate.js']);
    const { loaded, errors } = await loadPluginsFrom(dir);

    assert.deepStrictEqual(errors, [], 'لم يُتوقَّع خطأٌ في التحميل');
    assert.strictEqual(loaded.length, 1, 'يُحمَّل واحدٌ فقط: بلا بادئة');
    assert.strictEqual(loaded[0].name, 'example-agent',
        'نسخُ القالبِ حرفيّاً إلى plugins/ يُسجّل وكيلَ المثال — وهذا هو المقيس');
    assert.strictEqual(loaded[0].enabled, true, 'ويُسجَّل مفعَّلاً');
});

test('البادئةُ `.` تُتخطّى كذلك', async () => {
    const dir = tmpPluginDir(['.hidden.js']);
    const { loaded } = await loadPluginsFrom(dir);
    assert.deepStrictEqual(loaded, [], 'الملفُّ المخفيُّ لا يُحمَّل');
});

test('التعليقُ يصف الآليّةَ ولا يتجاوزها', () => {
    const src = fs.readFileSync(path.join(root, 'core/PluginLoader.js'), 'utf8');
    const line = src.split('\n').find((l) => l.includes("entry.name.startsWith('.')"));
    assert.ok(line, 'اختفى شرطُ التخطّي — راجعِ الحارس');
    // القاعدةُ على الأثر: الشرطُ يذكر البادئتين ولا شيءَ غيرهما
    assert.match(line, /startsWith\('\.'\)/);
    assert.match(line, /startsWith\('_'\)/);
});
