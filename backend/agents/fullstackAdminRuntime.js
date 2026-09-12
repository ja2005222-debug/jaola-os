/** Passwords stay in JAOLA's owner-provisioned credential store; browser gets only HttpOnly cookies. */
export const FULLSTACK_ADMIN_LIB = `import config from './jaola-auth-config.json';

const cookieName = process.env.NODE_ENV === 'production' ? '__Host-jaola-admin' : 'jaola-admin';
const cookieOptions = '; HttpOnly; SameSite=Strict; Path=/' + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export const sameOrigin = request => request.headers.get('origin') === new URL(request.url).origin;
function configuration() {
  const base = new URL(config.api);
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) throw Error('Invalid authentication service');
  if (!config.token) throw Error('Missing project identity');
  return base.origin;
}
export function sessionCookie(request) {
  const item = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='));
  const value = item ? item.slice(cookieName.length + 1) : '';
  return /^[A-Za-z0-9_.-]{20,4096}$/.test(value) ? value : '';
}
export async function adminSession(request) {
  const session = sessionCookie(request);
  if (!session) return false;
  const base = configuration();
  const response = await fetch(base + '/api/public/auth/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session },
    body: JSON.stringify({ token: config.token }), cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw Error('Authentication unavailable');
  const result = await response.json();
  return result.ok === true && result.role === 'project-admin';
}
export async function login(request, password) {
  if (!sameOrigin(request)) return json({ error: 'ORIGIN_REJECTED' }, 403);
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) return json({ error: 'INVALID_PASSWORD' }, 400);
  try {
    const response = await fetch(configuration() + '/api/public/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ token: config.token, password }), signal: AbortSignal.timeout(10000),
    });
    if (response.status >= 500) return json({ error: 'AUTH_UNAVAILABLE' }, 503);
    if (response.status === 429) return json({ error: 'LOGIN_LIMIT' }, 429);
    const result = await response.json();
    if (!response.ok || !result.ok || typeof result.session !== 'string' || !/^[A-Za-z0-9_.-]{20,4096}$/.test(result.session)) {
      return json({ error: result.code === 'OWNER_SETUP_REQUIRED' ? 'OWNER_SETUP_REQUIRED' : 'LOGIN_FAILED' }, response.status === 429 ? 429 : 401);
    }
    return json({ ok: true }, 200, { 'Set-Cookie': cookieName + '=' + result.session + cookieOptions + '; Max-Age=3600' });
  } catch { return json({ error: 'AUTH_UNAVAILABLE' }, 503); }
}
export function logout(request) {
  if (!sameOrigin(request)) return json({ error: 'ORIGIN_REJECTED' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieName + '=' + cookieOptions + '; Max-Age=0' });
}
`;

export const FULLSTACK_LOGIN_PAGE = `'use client';
import { useState } from 'react';
import config from '../../lib/jaola-auth-config.json';
export default function Login() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error === 'OWNER_SETUP_REQUIRED' ? 'يجب أن يعيّن مالك المشروع كلمة المرور أولًا.' : data.error === 'AUTH_UNAVAILABLE' ? 'خدمة الدخول غير متاحة الآن. حاول لاحقًا.' : 'تعذّر الدخول. تحقق من كلمة المرور أو حاول لاحقًا.');
      setPassword(''); window.location.assign('/admin');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <main className="container" style={{maxWidth:480}}><h1>دخول إدارة التطبيق</h1>
    <form onSubmit={submit}><label htmlFor="password">كلمة مرور الأدمن</label><input id="password" type="password" autoComplete="current-password" required minLength={12} maxLength={200} value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'16px 0'}} />
    <button disabled={busy}>{busy ? 'جارٍ الدخول…' : 'دخول'}</button><p role="alert">{error}</p></form>
    {config.ownerUrl ? <p><a href={config.ownerUrl} target="_blank" rel="noopener noreferrer">إنشاء كلمة المرور أو استعادتها — لمالك المشروع</a></p> : <p>إعداد دخول المشروع غير مكتمل. أعد توليده من لوحة جولا.</p>}
    <p>تعيين كلمة المرور متاح لصاحب المشروع بعد تسجيل الدخول إلى حسابه في جولا.</p>
  </main>;
}
`;

