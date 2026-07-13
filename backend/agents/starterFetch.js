/**
 * 📥 Starter Fetch — جلب قوالب حقيقية من GitHub لاستخدامها كأساس
 *
 * الخطوة الأخيرة من المسار الهجين (JAOLA Marketplace): بدل توليد سكافولد فقط،
 * نجلب **الكود الفعلي** لقالب موثوق (من STARTERS المرخّصة MIT) عبر GitHub API
 * ليُنزَّل/يُخصَّص/يُنشَر. الجلب بحدود آمنة صارمة:
 *   • نصوص فقط (نتجاوز الصور/الخطوط/الثنائيات)   • سقف عدد الملفات
 *   • سقف بايتات لكل ملف وللمجموع              • تجاهل node_modules/.git وغيرها
 *
 * قابل للاختبار: نحقن `fetchImpl` (الشبكة لـ GitHub محجوبة في بيئة البناء)،
 * فنتحقّق من تحليل الرابط + تصفية الشجرة + الحدود + البنية بحاقن fetch.
 *
 * ملاحظة صادقة: استنساخ مستودع ضخم (vercel/commerce) وتشغيله حيّاً غير واقعي —
 * يحتاج بيئة/APIs/build. الجالب يجلب الكود الحقيقي للتنزيل/النشر/التخصيص،
 * لا معاينة حيّة لتطبيق معقّد. القوالب الخفيفة (Precedent) تُجلب كاملة.
 */

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';

// امتدادات نصية مسموحة (نتجاوز الثنائيات كي لا نفسد المحتوى أو نتجاوز الحدود)
const TEXT_EXT = new Set([
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'md', 'mdx', 'txt',
    'css', 'scss', 'sass', 'less', 'html', 'htm', 'xml', 'svg', 'yml', 'yaml',
    'toml', 'env', 'gitignore', 'npmrc', 'editorconfig', 'prettierrc', 'eslintrc',
    'sh', 'bash', 'graphql', 'gql', 'prisma', 'vue', 'astro', 'sql', 'lock',
]);

// مجلدات/ملفات لا نجلبها أبداً (ضخمة أو غير ذات صلة أو حسّاسة)
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|dist|build|out|coverage|\.vercel|\.turbo|\.cache|vendor)(\/|$)/;
const SKIP_FILE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.env(\.[\w-]+)?)$/;

const DEFAULTS = { ref: 'HEAD', maxFiles: 120, maxBytes: 1_500_000, maxFileBytes: 200_000 };

/**
 * يحلّل رابط/معرّف مستودع GitHub إلى { owner, repo }.
 * يقبل: "owner/repo" · روابط https/git · بلاحقة .git · بمسار فرعي.
 * @returns {{owner:string, repo:string}}
 */
export function parseRepoUrl(input) {
    const s = String(input || '').trim();
    if (!s) throw new Error('رابط المستودع مطلوب');

    let owner, repo;
    const url = s
        .replace(/^git@github\.com:/i, 'https://github.com/')
        .replace(/^git\+/i, '');
    const m = url.match(/github\.com[/:]([\w.\-]+)\/([\w.\-]+)/i);
    if (m) {
        owner = m[1];
        repo = m[2];
    } else {
        const parts = s.split('/').filter(Boolean);
        if (parts.length >= 2) { owner = parts[0]; repo = parts[1]; }
    }
    if (!owner || !repo) throw new Error(`تعذّر تحليل رابط المستودع: ${s}`);
    repo = repo.replace(/\.git$/i, '');
    if (!/^[\w.\-]+$/.test(owner) || !/^[\w.\-]+$/.test(repo)) {
        throw new Error('اسم مالك/مستودع غير صالح');
    }
    return { owner, repo };
}

