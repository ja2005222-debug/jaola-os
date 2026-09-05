/**
 * 🐙 GitHub Files — JAOLA OS
 *
 * قراءة/تصفّح/تعديل/رفع ملفات مستودعات المستخدم عبر GitHub REST API
 * باستخدام توكن OAuth المخزّن مشفّراً. تُستدعى من مسارات الأدمِن فقط.
 */

import { fetchWithTimeout, TIMEOUTS } from './httpRetry.js';

const API = 'https://api.github.com';

async function gh(token, urlPath, opts = {}) {
    const res = await fetchWithTimeout(`${API}${urlPath}`, {
        ...opts,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'jaola-os',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
            ...(opts.headers || {}),
        },
    }, TIMEOUTS.api);
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
        const msg = data?.message || `GitHub API ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
    }
    return data;
}

/**
 * قائمة مستودعات المستخدم (يملكها أو متعاون فيها).
 *
 * 🔴 كانت صفحةً واحدة (`per_page=100`) تُعرض على أنّها «قائمة مستودعات
 *    المستخدم». فمن له أكثرُ من مئة لا يجد مستودعَه في المتصفّح، ولا شيء
 *    يقول له إنّ القائمةَ مبتورة — يقرؤها «ليس لي هذا المستودع».
 *
 * @returns {Promise<{repos: object[], truncated: boolean}>}
 */
export async function listRepos(token, { maxPages = 5 } = {}) {
    const repos = [];
    let truncated = false;
    for (let page = 1; page <= maxPages; page++) {
        const batch = await gh(token,
            `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator`);
        if (!Array.isArray(batch) || batch.length === 0) break;
        for (const r of batch) {
            repos.push({
                fullName: r.full_name,
                name: r.name,
                private: r.private,
                defaultBranch: r.default_branch,
                updatedAt: r.updated_at,
                permissions: r.permissions || {},
            });
        }
        if (batch.length < 100) break;
        if (page === maxPages) truncated = true;   // بلغنا السقف ولم تنتهِ
    }
    return { repos, truncated };
}

/** محتويات مجلد داخل مستودع (ملفات ومجلدات) */
export async function listContents(token, fullName, dirPath = '') {
    const clean = (dirPath || '').replace(/^\/+|\/+$/g, '');
    const url = `/repos/${fullName}/contents/${encodeURIComponent(clean).replace(/%2F/g, '/')}`;
    const items = await gh(token, url);
    if (!Array.isArray(items)) {
        // ملف مفرد وليس مجلداً
        return [{ name: items.name, path: items.path, type: items.type, sha: items.sha, size: items.size }];
    }
    return items
        .map((i) => ({ name: i.name, path: i.path, type: i.type, sha: i.sha, size: i.size }))
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

function unsupported(message, reason) {
    const err = new Error(message);
    err.status = 415;     // Unsupported Media Type — ليس خطأَ الشبكة ولا خطأَ إذن
    err.reason = reason;
    return err;
}

/**
 * قراءة ملف — يُرجع المحتوى النصي و sha (لازم للتعديل).
 *
 * محرّرُ اللوحة يضع ما يعود هنا في مربّع نصّ، ثمّ يكتبه `putFile` في مستودع
 * المستخدم. فكلُّ ما يعود من هنا ادّعاءٌ بأنّه «نصُّ الملف» — وكان يكذب في
 * حالتين، وكلتاهما تُتلف الملفَ عند الحفظ:
 *
 * 🔴 ١) ملفٌّ ثنائيّ (صورة، خطّ): `toString('utf8')` يُخرج محارفَ استبدال.
 *      قياسٌ حقيقيٌّ على واجهة GitHub الحيّة، `apple-touch-icon.png`:
 *          الحجم الحقيقيّ 8235 بايت → بعد فكّ utf8: 14763 بايت → لا تطابق.
 *      فحفظُ ما يعرضه المحرّرُ يكتب التلفَ في مستودع المستخدم.
 * 🔴 ٢) ملفٌّ لا ترسل الواجهةُ محتواه (`encoding` غير base64 أو `content`
 *      فارغ — وهو ما توثّقه GitHub للملفات الكبيرة): كان يُفكّ إلى `''`،
 *      فيُعرض ملفٌّ فارغٌ على أنّه المحتوى، وحفظُه يمحو الأصل.
 *
 * الجولةُ هي الحَكَم: ما لا يعود من utf8 كما دخل ليس نصّاً.
 */
export async function getFile(token, fullName, filePath) {
    const clean = (filePath || '').replace(/^\/+/, '');
    const url = `/repos/${fullName}/contents/${encodeURIComponent(clean).replace(/%2F/g, '/')}`;
    const data = await gh(token, url);
    if (data.type !== 'file') throw new Error('المسار ليس ملفاً');
    if (data.encoding !== 'base64' || !data.content) {
        throw unsupported(
            'لم تُرسل الواجهةُ محتوى هذا الملف (كبيرٌ جداً غالباً) — لا يُفتح في المحرّر.',
            'no-content');
    }
    const raw = Buffer.from(data.content, 'base64');
    const content = raw.toString('utf8');
    if (!raw.equals(Buffer.from(content, 'utf8'))) {
        throw unsupported('ملفٌّ ثنائيّ — لا يُفتح في محرّر النصّ (حفظُه يُتلفه).', 'binary');
    }
    return { content, sha: data.sha, path: data.path, size: data.size };
}

/** تعديل ورفع ملف (commit + push) — sha مطلوب للملفات الموجودة */
export async function putFile(token, fullName, filePath, content, message, sha, branch) {
    const clean = (filePath || '').replace(/^\/+/, '');
    const url = `/repos/${fullName}/contents/${encodeURIComponent(clean).replace(/%2F/g, '/')}`;
    const body = {
        message: message || `Update ${clean} via JAOLA`,
        content: Buffer.from(content ?? '', 'utf8').toString('base64'),
    };
    if (sha) body.sha = sha;
    if (branch) body.branch = branch;
    const data = await gh(token, url, { method: 'PUT', body: JSON.stringify(body) });
    return { commit: data.commit?.sha, path: data.content?.path, sha: data.content?.sha };
}
