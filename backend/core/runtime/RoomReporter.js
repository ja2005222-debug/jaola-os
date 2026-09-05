/**
 * 📡 RoomReporter — بابُ البثّ الواحد من وقتِ التشغيل إلى غرفةِ المستخدم.
 *
 * ── لماذا وُجد
 *
 * قيسَ ترابطُ `JaolaCognitiveRuntime`: ٤٢٧ إشارةَ `this`، منها **٢٧٧ (٦٥٪)**
 * قناةُ بثٍّ واحدة — `this.io.to(roomName).emit(...)` في ١١٤ موضعاً بأحدَ
 * عشرَ حدثاً، و`emitLiveLog` في ١٥٣. فمعظمُ تشابكِ الصنف ليس حالةَ مجالٍ بل
 * أثراً عرضيّاً: كلُّ طريقةٍ تحتاج `this` لتبثّ. وهذا ما يجعل استخراجَ أيّ
 * طريقةٍ منه يجرّ الـsocket خلفَها.
 *
 * هذا الكائنُ **شقٌّ لا قطع**: واجهةٌ فوق `io` لا بديلٌ عنه — `io` يبقى في
 * وقتِ التشغيل لأنّه يُمرَّر **قيمةً** إلى تسعةِ نداءاتٍ خارجيّة (`autoPushIfEnabled`،
 * `deployToRender`) تبثّ بنفسها. الطريقةُ المستخرَجةُ لاحقاً تأخذ `reporter`
 * وسيطاً، لا `this`.
 *
 * ── حدُّ الطبقة
 *
 * `core/runtime` **لا يستورد** من `agents/` أو `services/` (حارسٌ صريح في
 * `tests/layerInversion.test.mjs`). فمُترجمُ السجلّ (`localizeLog` في
 * `agents/logLocalizer.js`) **يُحقَن** ولا يُستورد. الافتراضُ: هويّة.
 *
 * ── ما لا يفعله
 *
 * لا طرائقَ مسمّاةً لكلِّ حدث (`reply()`, `agentStates()`…): أحدَ عشرَ طريقةً
 * بلا مستهلكٍ يميّزها تجريدٌ بلا حاجة. `send(room, event, payload)` تنقل
 * النداءَ حرفيّاً — فالتغييرُ ميكانيكيٌّ ويُقاس بخطِّ أساسٍ مطابق.
 */
export class RoomReporter {
    /**
     * @param {{to:(room:string)=>{emit:(event:string, payload?:unknown)=>void}}} io
     * @param {{localize?:(message:string)=>string}} [deps]
     */
    constructor(io, { localize = (m) => m } = {}) {
        if (!io || typeof io.to !== 'function') throw new TypeError('RoomReporter: io.to(room).emit مطلوب');
        this.io = io;
        this.localize = localize;
        /** لغةُ كلِّ غرفة — كانت `this.roomLang` خريطةً كسولةً على وقتِ التشغيل. */
        this.roomLang = new Map();
    }

    setLang(room, lang) { if (room && lang) this.roomLang.set(room, lang); }
    langOf(room) { return this.roomLang.get(room); }

    /** النقلُ الحرفيّ لـ`io.to(room).emit(event, payload)`. */
    send(room, event, payload) { this.io.to(room).emit(event, payload); }

    /**
     * سجلُّ البناء الحيّ بلغة المستخدم — الترجمةُ في القمع الواحد (حتميّة،
     * شظايا ثابتة فقط؛ القيمُ المُقحَمة تبقى). العربيّةُ هي الأصل.
     */
    liveLog(room, layer, agent, message) {
        const msg = this.roomLang.get(room) === 'en' ? this.localize(message) : message;
        this.send(room, 'log', { message: `[${layer}] ➔ [${agent}]: ${msg}` });
    }
}
