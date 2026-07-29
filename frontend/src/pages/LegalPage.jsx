import { useState } from 'react';
import { useI18n } from '../i18n.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';

// 📜 سياسة الخصوصية + شروط الاستخدام — صفحة عامة (بلا تسجيل دخول)
// وصف صادق لما تفعله المنصة فعلاً (تخزين مشاريع، مزامنة jaola-data،
// الاستعانة بمزوّدي ذكاء اصطناعي خارجيين، Stripe للفوترة...) — ليست
// استشارة قانونية معتمدة، بل مسودة بدء يُنصح بمراجعتها مع مختص قبل
// اعتمادها نهائياً في نطاق قانوني محدد.

const S = {
  bg: '#050810', bg2: '#0b1120', card: '#0f1729', border: '#1e293b',
  text: '#e2e8f0', muted: '#64748b', blue: '#3b82f6',
};

const PRIVACY_SECTIONS = [
  ['legalPrivacyIntro', 'legalPrivacyIntroBody'],
  ['legalPrivacyCollect', 'legalPrivacyCollectBody'],
  ['legalPrivacyUse', 'legalPrivacyUseBody'],
  ['legalPrivacyThird', 'legalPrivacyThirdBody'],
  ['legalPrivacyRetain', 'legalPrivacyRetainBody'],
  ['legalPrivacyRights', 'legalPrivacyRightsBody'],
  ['legalPrivacySecurity', 'legalPrivacySecurityBody'],
  ['legalPrivacyChildren', 'legalPrivacyChildrenBody'],
  ['legalPrivacyChanges', 'legalPrivacyChangesBody'],
  ['legalPrivacyContact', 'legalPrivacyContactBody'],
];

const TERMS_SECTIONS = [
  ['legalTermsIntro', 'legalTermsIntroBody'],
  ['legalTermsService', 'legalTermsServiceBody'],
  ['legalTermsAccount', 'legalTermsAccountBody'],
  ['legalTermsUse', 'legalTermsUseBody'],
  ['legalTermsContent', 'legalTermsContentBody'],
  ['legalTermsThird', 'legalTermsThirdBody'],
  ['legalTermsBilling', 'legalTermsBillingBody'],
  ['legalTermsWarranty', 'legalTermsWarrantyBody'],
  ['legalTermsTermination', 'legalTermsTerminationBody'],
  ['legalTermsChanges', 'legalTermsChangesBody'],
  ['legalTermsContact', 'legalTermsContactBody'],
];

export default function LegalPage({ initialTab = 'privacy', onExit }) {
  const t = useI18n(s => s.t);
  const dir = useI18n(s => s.dir);
  const [tab, setTab] = useState(initialTab);
  const sections = tab === 'privacy' ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <div style={{ minHeight: '100dvh', background: S.bg, color: S.text, fontFamily: 'system-ui, sans-serif', direction: dir }}>
      <nav style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${S.border}`, gap: 14 }}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <span style={{ fontWeight: 800 }}>JAOLA OS</span>
        <div style={{ flex: 1 }} />
        <LanguageSwitcher />
        <button onClick={onExit} style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 14px', color: S.muted, fontSize: 13 }}>
          {t('legalBack')}
        </button>
      </nav>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          <button onClick={() => setTab('privacy')}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, fontWeight: 700, fontSize: 14,
              border: `1px solid ${tab === 'privacy' ? 'rgba(59,130,246,0.4)' : S.border}`,
              background: tab === 'privacy' ? 'rgba(59,130,246,0.12)' : S.card,
              color: tab === 'privacy' ? '#93c5fd' : S.muted,
            }}>
            {t('legalTabPrivacy')}
          </button>
          <button onClick={() => setTab('terms')}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, fontWeight: 700, fontSize: 14,
              border: `1px solid ${tab === 'terms' ? 'rgba(59,130,246,0.4)' : S.border}`,
              background: tab === 'terms' ? 'rgba(59,130,246,0.12)' : S.card,
              color: tab === 'terms' ? '#93c5fd' : S.muted,
            }}>
            {t('legalTabTerms')}
          </button>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
          {tab === 'privacy' ? t('legalPrivacyTitle') : t('legalTermsTitle')}
        </h1>
        <p style={{ fontSize: 13, color: S.muted, marginBottom: 24 }}>{t('legalLastUpdated')}</p>

        <div style={{ display: 'grid', gap: 20 }}>
          {sections.map(([hKey, bKey]) => (
            <section key={hKey} style={{ ...cardStyle }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#93c5fd' }}>{t(hKey)}</h2>
              <p style={{ fontSize: 14, lineHeight: 1.9, color: S.text, whiteSpace: 'pre-line' }}>{t(bKey)}</p>
            </section>
          ))}
        </div>

        <p style={{ fontSize: 12, color: S.muted, marginTop: 28, lineHeight: 1.8 }}>{t('legalDisclaimer')}</p>
      </div>
    </div>
  );
}

const cardStyle = { background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 };
