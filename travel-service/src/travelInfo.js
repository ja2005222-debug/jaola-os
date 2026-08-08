/**
 * 🌤️💱 travelInfo.js — معلومات وفيرة حقيقية: طقس الوجهة + تحويل عملات
 *
 * كلا المصدرين مجاني وبلا مفتاح تسجيل إطلاقاً (تأكَّد بحثاً قبل الاختيار):
 *   - Open-Meteo (طقس): https://api.open-meteo.com — لا مفتاح، لا حد معلَن صارم.
 *   - Frankfurter (عملات): https://api.frankfurter.dev — بيانات البنك المركزي
 *     الأوروبي، لا مفتاح، تحديث يومي أيام العمل.
 *
 * ⚠️ صيغ الاستدعاء أدناه من التوثيق العام المنشور لكلا المصدرين — لم
 * تُجرَّبا ضد الشبكة الحية من بيئة التطوير هذه (بروتوكول الوكيل هنا يحجب
 * نطاقات جديدة بسياسة تنظيمية، لا علاقة له بصحة الصيغة). نفس صراحة
 * duffelProvider.js/duffelStaysProvider.js بالضبط: أول تشغيل فعلي على
 * الخادم المنشور هو الاختبار الحقيقي، وأي خطأ يظهر برسالة واضحة لا فشلاً
 * صامتاً — executeAgentTool يلتقطه ويرجعه للنموذج كرسالة تعليمية.
 */
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const CURRENCY_URL = 'https://api.frankfurter.dev/v1/latest';
const MAX_FORECAST_DAYS_AHEAD = 16; // أفق التوقعات المجانية النموذجي لدى Open-Meteo

/** يجلب توقعات طقس يومية (حرارة عليا/دنيا + هطول) لإحداثيات ومدى تاريخ. */
export async function getDestinationWeather({ lat, lon, dateFrom, dateTo, fetchImpl = fetch }) {
    const url = new URL(WEATHER_URL);
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('start_date', dateFrom);
    url.searchParams.set('end_date', dateTo);

    const res = await fetchImpl(url.toString());
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`تعذّر جلب توقعات الطقس (HTTP ${res.status}). ${detail.slice(0, 200)}`);
    }
    const payload = await res.json();
    const daily = payload.daily;
    if (!daily || !Array.isArray(daily.time)) {
        throw new Error('رد مزوّد الطقس بلا بيانات يومية.');
    }
    return daily.time.map((date, i) => ({
        date,
        maxTempC: daily.temperature_2m_max?.[i] ?? null,
        minTempC: daily.temperature_2m_min?.[i] ?? null,
        precipitationMm: daily.precipitation_sum?.[i] ?? null,
    }));
}

/** يحوّل مبلغاً بسعر صرف حقيقي (base+symbols → معدّل واحد نضربه بالمبلغ). */
export async function convertCurrency({ amount, from, to, fetchImpl = fetch }) {
    const url = new URL(CURRENCY_URL);
    url.searchParams.set('base', from);
    url.searchParams.set('symbols', to);

    const res = await fetchImpl(url.toString());
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`تعذّر جلب سعر الصرف (HTTP ${res.status}). ${detail.slice(0, 200)}`);
    }
    const payload = await res.json();
    const rate = payload.rates?.[to];
    if (!Number.isFinite(rate)) {
        throw new Error(`لا سعر صرف متاح لـ${from}→${to} — تحقق من رمزَي العملة.`);
    }
    return {
        amount, from, to, rate,
        converted: Math.round(amount * rate * 100) / 100,
        date: payload.date || null,
    };
}

export { MAX_FORECAST_DAYS_AHEAD };