function extOf(path) {
    const base = path.split('/').pop() || '';
    if (base.startsWith('.')) return base.slice(1).toLowerCase();     // .gitignore → gitignore
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** هل هذا الملف نصّي مسموح وليس ضمن المتجاوَزات؟ */
function isWantedFile(path, size, maxFileBytes) {
    if (SKIP_DIR.test(path) || SKIP_FILE.test(path)) return false;
    if (typeof size === 'number' && size > maxFileBytes) return false;
    const ext = extOf(path);
    return TEXT_EXT.has(ext);
}

function ghHeaders(token) {
    const h = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'jaola-os',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

/**
 * يجلب ملفات مستودع نصّية عبر Trees API (recursive) + المحتوى الخام.
 * @param {string} owner
 * @param {string} repo
 * @param {object} opts
 * @param {string} [opts.ref='HEAD']
 * @param {string} [opts.token]         توكن GitHub (يرفع الحدّ ويصل للخاص)
 * @param {number} [opts.maxFiles]
 * @param {number} [opts.maxBytes]      سقف مجموع البايتات المجلوبة
 * @param {number} [opts.maxFileBytes]  سقف بايتات الملف الواحد
 * @param {Function} [opts.fetchImpl=fetch]  حاقن للاختبار
 * @returns {Promise<{ files:{name,content}[], meta:{owner,repo,ref,truncated,skipped,totalBytes,count} }>}
 */
export async function fetchRepoFiles(owner, repo, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const fetchImpl = opts.fetchImpl || fetch;
    if (typeof fetchImpl !== 'function') throw new Error('fetchImpl غير متاح');

    // 1) شجرة المستودع كاملة (recursive)
    const treeUrl = `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(o.ref)}?recursive=1`;
    const treeRes = await fetchImpl(treeUrl, { headers: ghHeaders(o.token) });
    if (!treeRes.ok) {
        const err = new Error(`تعذّر جلب شجرة ${owner}/${repo} (${treeRes.status})`);
        err.status = treeRes.status;
        throw err;
    }
    const tree = await treeRes.json();
    const blobs = (tree.tree || []).filter((n) => n.type === 'blob');

    // 2) رتّب المرشّحين (نصوص فقط ضمن الحدود) — الجذور والإعدادات أولاً
    const wanted = blobs
        .filter((b) => isWantedFile(b.path, b.size, o.maxFileBytes))
        .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));

    // 3) اجلب المحتوى الخام ضمن سقوف العدد والبايتات
    const files = [];
    let totalBytes = 0;
    let skipped = 0;
    for (const b of wanted) {
        if (files.length >= o.maxFiles) { skipped++; continue; }
        if (totalBytes >= o.maxBytes) { skipped++; continue; }
        const rawUrl = `${RAW}/${owner}/${repo}/${o.ref}/${b.path.split('/').map(encodeURIComponent).join('/')}`;
        let content;
        try {
            const r = await fetchImpl(rawUrl, { headers: ghHeaders(o.token) });
            if (!r.ok) { skipped++; continue; }
            content = await r.text();
        } catch {
            skipped++;
            continue;
        }
        const bytes = Buffer.byteLength(content, 'utf8');
        if (bytes > o.maxFileBytes) { skipped++; continue; }
        if (totalBytes + bytes > o.maxBytes) { skipped++; continue; }
        totalBytes += bytes;
        files.push({ name: b.path, content });
    }

    return {
        files,
        meta: {
            owner, repo, ref: o.ref,
            truncated: !!tree.truncated,
            skipped,
            totalBytes,
            count: files.length,
        },
    };
}

/**
 * يجلب قالباً من سجلّ STARTERS بمعرّفه (يستخدم repo الحقيقي المرخّص MIT).
 * @param {object} starter  عنصر من STARTERS (يحوي repo)
 * @param {object} opts      يُمرَّر إلى fetchRepoFiles (token, fetchImpl, الحدود)
 */
export async function fetchStarter(starter, opts = {}) {
    if (!starter || !starter.repo) {
        throw new Error('هذا القالب داخليّ (Vanilla) ولا يُجلب من GitHub — يُولّده JAOLA مباشرة.');
    }
    const { owner, repo } = parseRepoUrl(starter.repo);
    const result = await fetchRepoFiles(owner, repo, opts);
    return { ...result, starter: { id: starter.id, name: starter.name, license: starter.license, repo: starter.repo } };
}
