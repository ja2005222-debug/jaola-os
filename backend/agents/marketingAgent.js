/**
 * 📣 المساعد التسويقي — الجولة ١ (بلا تكاملات خارجية):
 *   1. توليد أسبوع منشورات سوشيال من محتوى موقع العميل الفعلي
 *      (نص + هاشتاقات + صورة SVG بهوية العلامة من imageForge).
 *   2. مسودّة ردّ لائقة على رسالة واردة من صندوق النماذج.
 *
 * فلسفة المنصّة نفسها: الذكاء يحسّن، والحتمي يضمن — لكل ميزة مسار
 * احتياطي كامل يعمل حتى لو كان مزوّد الذكاء معطّلاً.
 */

import fs from 'fs';
import path from 'path';
import { smartChat } from '../core/providers/llm.js';
import { pickPalette } from './cloneAssets.js';
import { forgeItemSVG, seedOf } from './imageForge.js';

const cap = (v, n) => String(v ?? '').trim().slice(0, n);

/**
 * يستخرج حقائق الموقع من ملفاته: العلامة، الأقسام، وعناصر معروضة.
 * الأولوية لـ lib/content.js (مواقع CMS)، ثم عنوان/ترويسات index.html.
 */
export function extractSiteFacts(projectPath) {
    const facts = { brand: '', tagline: '', items: [], sections: [] };
    try {
        const raw = fs.readFileSync(path.join(projectPath, 'lib/content.js'), 'utf8');
        const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
        facts.brand = cap(json.brand, 60);
        facts.tagline = cap(json.hero?.subtitle || json.hero?.title, 160);
        for (const p of (json.products || []).slice(0, 8)) {
            facts.items.push({ name: cap(p.name, 60), price: cap(p.price, 20) });
        }
        for (const key of Object.keys(json.sections || {}).slice(0, 6)) {
            const s = json.sections[key];
            if (s?.heading) facts.sections.push(cap(s.heading, 80));
            for (const it of (s?.items || []).slice(0, 4)) if (it?.title) facts.items.push({ name: cap(it.title, 60), price: '' });
        }
    } catch { /* لا CMS — نقرأ الصفحة */ }

    if (!facts.brand) {
        try {
            const html = fs.readFileSync(path.join(projectPath, 'index.html'), 'utf8');
            facts.brand = cap((html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1], 60);
            if (!facts.tagline) facts.tagline = cap((html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || [])[1], 160);
            for (const m of html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)) {
                if (facts.sections.length < 6) facts.sections.push(cap(m[1], 80));
            }
        } catch { /* مشروع فارغ */ }
    }
    // تركيبة بوت سابقة تحمل اسم العلامة الأدق
    try {
        const bot = JSON.parse(fs.readFileSync(path.join(projectPath, '.jaola-bot.json'), 'utf8'));
        if (bot.brandName) facts.brand = cap(bot.brandName, 60);
    } catch { /* اختياري */ }
    if (!facts.brand) facts.brand = 'موقعنا';
    facts.items = facts.items.slice(0, 10);
    return facts;
}

const DAYS_AR = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const DAYS_EN = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** خطة أسبوع حتمية من الحقائق — تعمل دائماً، بذكاء أو بدونه. */
export function fallbackWeekPlan(facts, lang = 'ar') {
    const ar = lang !== 'en';
    const days = ar ? DAYS_AR : DAYS_EN;
    const b = facts.brand;
    const item = (i) => facts.items[i % Math.max(1, facts.items.length)]?.name;
    const t = (arText, enText) => (ar ? arText : enText);
    const posts = [
        { text: t(`تعرّفوا علينا — ${b}${facts.tagline ? `: ${facts.tagline}` : ''} 🌟`, `Meet ${b}${facts.tagline ? ` — ${facts.tagline}` : ''} 🌟`), tag: t('تعريف', 'intro') },
        { text: item(0) ? t(`الأكثر طلباً عندنا: «${item(0)}» — جرّبوه وأخبرونا برأيكم!`, `Customer favorite: “${item(0)}” — try it and tell us what you think!`) : t(`جودة نثق بها ونقدّمها لكم كل يوم في ${b}.`, `Quality we stand behind, every day at ${b}.`), tag: t('منتج', 'product') },
        { text: t(`خلف الكواليس في ${b}: شغف واهتمام بأدقّ التفاصيل 💪`, `Behind the scenes at ${b}: passion and care in every detail 💪`), tag: t('كواليس', 'bts') },
        { text: item(1) ? t(`هل جرّبتم «${item(1)}»؟ متوفر الآن — راسلونا للطلب.`, `Have you tried “${item(1)}”? Available now — message us to order.`) : t(`سؤال اليوم: ما الذي تودّون رؤيته منا قريباً؟ شاركونا 👇`, `Question of the day: what would you like to see from us next? 👇`), tag: t('تفاعل', 'engage') },
        { text: t(`رأي عملائنا أغلى ما نملك — شاركونا تجربتكم مع ${b} ⭐⭐⭐⭐⭐`, `Your feedback means everything — share your ${b} experience ⭐⭐⭐⭐⭐`), tag: t('تقييم', 'review') },
        { text: item(2) ? t(`لعطلة نهاية الأسبوع: «${item(2)}» بانتظاركم 🎉`, `Weekend pick: “${item(2)}” is waiting for you 🎉`) : t(`عطلة سعيدة من فريق ${b} 🎉 نراكم قريباً!`, `Happy weekend from the ${b} team 🎉 See you soon!`), tag: t('عرض', 'offer') },
        { text: t(`زورونا اليوم أو تواصلوا معنا من الموقع — ${b} في خدمتكم دائماً.`, `Visit us today or reach out via our site — ${b} is always at your service.`), tag: t('دعوة', 'cta') },
    ];
    const baseTag = b.replace(/\s+/g, '_');
    return posts.map((p, i) => ({
        day: days[i],
        text: p.text,
        hashtags: ar ? [`#${baseTag}`, `#${p.tag}`, '#محلي'] : [`#${baseTag}`, `#${p.tag}`, '#local'],
    }));
}

