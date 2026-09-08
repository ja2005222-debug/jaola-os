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
/** حدّا الشريط: أسطرٌ لكلِّ غرفة، وغرفٌ محفوظة — ذاكرةٌ لا قرص، فالحدُّ لازم. */
const LOG_TAPE = 200;
const TAPED_ROOMS = 50;

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
        /** شريطُ آخرِ أسطرِ السجلّ لكلِّ غرفة — يُستعاد لمن عاد (انظر `recentLogs`). */
        this.roomLogs = new Map();
    }

    setLang(room, lang) { if (room && lang) this.roomLang.set(room, lang); }
    langOf(room) { return this.roomLang.get(room); }

    /**
     * النقلُ الحرفيّ لـ`io.to(room).emit(event, payload)` — ويُسجَّل السجلُّ في شريطه.
     *
     * 🔴 قِيس: `Socket.IO` يبثّ **لحظةً**، فمن أعاد تحميلَ الصفحة أثناء البناء يعود إلى
     *    سجلٍّ فارغ بينما المهمّةُ ماضيةٌ على الخادم — لا لأنّها سقطت، بل لأنّ ما مضى لم
     *    يُحفَظ. (وخبرُ المهمّة الختاميُّ صار باقياً في `rememberMissionNote`؛ أمّا مسارُ
     *    البناء نفسُه فلا.) والتسجيلُ هنا لأنّ هذا **بابُ البثّ الواحد**: `liveLog` تمرّ
     *    به، وكذلك كلُّ `send(room, 'log', …)`.
     */
    send(room, event, payload) {
        if (event === 'log' && room) this.tapeLog(room, payload);
        this.io.to(room).emit(event, payload);
    }

    /**
     * يُقيّد سطرَ سجلٍّ في شريط غرفته. حدّان مقصودان لأنّ هذا في الذاكرة:
     * `LOG_TAPE` سطراً لكلِّ غرفة، و`TAPED_ROOMS` غرفةً بإخراج الأقدم — فلا ينمو بلا حدّ
     * على خادمٍ طويل العمر.
     */
    tapeLog(room, payload) {
        let tape = this.roomLogs.get(room);
        if (!tape) {
            if (this.roomLogs.size >= TAPED_ROOMS) this.roomLogs.delete(this.roomLogs.keys().next().value);
            tape = [];
            this.roomLogs.set(room, tape);
        }
        tape.push(payload);
        if (tape.length > LOG_TAPE) tape.splice(0, tape.length - LOG_TAPE);
    }

    /**
     * آخرُ ما بُثّ في الغرفة — نسخةٌ لا مرجع. يستعملها `server.js` عند الانضمام
     * فيرى العائدُ ما فاته بدل شاشةٍ فارغة.
     *
     * حدٌّ مكتوب: يلتقط ما مرّ **بهذا الباب** وحدَه. و`deployAgent`/`renderAgent`/
     * `githubSync` تتلقّى `io` قيمةً وتبثّ بنفسها (وهو ما تشرحه ترويسةُ هذا الملفّ)،
     * فأسطرُها لا تُقيَّد. سجلُّ البناء — وهو ما يُتابَع أثناء المهمّة — يُقيَّد كلُّه.
     * وشريطٌ في الذاكرة: يبقى لإعادة تحميل الصفحة، ولا يبقى لإعادة تشغيل الخادم.
     */
    recentLogs(room) { return [...(this.roomLogs.get(room) || [])]; }

    /**
     * سجلُّ البناء الحيّ بلغة المستخدم — الترجمةُ في القمع الواحد (حتميّة،
     * شظايا ثابتة فقط؛ القيمُ المُقحَمة تبقى). العربيّةُ هي الأصل.
     */
    liveLog(room, layer, agent, message) {
        const msg = this.roomLang.get(room) === 'en' ? this.localize(message) : message;
        this.send(room, 'log', { message: `[${layer}] ➔ [${agent}]: ${msg}` });
    }
}
