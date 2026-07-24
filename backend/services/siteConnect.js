/**
 * 🔗 وصلة الموقع (jaola-connect) — تُحقن تلقائياً عند النشر في مواقع العملاء:
 *   1. عدّاد زيارات: إشارة واحدة لكل جلسة زائر (sessionStorage).
 *   2. صندوق النماذج: يلتقط إرسال نماذج «تواصل معنا» (طور capture — لا يعطّل
 *      سلوك الموقع نفسه) ويبعثها لصندوق المالك في JAOLA.
 *
 * التوكن موقّع بهوية المشروع (ليس سرّاً — يمنع الانتحال لا الإخفاء)،
 * ونماذج الدخول/الأدمن مستثناة (password أو حاوية admin).
 */

import fs from 'fs';
import path from 'path';

const CONNECT_FILE = 'jaola-connect.js';
const SKIP_HTML = new Set(['dashboard.html']); // لوحة CMS للمالك — ليست صفحة زوّار

/** يبني كود الوصلة (vanilla، بلا اعتماديات، فشل الشبكة صامت دائماً). */
export function buildConnectJS({ apiBase, token }) {
    const base = String(apiBase || '').replace(/\/$/, '');
    return `// 🔗 JAOLA Connect — عدّاد زيارات + إيصال نماذج التواصل لصندوق المالك (يُولَّد آلياً)
(function () {
  'use strict';
  var API = ${JSON.stringify(base)};
  var TOKEN = ${JSON.stringify(String(token || ''))};
  if (!API || !TOKEN) return;
  var send = function (path, data) {
    try {
      fetch(API + path, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ token: TOKEN }, data)),
      }).catch(function () {});
    } catch (e) { /* صامت — الموقع لا يتأثر أبداً */ }
  };

  // ── زيارة واحدة لكل جلسة ──
  try {
    if (!sessionStorage.getItem('jaola-hit')) {
      sessionStorage.setItem('jaola-hit', '1');
      send('/api/public/site-hit', { page: location.pathname });
    }
  } catch (e) { send('/api/public/site-hit', { page: location.pathname }); }

  // ── التقاط نماذج التواصل (طور capture: يعمل حتى مع preventDefault) ──
  var lastSent = 0;
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || form.tagName !== 'FORM') return;
    if (form.querySelector('input[type=password]')) return;          // دخول/تسجيل
    if (form.closest('[id*="admin"],[class*="admin"],[data-no-jaola]')) return; // لوحة أدمن
    var els = form.querySelectorAll('input, textarea, select');
    var name = '', contact = '', message = '', extra = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i], v = (el.value || '').trim();
      if (!v || el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.type === 'checkbox' || el.type === 'radio') continue;
      var hint = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '')).toLowerCase();
      if (el.tagName === 'TEXTAREA') { if (!message) message = v; }
      else if (el.type === 'email' || el.type === 'tel' || /mail|phone|whats|بريد|جوال|هاتف|واتس/.test(hint)) { if (!contact) contact = v; }
      else if (/name|اسم/.test(hint)) { if (!name) name = v; }
      else extra.push(v);
    }
    if (!message && !contact) return;                                 // ليس نموذج تواصل
    if (!message) message = extra.join(' | ');
    var now = Date.now();
    if (now - lastSent < 3000) return;                                // ضد الإرسال المزدوج
    lastSent = now;
    send('/api/public/site-message', { name: name, contact: contact, message: message, page: location.pathname });
  }, true);
})();
`;
}

/** يضيف وسم الوصلة قبل </body> (idempotent — لا يكرَّر). */
export function injectConnectTag(html) {
    const out = String(html || '');
    if (out.includes(CONNECT_FILE)) return out;
    const tag = `    <script src="${CONNECT_FILE}" defer></script>\n`;
    return out.includes('</body>') ? out.replace('</body>', tag + '</body>') : out + '\n' + tag;
}

/**
 * يثبّت الوصلة في مشروع: يكتب jaola-connect.js ويحقن الوسم في كل صفحات
 * HTML الجذرية (عدا dashboard.html). آمن للتكرار مع كل نشر.
 */
export function installSiteConnect(projectPath, { apiBase, token }) {
    if (!projectPath || !fs.existsSync(projectPath)) return { error: 'مجلد المشروع غير موجود' };
    fs.writeFileSync(path.join(projectPath, CONNECT_FILE), buildConnectJS({ apiBase, token }));
    const injected = [];
    for (const f of fs.readdirSync(projectPath)) {
        if (!f.endsWith('.html') || SKIP_HTML.has(f)) continue;
        const p = path.join(projectPath, f);
        const html = fs.readFileSync(p, 'utf8');
        const next = injectConnectTag(html);
        if (next !== html) { fs.writeFileSync(p, next); injected.push(f); }
    }
    return { ok: true, injected };
}
