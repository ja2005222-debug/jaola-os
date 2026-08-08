/**
 * 🎲 mockUtils.js — بذرة حتمية مشتركة بين مزوّدات المحاكاة (طيران/فنادق)
 *
 * نفس الخوارزمية بالضبط في الاثنين — استُخرجت هنا بدل تكرارها حرفياً.
 */

/** بذرة رقمية حتمية من نص — لا عشوائية في الاختبارات. */
export function seedOf(text) {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 100000;
    return h;
}

export function pad(n) { return String(n).padStart(2, '0'); }