export function fullstackAdminFiles(resources, auth = {}) {
    return [
        { name: 'lib/jaola-auth-config.json', content: JSON.stringify({ api: auth.api || '', token: auth.token || '', ownerUrl: auth.ownerUrl || '' }, null, 2) + '\n' },
        { name: 'lib/admin-auth.js', content: FULLSTACK_ADMIN_LIB },
        { name: 'app/login/page.js', content: FULLSTACK_LOGIN_PAGE },
        { name: 'app/api/admin/login/route.js', content: `import { login } from '@/lib/admin-auth';\nimport { readData, apiError } from '@/lib/api';\nexport const runtime = 'nodejs';\nexport async function POST(request) {\n  try { const data = await readData(request, [{ name:'password', type:'String', defaulted:false }]); return await login(request, data.password); }\n  catch(error) { return apiError(error); }\n}\n` },
        { name: 'app/api/admin/logout/route.js', content: `import { logout } from '@/lib/admin-auth';\nexport const runtime = 'nodejs';\nexport async function POST(request) { return logout(request); }\n` },
        { name: 'app/api/admin/session/route.js', content: `import { adminSession } from '@/lib/admin-auth';\nexport const dynamic = 'force-dynamic';\nexport async function GET(request) {\n  try { const ok = await adminSession(request); return Response.json({ok}, {status:ok ? 200 : 401, headers:{'Cache-Control':'no-store'}}); }\n  catch { return Response.json({error:'AUTH_UNAVAILABLE'}, {status:503, headers:{'Cache-Control':'no-store'}}); }\n}\n` },
        { name: 'app/admin/page.js', content: `'use client';
import { useEffect, useState } from 'react';
const resources = ${JSON.stringify(resources.map(r => ({ path: r.path, label: ({ products:'المنتجات', orders:'الطلبات', accounts:'الحسابات', subscriptions:'الاشتراكات', services:'الخدمات', appointments:'المواعيد', properties:'العقارات', inquiries:'الاستفسارات', courses:'الدورات', enrollments:'التسجيلات', doctors:'الأطباء', menu:'القائمة', posts:'المقالات', comments:'التعليقات' })[r.path] || r.path })))};
export default function Admin() {
  const [ready, setReady] = useState(false), [error,setError] = useState('');
  const [rows,setRows] = useState([]), [selected,setSelected] = useState(''), [loading,setLoading] = useState(false);
  useEffect(()=>{ fetch('/api/admin/session', {cache:'no-store'}).then(r=>{if(r.status===401)window.location.replace('/login');else if(!r.ok)throw Error('خدمة الدخول غير متاحة');else setReady(true);}).catch(e=>setError(e.message)); },[]);
  useEffect(()=>{const hide=()=>{setRows([]);setReady(false);};const restore=e=>{if(e.persisted)window.location.reload();};window.addEventListener('pagehide',hide);window.addEventListener('pageshow',restore);return()=>{window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',restore);};},[]);
  async function show(resource) {
    if(loading)return;setLoading(true);setRows([]);setSelected(resource.label);setError('');
    try { const r=await fetch('/api/'+resource.path,{cache:'no-store'}); if(r.status===401){window.location.replace('/login');return;}if(!r.ok)throw Error('تعذّر تحميل البيانات');setRows(await r.json()); }catch(e){setError(e.message);}finally{setLoading(false);}
  }
  async function leave(){try{const r=await fetch('/api/admin/logout',{method:'POST'});if(!r.ok)throw Error();window.location.replace('/login');}catch{setError('تعذّر تسجيل الخروج؛ حاول مجددًا');}}
  return <main className="container"><h1>إدارة التطبيق</h1><p role="alert">{error}</p>{ready ? <><button onClick={leave}>تسجيل الخروج</button><nav>{resources.map(r=><button key={r.path} disabled={loading} onClick={()=>show(r)}>{r.label}</button>)}</nav><h2>{selected}</h2>{loading && <p>جارٍ تحميل البيانات…</p>}{selected && !loading && !rows.length && <p>لا توجد سجلات للعرض.</p>}<div className="grid">{rows.map(row=><article className="card" key={row.id}>{Object.entries(row).map(([key,value])=><p key={key}><strong>{key}: </strong>{String(value ?? '')}</p>)}</article>)}</div></> : <p>جارٍ التحقق من الدخول…</p>}</main>;
}
` },
    ];
}
