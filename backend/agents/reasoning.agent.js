const corrections = {
    "الاسعاؤ": "الاسعار",
    "السعرر": "السعر",
    "الموقغ": "الموقع",
    "ريد": "اريد",
    "بل": "هل",
    "٢٣": "23",
    "صث": "س",
    "طمام": "طعام"
};

function correctSpelling(message) {
    let corrected = message;
    for (const [wrong, right] of Object.entries(corrections)) {
        corrected = corrected.replace(new RegExp(wrong, 'g'), right);
    }
    return corrected;
}

export async function analyzeUserRequest(message) {
    const corrected = correctSpelling(message);
    if (corrected !== message) console.log(`[Spell] ${message} -> ${corrected}`);
    
    const commandWords = ['عدل', 'غير', 'أنشئ', 'اضف', 'أضف', 'احذف', 'شغل', 'نفذ', 'ابن', 'اصنع', 'امسح', 'build', 'create', 'edit', 'delete', 'بناء', 'إنشاء', 'عمل', 'اعمل', 'سوي', 'صمم', 'موقع', 'منصة', 'تطبيق', 'نظام', 'متجر', 'مشروع', 'اريد'];
    const deployWords = ['انشر', 'نشر', 'deploy', 'ارفع', 'publish'];
    const businessWords = ['ربح', 'أرباح', 'إيراد', 'استراتيجية', 'تسويق', 'سعر', 'اسعار', 'تكلفة', 'السعر', 'الاسعار', 'مدة', 'الوقت'];
    const chatWords = ['مرحبا', 'السلام', 'اهلا', 'كيف حالك', 'شكرا', 'هلا'];
    
    if (businessWords.some(word => corrected.includes(word))) {
        return { intent: 'business', confidence: 0.9, requiresPlanning: false };
    }
    if (commandWords.some(word => corrected.includes(word))) {
        return { intent: 'command', confidence: 0.95, requiresPlanning: true };
    }
    if (deployWords.some(word => corrected.includes(word))) {
        return { intent: 'deploy', confidence: 0.97, requiresPlanning: true };
    }
    if (chatWords.some(word => corrected.includes(word))) {
        return { intent: 'chat', confidence: 0.99, requiresPlanning: false };
    }
    return { intent: 'question', confidence: 0.8, requiresPlanning: false };
}
