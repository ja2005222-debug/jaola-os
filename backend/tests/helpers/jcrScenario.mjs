// 🧪 سيناريو اختبار موحّد لـ JaolaCognitiveRuntime — بلا LLM ولا شبكة.
// io وهمي يلتقط كل البثّ، وطرق الإطلاق الثقيلة تُستبدل بمسجِّلات، ومشروع
// مؤقّت حقيقي على القرص عند الحاجة (المسارات التي تقرأ index.html فعلاً).
// في بيئة الاختبار لا مزوّد AI مُهيأ → smartChat يرمي فوراً → كل مسار LLM
// يسقط حتمياً إلى الاحتياط المكتوب في jcr — وهذا ما تُثبّته الاختبارات.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JaolaCognitiveRuntime } from '../../agents/jcr.js';

let seq = 0;

export function scenario(prefix = 'jcr') {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const rt = new JaolaCognitiveRuntime(io);
    const calls = { executeMission: [], surgicalEdit: [], chat: [] };
    rt.executeMission = (...args) => { calls.executeMission.push(args); };
    rt.surgicalEdit = (...args) => { calls.surgicalEdit.push(args); };
    rt.generateChatResponse = async (...args) => { calls.chat.push(args); };
    const ctx = {
        username: `__${prefix}_u${seq}__`,
        roomName: `${prefix}_room_${seq}`,
        projectPath: `/nonexistent/${prefix}_${seq}`,
        activeProject: `proj-${seq}`,
    };
    const replies = () => events.filter(e => e.ev === 'chat_reply').map(e => e.payload.message);
    const logs = () => events.filter(e => e.ev === 'log').map(e => e.payload.message).join('\n');
    const send = (message, agents = {}, extra = {}) =>
        rt.handleUserMessage(null, { ...ctx, ...extra, message }, { getState: () => null, ...agents }, null);
    return { rt, events, calls, ctx, replies, logs, send };
}

/** مشروع مؤقّت حقيقي فيه index.html أطول من 100 حرف (عتبة «مشروع قائم» في jcr). */
export function tempProject(html = null) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcr-proj-'));
    const content = html ?? `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>مطعم البحر</title>
<link rel="stylesheet" href="styles.css"></head><body><header><h1>مطعم البحر</h1></header>
<main><section id="menu"><h2>القائمة</h2></section></main><script src="script.js"></script></body></html>`;
    fs.writeFileSync(path.join(dir, 'index.html'), content);
    return dir;
}

/**
 * مشروع مؤقّت *يعمل* بمعيار التحقّق الساكن (لا سكربت مفقود، مصدر بيانات،
 * تفاعل موصول) — عكس tempProject الذي يشير إلى script.js غير موجود فيُعدّ «معطّلاً».
 */
export function workingProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcr-work-'));
    fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>مطعم البحر</title>
<link rel="stylesheet" href="styles.css"></head><body><header><h1>مطعم البحر</h1><nav><a href="#menu">القائمة</a></nav></header>
<main><section id="menu"><h2>القائمة</h2><ul id="items"></ul><button id="order">اطلب</button></section></main>
<script src="script.js"></script></body></html>`);
    fs.writeFileSync(path.join(dir, 'styles.css'), 'body{font-family:sans-serif}');
    fs.writeFileSync(path.join(dir, 'script.js'), `const items=[{name:'سمك'},{name:'روبيان'}];const ul=document.getElementById('items');
items.forEach(i=>{const li=document.createElement('li');li.textContent=i.name;ul.appendChild(li);});
document.getElementById('order').addEventListener('click',()=>{const li=document.createElement('li');li.textContent='تم الطلب';ul.appendChild(li);});`);
    return dir;
}

/** مجلد فارغ — «بناء جديد» بمعيار jcr (لا index.html). */
export function emptyProject() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'jcr-empty-'));
}

export function assertNoHeavyPath(assert, calls, label) {
    assert.equal(calls.surgicalEdit.length, 0, `${label}: لا تعديل جراحي`);
    assert.equal(calls.chat.length, 0, `${label}: لا ردّ LLM`);
    assert.equal(calls.executeMission.length, 0, `${label}: لا مهمة بناء`);
}
