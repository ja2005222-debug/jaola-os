/**
 * 🔇 كتمُ سجلّ الإنتاج داخل ابن `node --test` — Sprint 3j
 *
 * 🔴 الآليّة، مقيسةً لا مُفترَضة: مشغّلُ اختبارات Node يمرّر ما يطبعه الابنُ
 *    عبر **قناة التقرير نفسها** (V8-serialized على stdout). ومع الحِمل تنكسر
 *    أُطُرُ الرسائل عند المحارف متعددة البايت، فيسقط الملفّ كلُّه بـ
 *    `Unable to deserialize cloned data` — لا اختبارٌ واحد بل الملفّ.
 *
 *    تجربةٌ ضابطة، بنيةٌ واحدة وحجمٌ واحد، ٢٤ تشغيلاً متزامناً لكلٍّ:
 *      console.log لاتينيٌّ بحت         → ٠/٢٤
 *      console.log فيه إيموجي وعربية   → ١٢/٢٤
 *
 *    وسجلُّ هذا المستودع عربيٌّ كلُّه («💳 [Billing] تحديث اشتراك …»)، فكلُّ
 *    اختبارٍ يُشغّل كوداً يطبع هو لغمٌ حتى يُكتَم. وحارسُ #487
 *    (`stdoutChannel.test.mjs`) يضمن صمتَ **الاستيراد** لا صمتَ التشغيل.
 *
 * لا يُخفي الكتمُ شيئاً: السطورُ تُجمَع في `lines` فيمكن التأكيد عليها.
 */

const KEYS = ['log', 'warn', 'error', 'info', 'debug'];

export function quietConsole() {
    const real = {};
    const lines = [];
    for (const k of KEYS) {
        real[k] = console[k];
        console[k] = (...args) => { lines.push(args.map(String).join(' ')); };
    }
    return {
        lines,
        restore() { for (const k of KEYS) console[k] = real[k]; },
    };
}
