/** Shared bootstrap for generated system templates. No platform credentials are collected here. */
export function projectSessionClient(api, token, start) {
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
    overlay.innerHTML = '<form style="max-width:360px;padding:24px"><h2>دخول إدارة المشروع</h2><p>يعيّن المالك كلمة المرور من إعدادات المشروع في جولا.</p><label>كلمة المرور <input type="password" required autocomplete="current-password" style="display:block;padding:12px;margin:12px 0"></label><button type="submit">دخول</button><p role="alert"></p></form>';
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form');
    function lock() {
        session = null;
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
            const response = await nativeFetch(api + '/api/public/auth/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
                body: JSON.stringify({ token, password: form.querySelector('input').value }),
            });
            const data = await response.json();
            if (!response.ok || !data.session) throw new Error(data.code === 'OWNER_SETUP_REQUIRED' ? 'يجب أن يعيّن المالك كلمة المرور أولًا من لوحة جولا.' : 'تعذّر الدخول. تحقق من كلمة المرور والاتصال.');
            session = data.session;
            form.querySelector('input').value = '';
            overlay.remove();
            // Do not retain project data or bearer credentials across reload/logout.
            window.addEventListener('pagehide', () => { session = null; cache.clear(); });
            window.addEventListener('pageshow', event => { if (event.persisted) lock(); });
            const logout = document.createElement('button');
            logout.textContent = 'خروج من إدارة المشروع';
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
            start();
        } catch (failure) { error.textContent = failure.message; }
        finally { button.disabled = false; }
    };
}