function sanitizePosts(arr, lang) {
    if (!Array.isArray(arr)) return null;
    const days = lang === 'en' ? DAYS_EN : DAYS_AR;
    const out = arr.slice(0, 7).map((p, i) => ({
        day: cap(p?.day, 20) || days[i % 7],
        text: cap(p?.text, 400),
        hashtags: Array.isArray(p?.hashtags) ? p.hashtags.slice(0, 5).map(h => cap(h, 40)).filter(Boolean) : [],
    })).filter(p => p.text.length > 10);
    return out.length >= 5 ? out : null;
}

/**
 * أسبوع منشورات: ذكاء أولاً (JSON صارم) وارتداد حتمي كامل.
 * chat قابل للحقن للاختبار. لكل منشور صورة SVG بهوية العلامة.
 */
export async function generateSocialPosts(projectPath, { lang = 'ar', goal = '' } = {}, deps = {}) {
    const chat = deps.chat || smartChat;
    const facts = extractSiteFacts(projectPath);
    const palette = pickPalette(`${goal} ${facts.brand} ${facts.sections.join(' ')}`);

    let posts = null, ai = false;
    try {
        const raw = await chat([
            {
                role: 'system',
                content: lang === 'en'
                    ? 'You write social media posts. Return ONLY JSON: {"posts":[{"day","text","hashtags":[]}]} — exactly 7 posts, engaging, no invented prices or claims.'
                    : 'أنت كاتب منشورات سوشيال ميديا. أعد JSON فقط: {"posts":[{"day","text","hashtags":[]}]} — 7 منشورات بالضبط، جذابة، بلا أسعار أو ادعاءات مختلقة.',
            },
            { role: 'user', content: `العلامة: ${facts.brand}\nالوصف: ${facts.tagline}\nالأقسام: ${facts.sections.join('، ')}\nالمعروض: ${facts.items.map(i => i.name + (i.price ? ` (${i.price})` : '')).join('، ')}\nاللغة المطلوبة: ${lang === 'en' ? 'English' : 'العربية'}` },
        ], { max_tokens: 1400, temperature: 0.7, json: true });
        posts = sanitizePosts(JSON.parse(raw)?.posts, lang);
        ai = !!posts;
    } catch { /* الارتداد الحتمي أدناه */ }

    if (!posts) posts = fallbackWeekPlan(facts, lang);

    // صورة لكل منشور بهوية العلامة (حتمية — نفس البذرة لنفس النص)
    const withImages = posts.map((p, i) => ({
        ...p,
        svg: forgeItemSVG({
            emoji: palette.emojis[i % palette.emojis.length],
            accent: palette.accent,
            seed: seedOf(facts.brand + p.text),
            label: facts.brand,
        }),
    }));
    return { posts: withImages, brand: facts.brand, ai };
}

/** مسودّة ردّ على رسالة واردة — ذكاء أولاً وارتداد حتمي لائق. */
export async function draftInboxReply({ brand = '', name = '', message = '', lang = 'ar' } = {}, deps = {}) {
    const chat = deps.chat || smartChat;
    const b = cap(brand, 60) || (lang === 'en' ? 'our site' : 'موقعنا');
    const who = cap(name, 60);
    try {
        const raw = await chat([
            {
                role: 'system',
                content: lang === 'en'
                    ? `You draft a courteous, concise reply (3-5 sentences) from the team of "${b}" to a website contact message. Same language as the message. No invented prices, dates, or promises.`
                    : `اكتب مسودّة ردّ مهذّبة وموجزة (٣-٥ جمل) من فريق «${b}» على رسالة واردة من نموذج تواصل الموقع. بنفس لغة الرسالة. بلا أسعار أو مواعيد أو وعود مختلقة.`,
            },
            { role: 'user', content: `المرسل: ${who || '—'}\nالرسالة: ${cap(message, 1200)}` },
        ], { max_tokens: 300, temperature: 0.4 });
        const draft = cap(raw, 1200);
        if (draft.length > 20) return { draft, ai: true };
    } catch { /* الارتداد أدناه */ }

    const greet = who ? (lang === 'en' ? `Hi ${who},` : `مرحباً ${who}،`) : (lang === 'en' ? 'Hello,' : 'مرحباً،');
    return {
        draft: lang === 'en'
            ? `${greet}\n\nThank you for reaching out to ${b}. We received your message and will get back to you as soon as possible. If your request is urgent, feel free to reply here with more details.\n\nBest regards,\n${b} team`
            : `${greet}\n\nشكراً لتواصلك مع ${b}. وصلتنا رسالتك وسنعود إليك في أقرب وقت ممكن. إن كان طلبك عاجلاً فلا تتردد في موافاتنا بمزيد من التفاصيل.\n\nمع خالص التحية،\nفريق ${b}`,
        ai: false,
    };
}
