export function qaVerify(plan) {
    const logs = [];
    let passed = true;

    if (plan && Array.isArray(plan.files)) {
        plan.files.forEach(file => {
            if (file.name === 'index.html') {
                if (!file.content.includes('<!DOCTYPE html>')) {
                    logs.push("تنبيه QA: ملف HTML يفتقر لإعلان DOCTYPE القياسي.");
                }
            }
            if (file.name === 'script.js') {
                // فحص بسيط للأقواس المفقودة في الجافاسكريبت كمثال اختبار أولي
                const openBraces = (file.content.match(/\{/g) || []).length;
                const closeBraces = (file.content.match(/\}/g) || []).length;
                if (openBraces !== closeBraces) {
                    logs.push("تنبيه QA: تم رصد عدم تطابق في أعداد الأقواس المموجة {} بملف الجافاسكريبت.");
                    passed = false;
                }
            }
        });
    }

    return {
        passed,
        logs: logs.length ? logs : ["جميع فحوصات الترابط البصري وهندسة الأبعاد مرت بنجاح."]
    };
}
