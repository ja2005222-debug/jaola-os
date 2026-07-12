/**
 * 🐙 GitHub Files — JAOLA OS
 *
 * قراءة/تصفّح/تعديل/رفع ملفات مستودعات المستخدم عبر GitHub REST API
 * باستخدام توكن OAuth المخزّن مشفّراً. تُستدعى من مسارات الأدمِن فقط.
 */

const API = 'https://api.github.com';

async function gh(token, urlPath, opts = {}) {
    const res = await fetch(`${API}${urlPath}`, {
        ...opts,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'jaola-os',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
            ...(opts.headers || {}),
        },
    });
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

/** قائمة مستودعات المستخدم (يملكها أو متعاون فيها) */
export async function listRepos(token) {
    const repos = await gh(token, '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator');
    return (repos || []).map((r) => ({
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        permissions: r.permissions || {},
    }));
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

/** قراءة ملف — يُرجع المحتوى النصي و sha (لازم للتعديل) */
export async function getFile(token, fullName, filePath) {
    const clean = (filePath || '').replace(/^\/+/, '');
    const url = `/repos/${fullName}/contents/${encodeURIComponent(clean).replace(/%2F/g, '/')}`;
    const data = await gh(token, url);
    if (data.type !== 'file') throw new Error('المسار ليس ملفاً');
    const content = Buffer.from(data.content || '', data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
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
