/** Serialized into generated apps; uses the authenticated fetch wrapper. */
export async function projectTeamClient(api, token) {
    const call = async (method = 'GET', body, account) => {
        const target = new URL(api + '/api/public/team' + (account ? '/' + encodeURIComponent(account) : ''));
        target.searchParams.set('token', token);
        const response = await fetch(target.href, { method, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify({ ...body, token }) } : {}) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'تعذّر حفظ حساب الفريق');
        return data;
    };
    let initial;
    try { initial = await call(); } catch { return; }
    if (!initial.roles?.length || document.getElementById('jaola-team-toggle')) return;
    const button = document.createElement('button');
    button.id = 'jaola-team-toggle';
    button.textContent = 'إدارة الفريق';
    button.style.cssText = 'position:fixed;top:52px;left:8px;z-index:2147483646;padding:8px;border-radius:6px';
    document.body.appendChild(button);
    button.onclick = async () => {
        button.disabled = true;
        const modal = document.createElement('dialog');
        modal.dir = 'rtl';
        modal.style.cssText = 'max-width:600px;width:90%;max-height:85vh;overflow:auto;padding:24px;border-radius:12px;background:#111827;color:white';
        modal.innerHTML = '<button type="button" data-close>إغلاق</button><h2>حسابات الفريق</h2><p>كل شخص يدخل بحسابه. الصلاحيات حسب الدور، والحساب المرتبط بسجل محدد يرى سجلاته المسموح بها فقط. حفظ اسم حساب موجود يغيّر كلمة مروره وصلاحياته ويُلغي جلساته السابقة.</p><form><label>اسم الحساب<input name="account" required minlength="3" maxlength="64" autocomplete="off"></label><label>كلمة مرور جديدة<input name="password" type="password" required minlength="12" autocomplete="new-password"></label><label>الدور<select name="role"></select></label><label data-binding>السجل المرتبط بالحساب<select name="recordId"></select></label><button type="submit">حفظ الحساب</button></form><p role="status"></p><div data-accounts></div>';
        modal.querySelectorAll('input,select').forEach(input => { input.style.cssText = 'display:block;width:100%;padding:10px;margin:8px 0 16px;box-sizing:border-box'; });
        document.body.appendChild(modal);
        modal.querySelector('[data-close]').onclick = () => modal.close();
        modal.addEventListener('close', () => { modal.remove(); button.disabled = false; });
        modal.showModal();
        const form = modal.querySelector('form');
        const notice = modal.querySelector('[role="status"]');
        let configuration;
        const refresh = async () => {
            configuration = await call();
            const list = modal.querySelector('[data-accounts]');
            list.replaceChildren();
            for (const account of configuration.accounts || []) {
                const row = document.createElement('p');
                const label = document.createElement('span');
                const role = configuration.roles.find(item => item.id === account.role);
                label.textContent = account.account + ' — ' + (role?.label || account.role) + (account.active ? '' : ' — معطّل');
                row.appendChild(label);
                if (account.active) {
                    const revoke = document.createElement('button');
                    revoke.type = 'button'; revoke.textContent = 'تعطيل الحساب';
                    revoke.onclick = async () => {
                        revoke.disabled = true;
                        try { await call('DELETE', null, account.account); await refresh(); notice.textContent = 'عُطّل الحساب وأُلغيت جلساته.'; }
                        catch (error) { notice.textContent = error.message; revoke.disabled = false; }
                    };
                    row.appendChild(revoke);
                }
                list.appendChild(row);
            }
        };
        try {
            await refresh();
            for (const role of configuration.roles) {
                const option = document.createElement('option'); option.value = role.id; option.textContent = role.label;
                form.elements.role.appendChild(option);
            }
            for (const binding of configuration.bindings || []) {
                const option = document.createElement('option'); option.value = binding.id; option.textContent = binding.name;
                form.elements.recordId.appendChild(option);
            }
            const chooseRole = () => {
                const requiresRecord = configuration.roles.find(role => role.id === form.elements.role.value)?.requiresRecord;
                modal.querySelector('[data-binding]').hidden = !requiresRecord;
                form.elements.recordId.required = !!requiresRecord;
                form.elements.recordId.disabled = !requiresRecord;
            };
            form.elements.role.onchange = chooseRole; chooseRole();
            form.onsubmit = async event => {
                event.preventDefault();
                const submit = form.querySelector('[type="submit"]'); submit.disabled = true; notice.textContent = '';
                try {
                    await call('POST', { account: form.elements.account.value, password: form.elements.password.value,
                        role: form.elements.role.value, recordId: form.elements.recordId.disabled ? '' : form.elements.recordId.value });
                    form.elements.password.value = ''; await refresh(); notice.textContent = 'حُفظ حساب الفريق.';
                } catch (error) { notice.textContent = error.message; }
                finally { submit.disabled = false; }
            };
        } catch (error) { notice.textContent = error.message; }
    };
}
