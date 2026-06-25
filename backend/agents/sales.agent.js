import { queryGroq } from '../services/groqService.js';

// تقدير بسيط بناءً على الكلمات المفتاحية (يمكن توسيعه)
function estimatePriceAndTime(projectName, features) {
    let basePrice = 0;
    let baseDays = 0;
    let category = 'unknown';
    
    if (projectName.includes('بيتزا') || projectName.includes('مطعم')) {
        category = 'food_ordering';
        basePrice = 1500;
        baseDays = 5;
    } else if (projectName.includes('متجر') || projectName.includes('ecommerce')) {
        category = 'ecommerce';
        basePrice = 2000;
        baseDays = 7;
    } else if (projectName.includes('منصة سفر')) {
        category = 'travel';
        basePrice = 3500;
        baseDays = 10;
    } else {
        category = 'custom';
        basePrice = 1000;
        baseDays = 3;
    }
    
    // إضافة تكلفة الميزات الإضافية
    let extraCost = 0;
    let extraDays = 0;
    if (features.includes('دفع إلكتروني') || features.includes('payment')) {
        extraCost += 500;
        extraDays += 1;
    }
    if (features.includes('توصيل') || features.includes('delivery')) {
        extraCost += 300;
        extraDays += 1;
    }
    if (features.includes('تطبيق جوال') || features.includes('mobile app')) {
        extraCost += 2000;
        extraDays += 5;
    }
    if (features.includes('لوحة إدارة') || features.includes('admin')) {
        extraCost += 400;
        extraDays += 2;
    }
    
    return {
        category,
        estimatedPrice: basePrice + extraCost,
        estimatedDays: baseDays + extraDays,
        featuresBreakdown: { basePrice, extraCost }
    };
}

export async function generateSalesQuote(projectName, featuresList, userMessage) {
    // أولاً: تقدير باستخدام القواعد
    const estimation = estimatePriceAndTime(projectName.toLowerCase(), featuresList);
    
    // ثانياً: تحسين التقدير باستخدام Groq (للحالات المعقدة)
    const prompt = `أنت خبير مبيعات في مجال تطوير البرمجيات. بناءً على معلومات المشروع التالية، قدم عرض سعر احترافي باللغة العربية.
اسم المشروع: ${projectName}
الميزات المطلوبة: ${featuresList.join(', ')}
التقدير التلقائي: السعر التقريبي ${estimation.estimatedPrice} يورو، المدة التقريبية ${estimation.estimatedDays} أيام.

قم بإنشاء رد قصير ومهني يتضمن:
- تأكيد فهم المشروع.
- ذكر السعر التقريبي والمدة.
- اقتراح ميزات إضافية (upsell) إذا كان مناسباً (مثل تطبيق جوال، لوحة تحكم متقدمة).
- طلب تأكيد أو تفاصيل إضافية.

لا تكرر التحية.`;

    try {
        const response = await queryGroq(prompt, 0.6);
        return { reply: response, estimation };
    } catch (error) {
        // Fallback في حالة فشل AI
        return {
            reply: `بناءً على مشروع "${projectName}" والميزات المطلوبة (${featuresList.join(', ')}), التكلفة التقريبية تتراوح بين ${estimation.estimatedPrice} و ${estimation.estimatedPrice + 500} يورو، والمدة المتوقعة من ${estimation.estimatedDays} إلى ${estimation.estimatedDays + 2} يوم عمل. هل تريد إضافة ميزات مثل تطبيق جوال أو لوحة تحكم متقدمة؟`,
            estimation
        };
    }
}
