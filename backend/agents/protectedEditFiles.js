/** Explicit filenames only; never guess which file implements a business concept. */
export function protectedEditFiles(instruction) {
    return [...new Set([...instruction.matchAll(/(?:لا\s+(?:تلمس|تغير|تغيّر|تعدل|تعدّل)|متغيرش)\s+(?:ملف\s+)?[`«"']?([\w./-]+\.(?:js|mjs|jsx|ts|tsx|json|css|html))(?=[`»"'\s،,.]|$)/gu)].map(match => match[1]))];
}

export function assertProtectedEditFiles(names, before, proposed) {
    for (const name of names) {
        const original = before.find(file => file.name === name);
        if (!original) throw new Error(`تعذّر التحقق من الملف المحمي ${name}؛ لم يبدأ التعديل.`);
        const change = proposed.find(file => file.name === name);
        if (change && change.content !== original.content) {
            throw new Error(`التعديل المقترح يغيّر الملف المحمي ${name}؛ أُوقف قبل الكتابة.`);
        }
    }
}
