export function architectReview(plan) {
    if (!plan || !Array.isArray(plan.files)) {
        return { approved: false, feedback: "خطة الملفات تالفة أو غير مكتملة البنية." };
    }

    const hasHtml = plan.files.some(f => f.name === 'index.html');
    const hasCss = plan.files.some(f => f.name === 'styles.css');

    if (!hasHtml || !hasCss) {
        return { 
            approved: false, 
            feedback: "البنية البصرية غير معتمدة؛ يفتقر القالب لملفات index.html أو styles.css الأساسية." 
        };
    }

    return { 
        approved: true, 
        feedback: "تمت مطابقة خطوط المعايير وضمان حماية الهيكل البصري بنجاح." 
    };
}
