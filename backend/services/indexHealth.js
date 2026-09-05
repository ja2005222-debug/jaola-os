/**
 * 🔐 صحّةُ قيود التفرّد — هل ما تُعلنه النماذجُ مضمونٌ في القاعدة فعلاً؟
 *
 * `dbConfig.js` يضبط `autoIndex: false` (وهو الصواب في الإنتاج: بناءُ الفهارس
 * عند كلّ إقلاع مكلفٌ وقد يُعطّل التجميعة). لكنّ المستودع لا ينادي
 * `createIndexes`/`syncIndexes` في أيّ موضع — فالقيودُ المُعلَنة في النماذج
 * (`unique: true`) لا يُنشئها التطبيقُ أبداً. وجودُها من عدمه حالةٌ في القاعدة
 * لا يعرفها الكود.
 *
 * وهي ليست تفصيلاً: تسجيلُ الحساب `findUser` ثمّ `createUser` — فحصٌ ثمّ فعل،
 * والفهرسُ الفريد هو ما يُغلق السباقَ بينهما. فإن غاب، أنشأ متسابقان اسمَ
 * مستخدمٍ واحداً، ثمّ يُرجع `findOne` أحدَهما اعتباطاً.
 *
 * هذه الوحدةُ **تقرأ ولا تكتب**: لا تُنشئ فهرساً ولا تحذفه. تقول ما هو قائم
 * وما هو غائب في سطرٍ واحدٍ في سجلّ الخادم، فيقرّر المالكُ على بيّنة.
 */

/** قيودُ التفرّد كما تُعلنها النماذجُ المسجّلة — مشتقّةٌ لا مكتوبةٌ بيد. */
export function declaredUniqueIndexes(models) {
    const out = [];
    const seen = new Set();
    for (const [name, model] of Object.entries(models || {})) {
        const collection = model?.collection?.name;
        if (!collection) continue;
        const add = (keys) => {
            const sig = `${collection}:${JSON.stringify(keys)}`;
            if (seen.has(sig)) return;          // نفسُ القيد مُعلَنٌ حقلاً وفهرساً
            seen.add(sig);
            out.push({ model: name, collection, keys });
        };
        for (const [keys, opts] of model.schema?.indexes?.() || []) {
            if (opts && opts.unique) add(keys);
        }
        for (const [pathName, type] of Object.entries(model.schema?.paths || {})) {
            if (type?.options?.unique) add({ [pathName]: 1 });
        }
    }
    return out;
}

const sameKeys = (a, b) => {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k, i) => kb[i] === k && String(a[k]) === String(b[k]));
};

/**
 * يفحص أيُّ القيود المُعلَنة موجودٌ فعلاً في القاعدة.
 * @param {object} deps
 * @param {object} deps.models          نماذج mongoose المسجّلة
 * @param {(collection: string) => Promise<Array>} deps.listIndexes  قارئُ فهارس تجميعة
 * @returns {Promise<{ok:boolean, checked:number, present:Array, missing:Array, unreadable:Array}>}
 */
export async function checkUniqueIndexes({ models, listIndexes }) {
    const declared = declaredUniqueIndexes(models);
    const present = [], missing = [], unreadable = [];
    for (const d of declared) {
        let live;
        try {
            live = await listIndexes(d.collection);
        } catch (err) {
            // تجميعةٌ لم تُنشأ بعد = لا فهرس. وأيُّ خطأٍ آخر يُقال ولا يُبتلع.
            unreadable.push({ ...d, reason: err?.message || 'سببٌ غير معروف' });
            continue;
        }
        const found = (live || []).some((ix) => ix && ix.unique && sameKeys(ix.key || {}, d.keys));
        (found ? present : missing).push(d);
    }
    return { ok: missing.length === 0 && unreadable.length === 0, checked: declared.length, present, missing, unreadable };
}

/** سطرُ تقريرٍ واحد للسجلّ — أسماءُ تجميعاتٍ وحقول، لا بياناتِ مستخدمين. */
export function formatIndexReport(result) {
    if (!result) return '🔐 [قيود التفرّد]: لم يُفحص.';
    const name = (d) => `${d.collection}(${Object.keys(d.keys).join('+')})`;
    if (result.ok) return `🔐 [قيود التفرّد]: ${result.checked}/${result.checked} مضمونةٌ في القاعدة.`;
    const parts = [`🔐 [قيود التفرّد]: ${result.present.length}/${result.checked} مضمونة`];
    if (result.missing.length) parts.push(`❌ غائبة: ${result.missing.map(name).join('، ')}`);
    if (result.unreadable.length) parts.push(`⚠️ تعذّرت قراءتها: ${result.unreadable.map(name).join('، ')}`);
    parts.push('التطبيقُ لا يُنشئ الفهارس (autoIndex=false) — الغائبُ غيرُ مضمونٍ ولو أعلنه النموذج.');
    return parts.join(' · ');
}
