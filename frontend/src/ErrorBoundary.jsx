import { Component } from 'react'
import { isChunkLoadError, reloadOnceForStaleChunk } from './chunkReload'

/**
 * 🛡️ حدّ الأخطاء — الحاجز بين «خطأ في صفحة» و«صفحة بيضاء صامتة».
 *
 * ⚠️ درس إنتاجي (٢٥ أغسطس ٢٠٢٦): كان `<Suspense>` في App.jsx بلا حدّ أخطاء،
 * وكل صفحات التطبيق تُحمَّل بـ`lazy()` (تقسيم الحزمة). حين يفشل جلب حزمة
 * صفحةٍ ما، يرمي React أثناء الرسم، وبلا حدّ أخطاء **تُفرَّغ الشجرة كلها** —
 * فيرى الزائر بياضاً تاماً مع بقاء عنوان التبويب (لأنه من index.html
 * الثابت، بينما `document.title` لا يُضبط إلا داخل تأثيرٍ لم يُنفَّذ قط).
 * بلاغ المالك عن jaola.dev كان بهذا الوصف حرفياً.
 *
 * السبب الأشيع لفشل الجلب: **حزمة متقادمة**. المتصفح يحمل index.html قديماً
 * (أو تبويباً مفتوحاً منذ ما قبل النشر) يشير إلى `index-<hash>.js` لم يعد
 * موجوداً على الخادم؛ وكِلا الخادمين هنا (backend/server.js وvercel.json)
 * يردّان index.html على أي مسار غير معروف بدل 404 — فيصل للمتصفح HTML
 * بترويسة `text/html` مكان وحدة جافاسكربت، فيرفض تنفيذها.
 *
 * العلاج هنا طبقتان:
 *  1. فشل تحميل حزمة → إعادة تحميل **واحدة** محروسة بـsessionStorage
 *     (تجلب index.html الطازج بأسماء الحزم الصحيحة). الحراسة تمنع حلقة
 *     إعادة تحميل لا نهائية إن كان العطب دائماً لا متقادماً.
 *  2. أي خطأ آخر (أو فشل مستمر بعد الإعادة) → بطاقة خطأ مرئية بزرّ
 *     إعادة المحاولة ونصّ الخطأ الخام. صفحة تشرح نفسها خيرٌ من بياض.
 */

const boxStyle = {
    minHeight: '100dvh', background: '#050810', color: '#e2e8f0', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 24,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
}

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null, reloading: false }
    }

    static getDerivedStateFromError(error) {
        // حزمة متقادمة؟ أعد التحميل مرة واحدة بدل عرض خطأ لا يعني الزائر شيئاً.
        if (isChunkLoadError(error) && reloadOnceForStaleChunk()) {
            return { error, reloading: true }
        }
        return { error, reloading: false }
    }

    componentDidCatch(error, info) {
        console.error('[JAOLA] انهيار في الواجهة:', error, info?.componentStack)
    }

    render() {
        const { error, reloading } = this.state
        if (!error) return this.props.children
        if (reloading) return <div style={boxStyle} />

        return (
            <div style={boxStyle} dir="rtl">
                <div style={{ maxWidth: 520, textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                    <h1 style={{ fontSize: 20, margin: '0 0 10px' }}>
                        تعذّر تحميل الصفحة
                        <span style={{ display: 'block', fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                            Something went wrong while loading this page
                        </span>
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.8, margin: '0 0 18px' }}>
                        {isChunkLoadError(error)
                            ? 'يبدو أن نسخةً محدّثة من الموقع نُشرت للتو. أعد التحميل للحصول عليها.'
                            : 'حدث خطأ غير متوقع. أعد المحاولة، وإن تكرر فأبلغنا بالنص أدناه.'}
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                            background: '#3b82f6', color: '#fff', border: 0, borderRadius: 10,
                            padding: '10px 22px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        إعادة التحميل — Reload
                    </button>
                    <pre style={{
                        marginTop: 18, textAlign: 'left', direction: 'ltr', fontSize: 11, color: '#64748b',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflow: 'auto',
                    }}>{String(error?.message || error)}</pre>
                </div>
            </div>
        )
    }
}
