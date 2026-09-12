/** Generated client: one synchronous user action is flushed as one multi-key commit. */
export function transactionSyncClient(api, token, loadApp) {
    const nativeSet = Storage.prototype.setItem;
    const nativeRemove = Storage.prototype.removeItem;
    let revision = null, scheduled = false, inFlight = false, blocked = false;
    let changes = Object.create(null);
    const queue = [];
    const waiters = [];
    window.JAOLA_SYNC = window.JAOLA_SYNC || {};
    window.JAOLA_SYNC.flush = () => {
        if (blocked) return Promise.reject(new Error('Save blocked'));
        if (!scheduled && !queue.length && !inFlight) return Promise.resolve();
        return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    };
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    status.style.cssText = 'position:fixed;bottom:0;right:0;left:0;z-index:2147483646;padding:10px;background:#0d1117;color:white;text-align:center';
    status.dir = 'rtl';
    status.textContent = 'جارٍ تحميل البيانات…';
    document.body.appendChild(status);
    function fail(message) {
        blocked = true;
        waiters.splice(0).forEach(waiter => waiter.reject(new Error(message)));
        status.setAttribute('role', 'alert');
        status.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0d1117;color:white;padding:40px;text-align:center';
        status.textContent = message + ' لا تُعد تنفيذ العملية قبل التحقق من السجل.';
        const reload = document.createElement('button');
        reload.textContent = 'تحميل أحدث نسخة';
        reload.onclick = () => location.reload();
        status.appendChild(reload);
    }
    async function drain() {
        if (inFlight || blocked || !queue.length) return;
        inFlight = true;
        const transaction = queue[0];
        transaction.revision = revision;
        status.textContent = 'جارٍ حفظ التغييرات…';
        try {
            let result;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const response = await fetch(api + '/api/public/data/transaction', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, ...transaction }), signal: AbortSignal.timeout(15000),
                    });
                    if (response.status === 409) { fail('تغيّرت البيانات من جلسة أخرى؛ أُوقفت الكتابة لحماية النسخة الأحدث.'); return; }
                    if (!response.ok) {
                        if (response.status < 500) { fail('رفض الخادم حفظ العملية.'); return; }
                        throw new Error('Server unavailable');
                    }
                    result = await response.json();
                    if (!Number.isSafeInteger(result.revision) || result.revision !== transaction.revision + 1) throw new Error('Invalid acknowledgement');
                    break;
                } catch (error) { if (attempt === 2) throw error; }
            }
            revision = result.revision;
            queue.shift();
            status.textContent = queue.length ? 'جارٍ حفظ التغييرات…' : 'حُفظت التغييرات على الخادم';
        } catch { fail('تعذّر تأكيد الحفظ؛ قد تكون العملية وصلت إلى الخادم.'); }
        finally {
            inFlight = false;
            if (!blocked) {
                if (!scheduled && !queue.length) waiters.splice(0).forEach(waiter => waiter.resolve());
                drain();
            }
        }
    }
    function schedule(key, value) {
        if (blocked || revision === null) throw new Error('Project data is not writable');
        if (/_session$/.test(key)) return;
        changes[key] = value;
        status.textContent = 'تغييرات بانتظار الحفظ…';
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            queue.push({ id: crypto.randomUUID(), changes });
            changes = Object.create(null);
            drain();
        });
    }
    Storage.prototype.setItem = function (key, value) {
        if (this !== localStorage) return nativeSet.call(this, key, value);
        key = String(key); value = String(value);
        schedule(key, value); nativeSet.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
        if (this !== localStorage) return nativeRemove.call(this, key);
        key = String(key); schedule(key, null); nativeRemove.call(this, key);
    };
    window.addEventListener('beforeunload', event => {
        if (scheduled || queue.length || inFlight) { event.preventDefault(); event.returnValue = ''; }
    });
    fetch(api + '/api/public/data?transactional=1&token=' + encodeURIComponent(token), { signal: AbortSignal.timeout(15000) })
        .then(response => { if (!response.ok) throw new Error('Load failed'); return response.json(); })
        .then(snapshot => {
            if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || !snapshot.data || typeof snapshot.data !== 'object' || Array.isArray(snapshot.data)) throw new Error('Invalid snapshot');
            if (Object.entries(snapshot.data).some(([key, value]) => !/^[\w.-]{1,80}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key) || typeof value !== 'string')) throw new Error('Invalid data');
            Object.entries(snapshot.data).forEach(([key, value]) => { if (!/_session$/.test(key)) nativeSet.call(localStorage, key, value); });
            revision = snapshot.revision;
            status.textContent = 'البيانات محدثة';
            loadApp();
        }).catch(() => fail('تعذّر تحميل بيانات المشروع.'));
}
