import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../config.js';

// 💳 صفحة الاشتراكات — الخطط + استهلاك المستخدم + الدفع عبر Stripe

const S = {
  bg: '#050810', bg2: '#0b1120', card: '#0f1729', border: '#1e293b',
  text: '#e2e8f0', muted: '#64748b', blue: '#3b82f6', purple: '#8b5cf6',
  green: '#10b981', amber: '#f59e0b', red: '#ef4444',
};

export default function BillingPage({ onExit }) {
  const token = localStorage.getItem('token');
  const [plans, setPlans] = useState([]);
  const [sub, setSub] = useState(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const api = useCallback(async (pathUrl, opts = {}) => {
    const res = await fetch(`${BACKEND_URL}${pathUrl}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'خطأ في الطلب');
    return d;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [p, s] = await Promise.all([
        fetch(`${BACKEND_URL}/api/billing/plans`).then(r => r.json()),
        api('/api/billing/subscription'),
      ]);
      setPlans(p.plans || []);
      setStripeEnabled(!!p.stripeEnabled);
      setSub(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const upgrade = async (planId) => {
    setBusy(planId); setError('');
    try {
      const { url } = await api('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ planId }) });
      if (url) window.location.href = url;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('portal'); setError('');
    try {
      const { url } = await api('/api/billing/portal', { method: 'POST' });
      if (url) window.location.href = url;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const currentPlan = sub?.planId || 'free';

  return (
    <div style={{ minHeight: '100dvh', background: S.bg, color: S.text, fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
      <style>{`*{box-sizing:border-box} button{cursor:pointer;font-family:inherit} button:disabled{opacity:.5;cursor:default}`}</style>

      <nav style={{ height: 56, background: S.bg2, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>💳</div>
        <span style={{ fontWeight: 800, fontSize: 15 }}>الاشتراك والفوترة</span>
        <div style={{ flex: 1 }} />
        <button onClick={onExit} style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 14px', color: S.muted, fontSize: 13 }}>← الرجوع للوحة</button>
      </nav>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px' }}>
        {error && <Banner color={S.red}>{error}</Banner>}
        {!stripeEnabled && <Banner color={S.amber}>نظام الدفع في وضع العرض فقط (لم تُضبط مفاتيح Stripe على الخادم بعد).</Banner>}

        {loading ? (
          <p style={{ color: S.muted, textAlign: 'center', padding: 40 }}>جارٍ التحميل…</p>
        ) : (
          <>
            {/* لوحة الاستهلاك */}
            {sub && (
              <section style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16 }}>خطتك الحالية</h3>
                  <span style={{ fontSize: 12, color: S.blue, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}>
                    {planLabel(currentPlan)}
                  </span>
                  {sub.status && sub.status !== 'none' && <span style={{ fontSize: 11, color: S.muted }}>({sub.status})</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                  <Metric label="المشاريع المستخدمة" value={sub.projects.used} />
                  <Metric label="الحدّ الأقصى" value={sub.projects.unlimited ? 'غير محدود' : sub.projects.limit} />
                  <Metric label="المتبقي" value={sub.projects.unlimited ? '∞' : sub.projects.remaining} />
                  <Metric label="نشر تلقائي" value={sub.features.autoDeploy ? 'مفعّل ✅' : 'غير متاح'} />
                </div>
                {!sub.projects.unlimited && (
                  <div style={{ marginTop: 16, height: 8, background: '#1e293b', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (sub.projects.used / (sub.projects.limit || 1)) * 100)}%`, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }} />
                  </div>
                )}
                {currentPlan !== 'free' && (
                  <button onClick={manage} disabled={busy === 'portal'} style={btn(S.border, 'transparent', S.text, true)}>
                    {busy === 'portal' ? '…' : 'إدارة الاشتراك'}
                  </button>
                )}
              </section>
            )}

            {/* الخطط */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {plans.map(p => {
                const isCurrent = p.id === currentPlan;
                const isPaid = p.id !== 'free';
                return (
                  <div key={p.id} style={{ background: S.card, border: `1px solid ${isCurrent ? S.purple : S.border}`, borderRadius: 14, padding: 22, position: 'relative' }}>
                    {isCurrent && <span style={{ position: 'absolute', top: 14, left: 14, fontSize: 10, color: S.purple, fontWeight: 800 }}>خطتك</span>}
                    <h3 style={{ fontSize: 18, marginBottom: 4 }}>{p.nameAr}</h3>
                    <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 14 }}>
                      {p.priceMonthly === 0 ? 'مجاناً' : <>${p.priceMonthly}<span style={{ fontSize: 13, color: S.muted, fontWeight: 400 }}>/شهر</span></>}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {p.featuresAr.map((f, i) => (
                        <li key={i} style={{ fontSize: 13, color: S.muted, display: 'flex', gap: 8 }}><span style={{ color: S.green }}>✓</span>{f}</li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <button disabled style={btn(S.border, 'transparent', S.muted)}>خطتك الحالية</button>
                    ) : isPaid ? (
                      <button onClick={() => upgrade(p.id)} disabled={!stripeEnabled || busy === p.id} style={btn(S.purple, S.purple, '#fff')}>
                        {busy === p.id ? '…' : 'ترقية الآن'}
                      </button>
                    ) : (
                      <button disabled style={btn(S.border, 'transparent', S.muted)}>الخطة الأساسية</button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function planLabel(id) {
  return { free: 'مجانية', pro: 'احترافية', enterprise: 'المؤسسات' }[id] || id;
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: S.text }}>{value}</div>
      <div style={{ fontSize: 12, color: S.muted }}>{label}</div>
    </div>
  );
}

function Banner({ color, children }) {
  return (
    <div style={{ background: `${color}15`, border: `1px solid ${color}40`, color, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
      {children}
    </div>
  );
}

function btn(borderColor, bg, color, block) {
  return {
    width: '100%', marginTop: block ? 14 : 0, padding: '10px 14px', borderRadius: 9,
    border: `1px solid ${borderColor}`, background: bg, color, fontSize: 14, fontWeight: 700,
  };
}
