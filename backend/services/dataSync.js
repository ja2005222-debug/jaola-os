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
// يطابق <script src="app.js"> بأي ترتيب/وجود سمة type (مثل type="text/babel"
// لقوالب React عبر Babel standalone) — يُستخرَج نوعها إن وُجدت.
const APP_SCRIPT_RE = /<script\b[^>]*\bsrc=["']app\.js["'][^>]*>\s*<\/script>/;

/** يبني كود المزامنة (vanilla، بلا اعتماديات، فشل الشبكة صامت دائماً). */
export function buildDataSyncJS({ apiBase, token, appScript = 'app.js', appScriptType = '', timeoutMs = 4000 }) {
    const base = String(apiBase || '').replace(/\/$/, '');
    return `// 🗄️ JAOLA Data Sync — تخزين حقيقي متزامن بين الأجهزة (يُولَّد آلياً)
(function () {
  'use strict';
  var API = ${JSON.stringify(base)};
  var TOKEN = ${JSON.stringify(String(token || ''))};
  var APP = ${JSON.stringify(appScript)};
  var APP_TYPE = ${JSON.stringify(String(appScriptType || ''))};
  var TIMEOUT_MS = ${Number(timeoutMs) || 4000};
  var origSetItem = localStorage.setItem.bind(localStorage);
  var appLoaded = false;

  // app.js (مُحمَّل بعده) يقرأ هذا لمصادقة الدخول الحقيقية عبر الخادم —
  // بدل مقارنة كلمة مرور نص صريح محلياً. لا سرّ هنا (نفس فلسفة التوكن).
  window.JAOLA_SYNC = (API && TOKEN) ? { api: API, token: TOKEN } : null;

  function isSynced(k) { return !/_session$/.test(k); }

  function dispatchReady() {
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
  }

  function loadApp() {
    if (appLoaded) return;
    appLoaded = true;
    // قوالب React عبر Babel standalone: نجلب مصدر app.js (JSX) ونحوّله نحن
    // مباشرة عبر Babel.transform بدل الاعتماد على مسح Babel التلقائي لوسوم
    // <script> مُضافة ديناميكياً بعد تحميل الصفحة (توقيت غير مضمون).
    if (APP_TYPE === 'text/babel' && window.Babel) {
      fetch(APP).then(function (r) { return r.text(); }).then(function (src) {
        // runtime: 'classic' → React.createElement(...) بدل import تلقائي من
        // "react/jsx-runtime" (يفشل بلا وحدات ES — React هنا global عبر CDN فقط)
        var compiled = window.Babel.transform(src, { presets: [['react', { runtime: 'classic' }]] }).code;
        var s = document.createElement('script');
        s.text = compiled;
        document.body.appendChild(s);
        dispatchReady();
      }).catch(function () {});
      return;
    }
    var s = document.createElement('script');
    s.src = APP;
    // app.js يسجّل مستمعه عبر addEventListener('DOMContentLoaded', init) —
    // لكن الحدث الحقيقي يكون قد أُطلق بالفعل قبل أن يصل هذا الطلب (fetch
    // غير حاجب). نبثّ نسخة صناعية من الحدث بعد اكتمال تحميل app.js فعلياً
    // ليُشغَّل init() دون أي تعديل على كود القالب نفسه.
    s.onload = dispatchReady;
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

/** يستخرج سمة type من وسم <script src="app.js"> الأصلي إن وُجدت (مثل text/babel). */
function extractAppScriptType(html) {
    const m = String(html || '').match(APP_SCRIPT_RE);
    if (!m) return '';
    const t = m[0].match(/\btype=["']([^"']+)["']/);
    return t ? t[1] : '';
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
 * يكتشف نوع وسم app.js الأصلي (مثل type="text/babel" لقوالب React) تلقائياً.
 */
export function installDataSync(projectPath, { apiBase, token }) {
    if (!projectPath || !fs.existsSync(projectPath)) return { error: 'مجلد المشروع غير موجود' };
    const idxPath = path.join(projectPath, 'index.html');
    if (!fs.existsSync(idxPath)) return { skipped: true };
    const html = fs.readFileSync(idxPath, 'utf8');
    const appScriptType = extractAppScriptType(html);
    const next = injectDataSyncTag(html);
    if (next === html) return { skipped: true }; // مُثبَّت مسبقاً أو app.js غير موجود بالشكل المتوقَّع
    fs.writeFileSync(path.join(projectPath, DATA_FILE), buildDataSyncJS({ apiBase, token, appScriptType }));
    fs.writeFileSync(idxPath, next);
    return { ok: true };
}
