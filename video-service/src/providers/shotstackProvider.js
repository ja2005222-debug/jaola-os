/**
 * 🎥 shotstackProvider.js — محول Shotstack الحقيقي (خلف SHOTSTACK_API_KEY)
 *
 * ⚠️ لا يُستخدم إلا بضبط VIDEO_PROVIDER=shotstack + المفتاح صراحةً.
 * يبدأ دوماً ببيئة stage (المجانية، بعلامة مائية) — الانتقال لبيئة v1
 * (الإنتاج المدفوع) قرار صريح عبر SHOTSTACK_ENV=v1.
 *
 * ✅ مؤكَّد عملياً: أول تجميع حقيقي (لقطات + انتقال + فلتر لوني + موسيقى)
 * نجح على بيئة stage — صيغة الطلب/الرد أدناه (POST {env}/render برأس
 * x-api-key ثم GET {env}/render/{id}) صحيحة لهذه العناصر.
 *
 * ⚠️ غير مؤكَّد بعد: طبقة الشعار (logoUrl أدناه) تفترض أن أول مسار في
 * tracks يُرسم أعلى البقية (اصطلاح Shotstack الشائع) — لم تُختبر بلقطة
 * شعار حقيقية بعد؛ تحقّق من ظهوره فوق الفيديو لا خلفه في أول استخدام.
 *
 * ⚠️ غير مؤكَّد بعد أيضاً: مؤثرات الانتقال الصوتية (sfxUrl) — مبنية
 * بنفس صيغة clip الصوتي المؤكَّدة (asset:{type:'audio'}) لكن كمسار
 * منفصل متعدد المقاطع القصيرة بدل soundtrack واحد؛ تحقّق أنها تُسمع
 * فعلياً عند كل انتقال ولا تتداخل بصوت مشوَّه مع الموسيقى.
 *
 * ⚠️ وكذلك التعليق الصوتي (narrationUrl، توليد fal.ai): مسار صوتي
 * ثالث بمقطع واحد يمتد طوال الفيلم — تحقّق من مزجه مع الموسيقى دون
 * تشويش (فارق مستوى الصوت بين المتحدث والموسيقى مسؤولية صاحب
 * المنصة عبر اختيار مقطع موسيقي هادئ، لا تحكّماً تلقائياً هنا).
 *
 * ⚠️ دقة الإخراج (spec.resolution): 'hd' مؤكَّدة (أعلاه)؛ القيم الأخرى
 * ('sd'، '1080'، '4k') من كتالوج Shotstack الموثَّق تاريخياً لنفس
 * الحقل لكن غير مجرَّبة من هذه الخدمة تحديداً — رفضها الآن يظهر
 * بتفصيل رد Shotstack كاملاً (لا HTTP فارغ)، فأي قيمة خاطئة تُكتشف
 * فوراً من أول محاولة حقيقية بدل فشل صامت.
 *
 * ⚠️ العلامة المائية (spec.watermarkText، تُفرض للخطة المجانية فقط):
 * حقل opacity على مستوى الـclip غير مجرَّب من هذه الخدمة تحديداً —
 * تحقّق أنه يُخفِّف شفافية النص فعلياً لا يُرفض/يُتجاهل صامتاً.
 */

const SCENE_TRANSITION = { in: 'fade', out: 'fade' };

