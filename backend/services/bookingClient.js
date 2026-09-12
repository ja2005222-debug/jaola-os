import fs from 'node:fs';
import path from 'node:path';

export function bookingClient({ apiBase, token }) {
    return `// JAOLA server booking client
(function () {
  const config = ${JSON.stringify({ apiBase, token })};
  let admin = '';
  const storageKey = 'jaola-booking-customer:' + config.token;
  let key;
  function customerKey() {
    if (!key) {
      key = sessionStorage.getItem(storageKey);
      if (!key) {
        key = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem(storageKey, key);
      }
    }
    return key;
  }
  async function request(route, body, staff = false) {
    const url = new URL('/api/public/' + route, config.apiBase);
    if (!body) url.searchParams.set('token', config.token);
    const response = await fetch(url.toString(), {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (staff ? admin : customerKey()) },
      ...(body ? { body: JSON.stringify({ ...body, token: config.token }) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      if (staff && response.status === 401) admin = '';
      throw Error(data.error || data.code || 'BOOKING_UNAVAILABLE');
    }
    return data;
  }
  window.jaolaBookingAPI = {
    availability: (service = '', resource = '') => request('booking/availability?service=' + encodeURIComponent(service) + '&resource=' + encodeURIComponent(resource)),
    configuration: () => request('booking/admin/configuration', null, true),
    configure: body => request('booking/admin/configuration', body, true),
    recoveryCode: () => customerKey(),
    restore: async value => {
      if (!/^[a-f0-9]{64}$/.test(value)) throw Error('INVALID_RECOVERY_CODE');
      const previous = key; key = value;
      try { const rows = await request('booking/mine'); if (!rows.length) throw Error('NO_BOOKINGS'); sessionStorage.setItem(storageKey, value); return rows; }
      catch (error) { key = previous; throw error; }
    },
    mine: () => request('booking/mine'),
    create: body => request('booking', body),
    cancel: (id, staff) => request(staff ? 'booking/admin/cancel' : 'booking/cancel', { id }, staff),
    listAdmin: () => request('booking/admin', null, true),
    login: async password => { const data = await request('auth/login', { password }); if (!data.session) throw Error('LOGIN_FAILED'); admin = data.session; },
    logout: () => { admin = ''; },
  };
})();`;
}

export function installBookingClient(projectPath, config) {
    const file = path.join(projectPath, 'index.html');
    const app = path.join(projectPath, 'app.js');
    if (!fs.existsSync(file) || !fs.existsSync(app) || !fs.readFileSync(app, 'utf8').includes('window.jaolaBookingAPI')) return { ready: false };
    const html = fs.readFileSync(file, 'utf8').replace(/<html\b[^>]*>/i, tag => tag.replace(/\sdata-booking-server="[^"]*"/g, '').replace(/>$/, ' data-booking-server="true">'));
    if (!html.includes('data-booking-server="true"')) return { ready: false };
    const tag = '<script src="jaola-booking.js"></script>';
    if (!html.includes(tag) && !html.includes('<script src="app.js"></script>')) return { ready: false };
    fs.writeFileSync(path.join(projectPath, 'jaola-booking.js'), bookingClient(config));
    fs.writeFileSync(file, html.includes(tag) ? html : html.replace('<script src="app.js"></script>', tag + '\n  <script src="app.js"></script>'));
    return { ready: true };
}
