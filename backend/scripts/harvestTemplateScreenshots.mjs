/**
 * 🖼️ حصاد لقطات القوالب — يبني كلوناً فعلياً ويصوّره بمتصفح حقيقي (Playwright)
 * ويحفظه في frontend/public/templates/{id}.jpg (+ en/{id}.jpg).
 *
 * أداة تطوير فقط (ليست جزءاً من تشغيل الخادم) — تتطلب Playwright مثبّتاً
 * (متاح هنا عبر NODE_PATH لتثبيت عام؛ لا يُضاف كاعتمادية إنتاج).
 * الاستخدام: node --experimental-vm-modules scripts/harvestTemplateScreenshots.mjs jaola-erp jaola-hr ...
 * بلا وسائط = يحصد كل القوالب المذكورة في MISSING أدناه.
 */
import { getCloneById } from '../agents/cloneTemplates/index.js';
import { localizeTemplateFiles } from '../agents/templateLocalizer.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../frontend/public/templates');
// playwright أداة تطوير عامة (غير مضافة كاعتمادية إنتاج) — تُحمَّل بمسارها
// المطلق (متاحة عبر PLAYWRIGHT_PKG_DIR في هذه البيئة) بدل import عادي.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG_DIR || 'playwright');

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

function serveDir(dir) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let p = decodeURIComponent((req.url || '/').split('?')[0]);
            if (p === '/') p = '/index.html';
            const file = path.join(dir, p);
            if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
            fs.readFile(file, (err, data) => {
                if (err) { res.writeHead(404); return res.end(); }
                res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

async function harvestOne(id, browser) {
    const c = getCloneById(id);
    if (!c) { console.error('✗ لم يُعثر على القالب:', id); return; }
    for (const lang of ['ar', 'en']) {
        const files = localizeTemplateFiles(c.files, lang);
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-shot-'));
        try {
            for (const f of files) {
                const fp = path.join(dir, f.name);
                fs.mkdirSync(path.dirname(fp), { recursive: true });
                fs.writeFileSync(fp, f.content);
            }
            const server = await serveDir(dir);
            const port = server.address().port;
            const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
            try {
                await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle', timeout: 20000 });
                await page.waitForTimeout(500);
                // قوالب «السيستم» تفتح على شاشة دخول — الدخول التجريبي (admin) يكشف
                // اللوحة الفعلية بدل تصوير شاشة دخول فارغة من البيانات.
                const passField = page.locator('#loginPass');
                if (await passField.count()) {
                    await passField.fill('admin');
                    await page.locator('[data-action="login"]').first().click();
                    await page.waitForTimeout(600);
                }
                const outPath = lang === 'ar'
                    ? path.join(OUT_DIR, `${id}.jpg`)
                    : path.join(OUT_DIR, 'en', `${id}.jpg`);
                await page.screenshot({ path: outPath, type: 'jpeg', quality: 82 });
                console.log('✓', outPath);
            } finally {
                await page.close();
                server.close();
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
}

const MISSING = [
    'jaola-accounting', 'jaola-carrental', 'jaola-cinema', 'jaola-cleaning', 'jaola-clinic',
    'jaola-coworking', 'jaola-erp', 'jaola-fleet', 'jaola-gym', 'jaola-helpdesk', 'jaola-hotel',
    'jaola-hr', 'jaola-laundry', 'jaola-lawfirm', 'jaola-pharmacy', 'jaola-photography', 'jaola-pos',
    'jaola-property', 'jaola-restaurant-ops', 'jaola-salon', 'jaola-tutoring', 'jaola-vetclinic',
    'jaola-vetclinic-react', 'jaola-warehouse', 'jaola-workshop',
];

const ids = process.argv.slice(2);
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
    try {
        for (const id of (ids.length ? ids : MISSING)) await harvestOne(id, browser);
    } finally {
        await browser.close();
    }
})();
