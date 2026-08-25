// 🚦 بلاغ jaola.dev — «CORS: Origin غير مسموح: https://www.jaola.dev» يظهر
// في سجلّات الإنتاج كـ«Server Error» بـ500، لأن ALLOWED_ORIGINS لم يُحدَّث
// بعد ربط النطاق المخصّص. الخادم كان يرفض طلبات الموقع من نطاقه هو نفسه —
// <script type="module"> يرسل ترويسة Origin معيارياً فيُفحص ويُرمى. هذا لا
// يُصلح الخادم (المتغيّر بيئة يجب تحديثه يدوياً) لكنه يمنع رفضاً أمنياً
// متعمَّداً من الظهور كعطبٍ داخلي مبهم.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { isCorsRejection } from '../utils/corsErrors.js';

test('isCorsRejection: يميّز رسالة رفض CORS تحديداً', () => {
    assert.equal(isCorsRejection(new Error('CORS: Origin غير مسموح: https://www.jaola.dev')), true);
    assert.equal(isCorsRejection(new Error('عطب آخر تماماً')), false);
    assert.equal(isCorsRejection(new TypeError('Cannot read properties of undefined')), false);
    assert.equal(isCorsRejection(null), false);
    assert.equal(isCorsRejection(undefined), false);
    assert.equal(isCorsRejection({ message: 123 }), false);
});

// إعادة إنتاج البلاغ حرفياً: نفس بنية corsOptions/corsDelegate في server.js،
// مع معالج الأخطاء نفسه — نتحقق أن الرفض يصل 403 لا 500.
function buildApp(allowedOrigins) {
    const app = express();
    const corsOptions = {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) callback(null, true);
            else callback(new Error(`CORS: Origin غير مسموح: ${origin}`));
        },
        credentials: true,
    };
    app.use(cors((req, cb) => cb(null, corsOptions)));
    app.get('/assets/index-test.js', (req, res) => res.type('js').send('export {}'));
    app.use((err, req, res, next) => {
        if (isCorsRejection(err)) return res.status(403).json({ error: err.message });
        res.status(500).json({ error: 'خطأ داخلي في الخادم.' });
    });
    return app;
}

function request(server, { origin } = {}) {
    return new Promise((resolve, reject) => {
        const { port } = server.address();
        const opts = { host: '127.0.0.1', port, path: '/assets/index-test.js', method: 'GET' };
        if (origin) opts.headers = { Origin: origin };
        http.request(opts, (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject).end();
    });
}

test('نطاقٌ غير مُدرَج في ALLOWED_ORIGINS → 403 لا 500 (بلاغ الإنتاج بالضبط)', async () => {
    const app = buildApp(['https://jaola-os.onrender.com']); // www.jaola.dev غير مُدرَج عمداً — إعادة إنتاج البلاغ
    const server = app.listen(0);
    try {
        const res = await request(server, { origin: 'https://www.jaola.dev' });
        assert.equal(res.status, 403, 'رفضٌ أمني صريح، لا خطأ خادم عام');
        assert.match(res.body, /CORS/, 'الرسالة تسمّي السبب');
    } finally {
        server.close();
    }
});

test('نطاقٌ مُدرَج في ALLOWED_ORIGINS → 200 سليم', async () => {
    const app = buildApp(['https://www.jaola.dev']);
    const server = app.listen(0);
    try {
        const res = await request(server, { origin: 'https://www.jaola.dev' });
        assert.equal(res.status, 200);
    } finally {
        server.close();
    }
});

test('طلبٌ بلا ترويسة Origin (كـ<link> أو صورة) يمرّ دائماً بغضّ النظر عن القائمة', async () => {
    const app = buildApp(['https://jaola-os.onrender.com']);
    const server = app.listen(0);
    try {
        const res = await request(server, {});
        assert.equal(res.status, 200, 'لا Origin يعني غير مقيَّد بفحص CORS');
    } finally {
        server.close();
    }
});
