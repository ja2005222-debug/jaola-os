export function architectReview(plan) {
    if (!plan || !Array.isArray(plan.files)) {
        return { approved: false, feedback: "خطة الملفات تالفة أو غير مكتملة البنية." };
    }

    // قبول أي ملف HTML وليس فقط index.html
    const hasHtml = plan.files.some(f => f.name.endsWith('.html') && f.content && f.content.length > 100);
    const hasCss = plan.files.some(f => f.name.endsWith('.css') && f.content && f.content.length > 50);

    if (!hasHtml) {
        return { approved: false, feedback: "يفتقر القالب لملف HTML أساسي." };
    }

    if (!hasCss) {
        return { approved: false, feedback: "يفتقر القالب لملف CSS أساسي." };
    }

    // تحقق من محتوى HTML
    const htmlFile = plan.files.find(f => f.name.endsWith('.html'));
    if (htmlFile && htmlFile.content.length < 200) {
        return { approved: false, feedback: "ملف HTML قصير جداً — المحتوى غير مكتمل." };
    }

    return { approved: true, feedback: "تمت مطابقة معايير البنية بنجاح." };
}
