/**
 * 🗄️ مزامنة بيانات القوالب (jaola-data) — تُحقن تلقائياً عند تطبيق قالب أو
 * نشر مشروع: تعترض كل localStorage.setItem محلياً وترسلها للخادم (fire-and-
 * forget)، وعند التحميل تسحب أحدث نسخة من الخادم قبل تشغيل app.js — فتعمل
 * قوالب «السيستم» (عيادة/نقطة بيع/مستودع...) كأداة عمل حقيقية تتزامن بين
 * الأجهزة بدل أن تبقى حبيسة متصفح واحد.
 *
 * التوكن موقّع بهوية المشروع (ليس سرّاً — يمنع الانتحال لا الإخفاء)، تماماً
 * كوصلة jaola-connect. مفاتيح تنتهي بـ «_session» (حالة الدخول التجريبي في
 * القالب) تبقى محلّية عمداً — لا تُزامَن، فلا يظهر جهاز آخر «مسجَّلاً دخوله»
 * فجأة بلا كلمة مرور.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = 'jaola-data.js';
const APP_SCRIPT_RE = /<script\s+src=["']app\.js["']\s*>\s*<\/script>/;

/** يبني كود المزامنة (vanilla، بلا اعتماديات، فشل الشبكة صامت دائماً). */
export function buildDataSyncJS({ apiBase, token, appScript = 'app.js', timeoutMs = 4000 }) {
    const base = String(apiBase || '').replace(/\/$/, '');
    return `// 🗄️ JAOLA Data Sync — تخزين حقيقي متزامن بين الأجهزة (يُولَّد آلياً)
(function () {
  'use strict';
  var API = ${JSON.stringify(base)};
  var TOKEN = ${JSON.stringify(String(token || ''))};
  var APP = ${JSON.stringify(appScript)};
  var TIMEOUT_MS = ${Number(timeoutMs) || 4000};
  var origSetItem = localStorage.setItem.bind(localStorage);
  var appLoaded = false;

  function isSynced(k) { return !/_session$/.test(k); }

  function loadApp() {
    if (appLoaded) return;
    appLoaded = true;
    var s = document.createElement('script');
    s.src = APP;
    // app.js يسجّل مستمعه عبر addEventListener('DOMContentLoaded', init) —
    // لكن الحدث الحقيقي يكون قد أُطلق بالفعل قبل أن يصل هذا الطلب (fetch
    // غير حاجب). نبثّ نسخة صناعية من الحدث بعد اكتمال تحميل app.js فعلياً
    // ليُشغَّل init() دون أي تعديل على كود القالب نفسه.
    s.onload = function () {
      document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    };
    document.body.appendChild(s);
  }

  if (!API || !TOKEN) { loadApp(); return; }

  // كل كتابة محلية تُرحَّل للخادم فوراً (لا تنتظر الاستجابة، فشل صامت)
  localStorage.setItem = function (k, v) {
    origSetItem(k, v);
    if (!isSynced(k)) return;
    try {
      fetch(API + '/api/public/data/' + encodeURIComponent(k), {
        method: 'PUT', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, value: v }),
      }).catch(function () {});
    } catch (e) { /* الحفظ المحلي تمّ فعلاً — لا تعطّل التطبيق */ }
  };

  // عند التحميل: اسحب أحدث نسخة من الخادم (بمهلة) قبل تشغيل التطبيق —
  // حتى لا يعمل بنسخة محلية قديمة على جهاز لم يُحدَّث منذ فترة.
  var settled = false;
  var timer = setTimeout(function () { if (!settled) { settled = true; loadApp(); } }, TIMEOUT_MS);
  fetch(API + '/api/public/data?token=' + encodeURIComponent(TOKEN))
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (data) {
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(function (k) { if (isSynced(k)) origSetItem(k, data[k]); });
      }
    })
    .catch(function () {})
    .then(function () { if (!settled) { settled = true; clearTimeout(timer); loadApp(); } });
})();
`;
}

/** يستبدل <script src="app.js"> بوسم المزامنة — idempotent، وتجاوز آمن إن كان app.js غائباً. */
export function injectDataSyncTag(html) {
    const out = String(html || '');
    if (out.includes(DATA_FILE)) return out;
    if (!APP_SCRIPT_RE.test(out)) return out;
    return out.replace(APP_SCRIPT_RE, `<script src="${DATA_FILE}"></script>`);
}

/**
 * يثبّت المزامنة في مشروع: يكتب jaola-data.js ويستبدل وسم app.js في
 * index.html فقط (لا يمسّ الصفحات الأخرى). آمن للتكرار مع كل تطبيق/نشر.
 */
export function installDataSync(projectPath, { apiBase, token }) {
    if (!projectPath || !fs.existsSync(projectPath)) return { error: 'مجلد المشروع غير موجود' };
    const idxPath = path.join(projectPath, 'index.html');
    if (!fs.existsSync(idxPath)) return { skipped: true };
    const html = fs.readFileSync(idxPath, 'utf8');
    const next = injectDataSyncTag(html);
    if (next === html) return { skipped: true }; // مُثبَّت مسبقاً أو app.js غير موجود بالشكل المتوقَّع
    fs.writeFileSync(path.join(projectPath, DATA_FILE), buildDataSyncJS({ apiBase, token }));
    fs.writeFileSync(idxPath, next);
    return { ok: true };
}
