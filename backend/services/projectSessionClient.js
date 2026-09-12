/** Shared bootstrap for generated system templates. No platform credentials are collected here. */
export function projectSessionClient(api, token, start, manageTeam) {
    const nativeFetch = window.fetch.bind(window);
    let session = null;
    const cache = new Map();
    const nativeGet = Storage.prototype.getItem;
    const nativeSet = Storage.prototype.setItem;
    const nativeRemove = Storage.prototype.removeItem;
    Storage.prototype.getItem = function (key) { return this === localStorage ? (cache.get(String(key)) ?? null) : nativeGet.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (this === localStorage) cache.set(String(key), String(value)); else nativeSet.call(this, key, value); };
    Storage.prototype.removeItem = function (key) { if (this === localStorage) cache.delete(String(key)); else nativeRemove.call(this, key); };
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0d1117;color:white;display:grid;place-items:center;font-family:sans-serif';
    overlay.dir = 'rtl';
    overlay.innerHTML = '<form style="max-width:360px;padding:24px"><h2>دخول المشروع</h2><p>يعيّن المالك كلمة مرور الإدارة من إعدادات المشروع في جولا. لحساب فريق، أدخل اسم الحساب الذي أنشأه المسؤول.</p><label>اسم حساب الفريق (اتركه فارغاً للإدارة)<input name="account" autocomplete="username" style="display:block;padding:12px;margin:12px 0"></label><label>كلمة المرور <input name="password" type="password" required autocomplete="current-password" style="display:block;padding:12px;margin:12px 0"></label><button type="submit">دخول</button><p role="alert"></p></form>';
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form');
    function lock() {
        session = null;
        window.JAOLA_IDENTITY = null;
        cache.clear();
        window.location.reload();
    }
    window.fetch = async function (input, options = {}) {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        const base = new URL(api);
        const protectedRequest = url.origin === base.origin && url.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/api/public/');
        if (!protectedRequest) return nativeFetch(input, options);
        // The shared gate has already authenticated this project administrator.
        if (session && url.pathname.endsWith('/auth/login')) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        const headers = new Headers(options.headers || (typeof input !== 'string' ? input.headers : undefined));
        if (session) headers.set('Authorization', 'Bearer ' + session);
        const result = await nativeFetch(input, { ...options, headers, signal: options.signal || AbortSignal.timeout(15000) });
        if (result.status === 401 && !url.pathname.endsWith('/auth/login')) lock();
        if (url.pathname.endsWith('/auth/set-password') && result.ok) lock();
        return result;
    };
    form.onsubmit = async event => {
        event.preventDefault();
        const button = form.querySelector('button');
        const error = form.querySelector('[role="alert"]');
        button.disabled = true;
        error.textContent = '';
        try {
            const account = form.querySelector('[name="account"]').value.trim();
            const response = await nativeFetch(api + (account ? '/api/public/auth/member-login' : '/api/public/auth/login'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
                body: JSON.stringify({ token, account, password: form.querySelector('[name="password"]').value }),
            });
            const data = await response.json();
            if (!response.ok || !data.session) throw new Error(data.code === 'OWNER_SETUP_REQUIRED' ? 'يجب أن يعيّن المالك كلمة المرور أولًا من لوحة جولا.' : 'تعذّر الدخول. تحقق من كلمة المرور والاتصال.');
            session = data.session;
            window.JAOLA_IDENTITY = Object.freeze({ account: data.account || null, uiRole: data.uiRole || null });
            form.querySelector('[name="password"]').value = '';
            overlay.remove();
            // Do not retain project data or bearer credentials across reload/logout.
            window.addEventListener('pagehide', () => { session = null; cache.clear(); });
            window.addEventListener('pageshow', event => { if (event.persisted) lock(); });
            const logout = document.createElement('button');
            logout.textContent = 'تسجيل الخروج';
            logout.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483646;padding:8px;background:#0d1117;color:white;border:1px solid #64748b;border-radius:6px';
            logout.onclick = lock;
            document.body.appendChild(logout);
            document.addEventListener('click', e => {
                if (e.target.closest('[data-action="logout"]')) { e.preventDefault(); e.stopImmediatePropagation(); lock(); }
            }, true);
            setTimeout(lock, 60 * 60 * 1000);
            const assetUrls = new Set();
            const loadPrivateImages = () => document.querySelectorAll('img').forEach(async img => {
                const source = img.getAttribute('src');
                if (!source || img.dataset.jaolaLoading === source) return;
                const target = new URL(source, location.href);
                if (target.origin !== new URL(api).origin || !target.pathname.startsWith('/api/public/assets/')) return;
                img.dataset.jaolaLoading = source;
                try {
                    const response = await window.fetch(target.href, { signal: AbortSignal.timeout(15000) });
                    if (!response.ok) return;
                    const blobUrl = URL.createObjectURL(await response.blob());
                    assetUrls.add(blobUrl);
                    if (img.getAttribute('src') === source) img.src = blobUrl;
                } catch { /* A protected image remains unavailable on failure. */ }
            });
            const images = new MutationObserver(loadPrivateImages);
            images.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
            window.addEventListener('pagehide', () => images.disconnect());
            window.addEventListener('pagehide', () => assetUrls.forEach(url => URL.revokeObjectURL(url)));
            loadPrivateImages();
            if (data.account && data.uiRole) {
                const applyRole = () => {
                    const select = document.getElementById('loginRole');
                    if (select) { select.value = data.uiRole; select.disabled = true; }
                    document.querySelectorAll('[data-action]').forEach(element => {
                        if (data.ui?.hiddenActions?.includes(element.dataset.action)
                            || (element.dataset.action === 'tab' && data.ui?.hiddenViews?.includes(element.dataset.view))) {
                            element.hidden = true;
                            element.style.setProperty('display', 'none', 'important');
                            if ('disabled' in element) element.disabled = true;
                        }
                    });
                };
                applyRole();
                const roles = new MutationObserver(applyRole);
                roles.observe(document.body, { subtree: true, childList: true });
                window.addEventListener('pagehide', () => roles.disconnect());
                document.addEventListener('DOMContentLoaded', () => queueMicrotask(() => {
                    applyRole();
                    document.querySelector('[data-action="login"]')?.click();
                }), { once: true });
            } else if (typeof manageTeam === 'function') manageTeam(api, token);
            start();
        } catch (failure) { error.textContent = failure.message; }
        finally { button.disabled = false; }
    };
}
