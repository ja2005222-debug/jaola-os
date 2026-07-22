import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

/**
 * 🤖 JAOLA Bot — إضافة «عند الطلب»: تحقن مساعداً محادثاً (زر عائم + لوحة دردشة)
 * في أي مشروع قائم، بنفس نمط pwaAgent (تكتب ملفات + تحقن وسومها في index.html).
 *
 * مبنيّ على نفس المبدأين المعتمدين في jaola-travel:
 *  - White-label: يرث اسم/رمز/لون العلامة (يُستخرج اللون من CSS المشروع).
 *  - API-ready: يعمل افتراضياً بمحرّك قواعد offline (قاعدة معرفة FAQ). وبضبط
 *    apiBase يُرسل الرسائل لخادم ذكاء اصطناعي، ومع أي فشل يرتدّ للقواعد — لا انهيار.
 *
 * الحقن idempotent (لا يكرّر الوسوم عند الاستدعاء المتكرّر).
 */

const DEFAULT_COLOR = '#0ea5e9';

/** يستخرج لون العلامة من styles.css (متغيّر primary/brand أو أول hex). */
async function extractThemeColor(projectPath) {
    try {
        const cssPath = path.join(projectPath, 'styles.css');
        if (!fs.existsSync(cssPath)) return DEFAULT_COLOR;
        const css = await fsPromises.readFile(cssPath, 'utf-8');
        const varMatch = css.match(/--(?:brand|primary|main|theme|accent)[a-z-]*:\s*(#[0-9a-fA-F]{3,8})/);
        if (varMatch) return varMatch[1];
        const hexMatch = css.match(/#[0-9a-fA-F]{6}\b/);
        if (hexMatch) return hexMatch[0];
        return DEFAULT_COLOR;
    } catch { return DEFAULT_COLOR; }
}

/** قاعدة معرفة افتراضية لأعمال عامّة (عربي) — تُدمج مع أي faq يمرّره الطلب. */
function defaultKB() {
    return [
        { k: ['مرحبا', 'السلام', 'هلا', 'اهلا', 'hi', 'hello'], a: 'أهلاً وسهلاً! كيف أقدر أساعدك اليوم؟' },
        { k: ['خدمات', 'منتجات', 'ماذا تقدمون', 'ايش عندكم', 'products', 'services'], a: 'نقدّم مجموعة من المنتجات والخدمات — تصفّح الموقع، وإن احتجت تفصيلاً عن شيء محدّد أخبرني.' },
        { k: ['طلب', 'اطلب', 'كيف اشتري', 'شراء', 'order', 'buy'], a: 'لإتمام طلبك: اختر ما يناسبك ثم تابع خطوات الطلب في الموقع. أنا هنا لو احتجت مساعدة في أي خطوة.' },
        { k: ['سعر', 'اسعار', 'كم', 'التكلفة', 'price', 'cost'], a: 'تجد الأسعار موضّحة بجانب كل عنصر. أخبرني بالعنصر الذي تريد سعره تحديداً.' },
        { k: ['اوقات', 'الدوام', 'متى تفتحون', 'ساعات العمل', 'hours', 'open'], a: 'أوقات العمل موضّحة في صفحة التواصل. عموماً نخدمك عبر الموقع على مدار الساعة.' },
        { k: ['تواصل', 'اتصال', 'رقم', 'هاتف', 'ايميل', 'contact', 'phone', 'email'], a: 'يسعدنا تواصلك! تجد وسائل الاتصال في قسم «تواصل معنا» بالموقع.' },
        { k: ['موقع', 'عنوان', 'وينكم', 'اين', 'location', 'address'], a: 'موقعنا وتفاصيل الوصول موضّحة في صفحة التواصل.' },
        { k: ['شكرا', 'مشكور', 'يعطيك', 'thanks', 'thank'], a: 'العفو! سعدت بخدمتك 🌟 هل من شيء آخر؟' },
    ];
}

/** يبني كائن الإعداد (CFG) المضمَّن داخل الودجت. */
function buildConfig(options, themeColor) {
    const faq = Array.isArray(options.faq) ? options.faq
        .filter(x => x && x.q && x.a)
        .map(x => ({ k: String(x.q).split(/[،,|]/).map(s => s.trim()).filter(Boolean), a: String(x.a) }))
        : [];
    return {
        name: (options.brandName || 'المساعد').toString().trim().slice(0, 40),
        emoji: (options.emoji || '🤖').toString().trim().slice(0, 4),
        color: themeColor,
        apiBase: options.apiBase && typeof options.apiBase === 'string' ? options.apiBase.trim() : null,
        token: options.token && typeof options.token === 'string' ? options.token : null,
        welcome: (options.welcome || 'مرحباً! أنا مساعدك الآلي — اسألني عمّا تريد.').toString(),
        placeholder: 'اكتب رسالتك...',
        sendLabel: 'إرسال',
        fallback: (options.fallback || 'لم أفهم تماماً — جرّب صياغة أخرى، أو تواصل معنا مباشرةً وسأصلك بالفريق.').toString(),
        quick: Array.isArray(options.quick) && options.quick.length
            ? options.quick.slice(0, 4).map(String)
            : ['ما خدماتكم؟', 'كيف أطلب؟', 'كيف أتواصل؟'],
        kb: faq.concat(defaultKB()),
    };
}

/** الودجت نفسه (منطق ثابت) — كل الدوال معرّفة، تفويض أحداث، يعمل بلا إنترنت. */
const WIDGET_BODY = `(function () {
  'use strict';
  var CFG = __CFG__;

  function norm(s) { return (s || '').toString().toLowerCase().replace(/[^\\p{L}\\p{N}\\s]/gu, ' ').replace(/\\s+/g, ' ').trim(); }
  function ruleReply(text) {
    var q = norm(text);
    if (!q) return CFG.fallback;
    for (var i = 0; i < CFG.kb.length; i++) {
      var item = CFG.kb[i];
      for (var j = 0; j < item.k.length; j++) {
        var kw = norm(item.k[j]);
        if (kw && q.indexOf(kw) !== -1) return item.a;
      }
    }
    return CFG.fallback;
  }
  function byId(id) { return document.getElementById(id); }
  function addMsg(role, text) {
    var wrap = byId('jbot-msgs'); if (!wrap) return null;
    var d = document.createElement('div');
    d.className = 'jbot-msg jbot-' + role;
    d.textContent = text;
    wrap.appendChild(d);
    wrap.scrollTop = wrap.scrollHeight;
    return d;
  }
  function botRespond(text) {
    if (CFG.apiBase) {
      var thinking = addMsg('bot', '…');
      fetch(CFG.apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, brand: CFG.name, token: CFG.token }) })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (data) {
          if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
          addMsg('bot', (data && (data.reply || data.answer)) || ruleReply(text));
        })
        .catch(function () {
          if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
          addMsg('bot', ruleReply(text));
        });
    } else {
      addMsg('bot', ruleReply(text));
    }
  }
  function send() {
    var inp = byId('jbot-input'); if (!inp) return;
    var text = (inp.value || '').trim(); if (!text) return;
    addMsg('user', text); inp.value = '';
    botRespond(text);
  }
  function quickReply(text) { var inp = byId('jbot-input'); if (inp) inp.value = text; send(); }
  function toggle(force) {
    var panel = byId('jbot-panel'); if (!panel) return;
    var willOpen = force === undefined ? panel.classList.contains('jbot-hidden') : force;
    panel.classList.toggle('jbot-hidden', !willOpen);
    if (willOpen) { var inp = byId('jbot-input'); if (inp) inp.focus(); }
  }
  function onClick(e) {
    var t = e.target.closest('[data-jbot]'); if (!t) return;
    var act = t.getAttribute('data-jbot');
    if (act === 'toggle') toggle();
    else if (act === 'close') toggle(false);
    else if (act === 'send') send();
    else if (act === 'quick') quickReply(t.getAttribute('data-text'));
  }
  function onKey(e) { if (e.key === 'Enter' && e.target && e.target.id === 'jbot-input') send(); }
  function esc(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function mount() {
    if (byId('jbot-root')) return;
    var root = document.createElement('div');
    root.id = 'jbot-root';
    var quick = CFG.quick.map(function (q) { return '<button class="jbot-chip" data-jbot="quick" data-text="' + esc(q) + '">' + esc(q) + '</button>'; }).join('');
    root.innerHTML =
      '<button id="jbot-fab" class="jbot-fab" data-jbot="toggle" aria-label="chat">' + esc(CFG.emoji) + '</button>' +
      '<div id="jbot-panel" class="jbot-panel jbot-hidden" role="dialog">' +
        '<div class="jbot-head"><span>' + esc(CFG.emoji) + ' ' + esc(CFG.name) + '</span>' +
        '<button class="jbot-x" data-jbot="close" aria-label="close">×</button></div>' +
        '<div id="jbot-msgs" class="jbot-msgs"></div>' +
        '<div class="jbot-quick">' + quick + '</div>' +
        '<div class="jbot-input-row"><input id="jbot-input" placeholder="' + esc(CFG.placeholder) + '" autocomplete="off">' +
        '<button class="jbot-send" data-jbot="send">' + esc(CFG.sendLabel) + '</button></div>' +
      '</div>';
    document.body.appendChild(root);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    addMsg('bot', CFG.welcome);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
`;

function generateWidgetJS(cfg) {
    return '// 🤖 JAOLA Bot — مساعد محادثة (offline قواعد + API-ready). تم توليده عبر JAOLA OS.\n'
        + WIDGET_BODY.replace('__CFG__', JSON.stringify(cfg));
}

function generateWidgetCSS(color) {
    return `/* 🤖 JAOLA Bot widget — تم توليده عبر JAOLA OS */
#jbot-root{--jbot:${color};position:fixed;bottom:20px;left:20px;z-index:2147483000;direction:rtl;font-family:'Segoe UI',Tahoma,system-ui,sans-serif}
.jbot-fab{width:58px;height:58px;border-radius:50%;border:none;background:var(--jbot);color:#fff;font-size:26px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.28);transition:transform .15s}
.jbot-fab:hover{transform:scale(1.06)}
.jbot-panel{position:absolute;bottom:70px;left:0;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 120px);background:#fff;color:#1a2230;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}
.jbot-hidden{display:none !important}
.jbot-head{background:var(--jbot);color:#fff;padding:13px 16px;font-weight:800;display:flex;justify-content:space-between;align-items:center}
.jbot-x{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1}
.jbot-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:#f6f8fb}
.jbot-msg{max-width:82%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.jbot-bot{align-self:flex-start;background:#fff;border:1px solid #e6ebf2;border-bottom-right-radius:4px}
.jbot-user{align-self:flex-end;background:var(--jbot);color:#fff;border-bottom-left-radius:4px}
.jbot-quick{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;background:#fff;border-top:1px solid #eef2f7}
.jbot-chip{background:#f0f4f9;border:1px solid #e0e7f0;color:#33405a;border-radius:16px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer}
.jbot-chip:hover{background:var(--jbot);color:#fff;border-color:var(--jbot)}
.jbot-input-row{display:flex;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid #eef2f7}
.jbot-input-row input{flex:1;border:1px solid #dbe3ee;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;color:#1a2230}
.jbot-input-row input:focus{outline:none;border-color:var(--jbot)}
.jbot-send{background:var(--jbot);color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:700;font-size:13px;cursor:pointer}
@media (prefers-color-scheme:dark){
  .jbot-panel{background:#151b24;color:#e8edf6}
  .jbot-msgs{background:#0f141c}
  .jbot-bot{background:#1c2430;border-color:#2a3444;color:#e8edf6}
  .jbot-quick,.jbot-input-row{background:#151b24;border-color:#2a3444}
  .jbot-chip{background:#1c2430;border-color:#2a3444;color:#c9d3e0}
  .jbot-input-row input{background:#0f141c;border-color:#2a3444;color:#e8edf6}
}
`;
}

/** يحقن وسمَي البوت في index.html (idempotent). */
function injectBotTags(html) {
    let out = html;
    if (!out.includes('jaola-bot.css')) {
        out = out.includes('</head>')
            ? out.replace('</head>', '    <link rel="stylesheet" href="jaola-bot.css">\n  </head>')
            : '<link rel="stylesheet" href="jaola-bot.css">\n' + out;
    }
    if (!out.includes('jaola-bot.js')) {
        const tag = '    <script src="jaola-bot.js"></script>\n';
        out = out.includes('</body>') ? out.replace('</body>', tag + '  </body>') : out + '\n' + tag;
    }
    return out;
}

/**
 * 🚀 الدالة الرئيسية — تُستدعى من نقطة النهاية «عند الطلب».
 * @param {string} projectPath مسار مجلد المشروع على القرص.
 * @param {object} options { brandName, emoji, apiBase, faq:[{q,a}], quick:[], welcome, fallback }
 * @returns {Promise<{success:boolean, files?:string[], apiBase?:string|null, error?:string}>}
 */
export async function generateJaolaBot(projectPath, options = {}) {
    try {
        const indexPath = path.join(projectPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
            return { success: false, error: 'index.html غير موجود في هذا المشروع. ابنِ الموقع أولاً ثم أضف البوت.' };
        }
        const themeColor = await extractThemeColor(projectPath);
        const cfg = buildConfig(options, themeColor);
        const widgetJS = generateWidgetJS(cfg);
        const widgetCSS = generateWidgetCSS(themeColor);

        const html = await fsPromises.readFile(indexPath, 'utf-8');
        const updatedHTML = injectBotTags(html);

        await Promise.all([
            fsPromises.writeFile(path.join(projectPath, 'jaola-bot.js'), widgetJS),
            fsPromises.writeFile(path.join(projectPath, 'jaola-bot.css'), widgetCSS),
            fsPromises.writeFile(indexPath, updatedHTML),
        ]);

        return { success: true, brandName: cfg.name, apiBase: cfg.apiBase, files: ['jaola-bot.js', 'jaola-bot.css'] };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// مُصدَّرات مساعدة للاختبار
export const _internals = { buildConfig, generateWidgetJS, injectBotTags, extractThemeColor, defaultKB };
