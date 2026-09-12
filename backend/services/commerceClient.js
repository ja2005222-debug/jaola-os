import fs from 'node:fs';
import path from 'node:path';
export function commerceClient(config) {
    return `// JAOLA server commerce
(function () {
  const config = ${JSON.stringify(config)};
  let admin = '';
  const storageKey = 'jaola-store-customer:' + config.token;
  function customer() {
    let value = sessionStorage.getItem(storageKey);
    if (!value) { value = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''); sessionStorage.setItem(storageKey, value); }
    return value;
  }
  async function request(route, body, staff = false) {
    const url = new URL('/api/public/' + route, config.apiBase);
    if (!body) url.searchParams.set('token', config.token);
    const response = await fetch(url.toString(), { method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (staff ? admin : customer()) },
      ...(body ? { body: JSON.stringify({ ...body, token: config.token }) } : {}) });
    const data = await response.json();
    if (!response.ok || data.ok === false) { if (staff && response.status === 401) admin = ''; throw Error(data.error || data.code || 'STORE_UNAVAILABLE'); }
    return data;
  }
  window.jaolaStoreAPI = {
    catalog: () => request('store/catalog'), mine: () => request('store/mine'),
    checkout: body => request('store/checkout', body),
    admin: () => request('store/admin', null, true),
    product: body => request('store/admin/product', body, true),
    transition: body => request('store/admin/order', body, true),
    cancel: body => request('store/cancel', body),
    login: async password => { const data = await request('auth/login', { password }); if (!data.session) throw Error('LOGIN_FAILED'); admin = data.session; },
    logout: () => { admin = ''; },
    recoveryCode: customer,
    restore: async value => {
      if (!/^[a-f0-9]{64}$/.test(value)) throw Error('INVALID_RECOVERY_CODE');
      const previous = sessionStorage.getItem(storageKey); sessionStorage.setItem(storageKey, value);
      try { const rows = await request('store/mine'); if (!rows.length) throw Error('NO_ORDERS'); return rows; }
      catch (error) { if (previous) sessionStorage.setItem(storageKey, previous); else sessionStorage.removeItem(storageKey); throw error; }
    },
  };
})();`;
}
export function installCommerceClient(projectPath, config) {
    const file = path.join(projectPath, 'index.html'), app = path.join(projectPath, 'app.js');
    if (!fs.existsSync(file) || !fs.existsSync(app) || !fs.readFileSync(app, 'utf8').includes('window.jaolaStoreAPI')) return { ready: false };
    const html = fs.readFileSync(file, 'utf8').replace(/<html\b[^>]*>/i, tag => tag.replace(/\sdata-store-server="[^"]*"/g, '').replace(/>$/, ' data-store-server="true">'));
    const tag = '<script src="jaola-store.js"></script>';
    if (!html.includes('data-store-server="true"') || (!html.includes(tag) && !html.includes('<script src="app.js"></script>'))) return { ready: false };
    fs.writeFileSync(path.join(projectPath, 'jaola-store.js'), commerceClient(config));
    fs.writeFileSync(file, html.includes(tag) ? html : html.replace('<script src="app.js"></script>', tag + '\n<script src="app.js"></script>'));
    return { ready: true };
}