/** يترجم المخطط المحايد (compileSpec) إلى timeline بصيغة Shotstack. */
export function specToShotstackTimeline(spec) {
    // انتقال المخطط (التجميع) إن حُدد، وإلا الافتراضي
    const transition = spec.transition
        ? { in: spec.transition, out: spec.transition }
        : SCENE_TRANSITION;
    const clips = [];
    for (const scene of spec.scenes) {
        for (const layer of scene.layers) {
            if (layer.kind === 'title' || layer.kind === 'text') {
                clips.push({
                    asset: {
                        type: 'title',
                        text: layer.text,
                        style: 'minimal',
                        size: layer.kind === 'title' ? 'large' : 'small',
                    },
                    start: scene.startSec,
                    length: scene.lengthSec,
                    transition,
                });
            } else if (layer.kind === 'image') {
                clips.push({
                    asset: { type: 'image', src: layer.url },
                    start: scene.startSec,
                    length: scene.lengthSec,
                    fit: 'contain',
                    transition,
                });
            } else if (layer.kind === 'video') {
                // تجميع الفيلم: لقطة فيديو مولَّدة تُضم للخط الزمني
                clips.push({
                    asset: { type: 'video', src: layer.url },
                    start: scene.startSec,
                    length: scene.lengthSec,
                    fit: 'contain',
                    transition,
                    // فلتر ما بعد الإنتاج اللوني (إن حُدد) — على اللقطات فقط
                    ...(spec.filter ? { filter: spec.filter } : {}),
                });
            }
        }
    }
    const timeline = {
        background: spec.background,
        tracks: [{ clips }],
    };
    // شعار المستخدم — مسار منفصل يُضاف **أولاً** (أعلى البقية) طوال
    // مدة الفيلم، في الزاوية العلوية اليمنى بحجم صغير غير مزعج.
    if (spec.logoUrl) {
        timeline.tracks.unshift({
            clips: [{
                asset: { type: 'image', src: spec.logoUrl },
                start: 0,
                length: spec.durationSec,
                position: 'topRight',
                scale: 0.15,
                offset: { x: -0.03, y: 0.03 },
            }],
        });
    }
    // علامة مائية للخطة المجانية — يفرضها الخادم وحده (server.js)، لا
    // خياراً يختاره المستخدم. زاوية مقابلة للشعار (سفلى يسرى) فلا تتداخل
    // معه؛ ⚠️ opacity على مستوى الـclip غير مؤكَّد عملياً بعد من هذه
    // الخدمة تحديداً (خلافاً لبقية حقول الشعار/العنوان المؤكَّدة أعلاه).
    if (spec.watermarkText) {
        timeline.tracks.unshift({
            clips: [{
                asset: { type: 'title', text: spec.watermarkText, style: 'minimal', size: 'small' },
                start: 0,
                length: spec.durationSec,
                position: 'bottomLeft',
                opacity: 0.6,
            }],
        });
    }
    // مؤثر صوتي عند كل نقطة انتقال بين المشاهد — مسار صوتي منفصل قصير
    // المقاطع، لا يتعارض مع مسار الفيديو أو الموسيقى التصويرية.
    if (spec.sfxUrl && Array.isArray(spec.sceneStarts)) {
        timeline.tracks.push({
            clips: spec.sceneStarts.map(startSec => ({
                asset: { type: 'audio', src: spec.sfxUrl },
                start: startSec,
                length: 1,
            })),
        });
    }
    // تعليق صوتي (TTS) يمتد طوال الفيلم — مسار منفصل عن الموسيقى/المؤثرات.
    if (spec.narrationUrl) {
        timeline.tracks.push({
            clips: [{
                asset: { type: 'audio', src: spec.narrationUrl },
                start: 0,
                length: spec.durationSec,
            }],
        });
    }
    // موسيقى تصويرية (التجميع) — تتلاشى مع النهاية
    if (spec.soundtrackUrl) {
        timeline.soundtrack = { src: spec.soundtrackUrl, effect: 'fadeOut' };
    }
    return timeline;
}

export function createShotstackProvider({ apiKey, env = 'stage', fetchImpl = fetch } = {}) {
    if (!apiKey) throw new Error('SHOTSTACK_API_KEY مطلوب لمزود shotstack.');
    if (!['stage', 'v1'].includes(env)) throw new Error(`بيئة Shotstack غير معروفة: ${env}`);
    const baseUrl = `https://api.shotstack.io/${env}`;
    const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };

    return {
        name: `shotstack-${env}`,
        specKinds: ['timeline'],

        async submitRender(spec) {
            if (spec?.kind && spec.kind !== 'timeline') {
                throw new Error(`Shotstack لا يدعم هذا النوع من المخططات: ${spec.kind}`);
            }
            const output = { format: 'mp4', resolution: spec?.resolution || 'hd' };
            // مقاس المنصة (ريلز 9:16 / بوست 1:1) — الافتراضي 16:9
            if (spec?.aspectRatio && spec.aspectRatio !== '16:9') {
                output.aspectRatio = spec.aspectRatio;
            }
            const body = {
                timeline: specToShotstackTimeline(spec),
                output,
            };
            const res = await fetchImpl(`${baseUrl}/render`, {
                method: 'POST', headers, body: JSON.stringify(body),
            });
            if (!res.ok) {
                // التفاصيل هي التشخيص كله (مثلاً قيمة resolution مرفوضة) —
                // تُعرض ولا تُبتلع، نفس درس fal.ai في هذه الخدمة.
                const detail = await res.text().catch(() => '');
                throw new Error(`Shotstack رفض الإرسال (HTTP ${res.status}). ${detail.slice(0, 300)}`);
            }
            const data = await res.json();
            const providerId = data?.response?.id;
            if (!providerId) throw new Error('Shotstack لم يُرجع معرف تصدير.');
            return { providerId };
        },

        async getRender(providerId) {
            const res = await fetchImpl(`${baseUrl}/render/${providerId}`, { headers });
            // خطأ المصادقة ليس عابراً (مفتاح باطل/حساب موقوف) — إفشال فوري
            // مع استرداد بدل تعليق المهمة حتى المهلة القصوى (نفس درس fal).
            if (res.status === 401 || res.status === 403) {
                return {
                    status: 'failed',
                    error: `Shotstack رفض الاستطلاع (HTTP ${res.status}) — تحقق من المفتاح/الحساب.`,
                };
            }
            if (!res.ok) {
                // فشل الاستطلاع العابر (5xx/شبكة) ليس فشل التصدير — نُبقي
                // المهمة قيد المعالجة ويحسمها الاستطلاع التالي أو المهلة.
                return { status: 'rendering' };
            }
            const data = await res.json();
            const status = data?.response?.status;
            if (status === 'done') {
                return { status: 'done', videoUrl: data.response.url || null };
            }
            if (status === 'failed') {
                return { status: 'failed', error: data?.response?.error || 'فشل التصدير لدى Shotstack.' };
            }
            // queued / fetching / rendering / saving — كلها "ما زال يعمل".
            return { status: 'rendering' };
        },
    };
}
