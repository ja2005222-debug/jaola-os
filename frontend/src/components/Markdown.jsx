import { useState } from 'react';

/**
 * 🖋️ Markdown — مصيّر ماركداون خفيف وآمن لفقاعات الشات (بمستوى كلاود)
 *
 * يدعم: عناوين · عريض/مائل · كود سطري · كتل كود (بزر نسخ) · قوائم (نقطية/رقمية) ·
 * اقتباسات · روابط · خطوط فاصلة · فقرات. لا يستخدم dangerouslySetInnerHTML (آمن من XSS).
 */

// ── تصيير سطري: عريض/مائل/كود/روابط ──────────────────────────────
function renderInline(text, keyBase) {
    const nodes = [];
    let rest = text;
    let k = 0;
    // ترتيب الأنماط مهم: الكود أولاً (يحمي محتواه)، ثم الروابط، ثم العريض، ثم المائل
    const patterns = [
        { re: /`([^`]+)`/, render: (m) => <code key={`${keyBase}-${k}`} style={styles.inlineCode}>{m[1]}</code> },
        { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, render: (m) => <a key={`${keyBase}-${k}`} href={m[2]} target="_blank" rel="noreferrer" style={styles.link}>{m[1]}</a> },
        { re: /\*\*([^*]+)\*\*|__([^_]+)__/, render: (m) => <strong key={`${keyBase}-${k}`}>{m[1] || m[2]}</strong> },
        { re: /(?<![*\w])\*([^*\n]+)\*(?!\*)|(?<![_\w])_([^_\n]+)_(?!_)/, render: (m) => <em key={`${keyBase}-${k}`}>{m[1] || m[2]}</em> },
    ];
    while (rest) {
        let best = null;
        for (const p of patterns) {
            const m = p.re.exec(rest);
            if (m && (best === null || m.index < best.m.index)) best = { p, m };
        }
        if (!best) { nodes.push(rest); break; }
        if (best.m.index > 0) nodes.push(rest.slice(0, best.m.index));
        nodes.push(best.p.render(best.m));
        k++;
        rest = rest.slice(best.m.index + best.m[0].length);
    }
    return nodes;
}

function CodeBlock({ code, lang }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
    };
    return (
        <div style={styles.codeWrap}>
            <div style={styles.codeHeader}>
                <span style={styles.codeLang}>{lang || 'code'}</span>
                <button onClick={copy} style={styles.copyBtn}>{copied ? '✓ نُسخ' : '⧉ نسخ'}</button>
            </div>
            <pre style={styles.pre}><code style={styles.code} dir="ltr">{code}</code></pre>
        </div>
    );
}

// ── تحليل الكتل: يفصل كتل الكود ثم يصيّر البقية ──────────────────
export function Markdown({ text = '' }) {
    if (!text) return null;
    const blocks = [];
    const fence = /```(\w+)?\n?([\s\S]*?)```/g;
    let last = 0, m, bi = 0;
    while ((m = fence.exec(text)) !== null) {
        if (m.index > last) blocks.push({ type: 'md', content: text.slice(last, m.index) });
        blocks.push({ type: 'code', lang: m[1] || '', content: m[2].replace(/\n$/, '') });
        last = m.index + m[0].length;
    }
    if (last < text.length) blocks.push({ type: 'md', content: text.slice(last) });

    return (
        <div style={styles.root}>
            {blocks.map((b, i) => b.type === 'code'
                ? <CodeBlock key={i} code={b.content} lang={b.lang} />
                : <MdBlock key={i} content={b.content} keyBase={`b${bi++}`} />)}
        </div>
    );
}

// ── كتل نصّية: عناوين/قوائم/اقتباسات/فقرات ───────────────────────
function MdBlock({ content, keyBase }) {
    const lines = content.split('\n');
    const out = [];
    let list = null; // { ordered, items: [] }
    const flushList = () => {
        if (!list) return;
        const Tag = list.ordered ? 'ol' : 'ul';
        out.push(<Tag key={`${keyBase}-l${out.length}`} style={styles.list}>
            {list.items.map((it, j) => <li key={j} style={styles.li}>{renderInline(it, `${keyBase}-li${j}`)}</li>)}
        </Tag>);
        list = null;
    };
    lines.forEach((raw, idx) => {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim()) { flushList(); return; }
        let m;
        if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
            flushList();
            const lvl = m[1].length;
            const sz = [0, 18, 16, 14.5, 13][lvl];
            out.push(<div key={`${keyBase}-h${idx}`} style={{ ...styles.heading, fontSize: sz }}>{renderInline(m[2], `${keyBase}-h${idx}`)}</div>);
        } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            flushList();
            out.push(<hr key={`${keyBase}-hr${idx}`} style={styles.hr} />);
        } else if ((m = /^>\s?(.*)$/.exec(line))) {
            flushList();
            out.push(<blockquote key={`${keyBase}-q${idx}`} style={styles.quote}>{renderInline(m[1], `${keyBase}-q${idx}`)}</blockquote>);
        } else if ((m = /^(\d+)[.)]\s+(.*)$/.exec(line))) {
            if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
            list.items.push(m[2]);
        } else if ((m = /^[-*•]\s+(.*)$/.exec(line))) {
            if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
            list.items.push(m[1]);
        } else {
            flushList();
            out.push(<p key={`${keyBase}-p${idx}`} style={styles.p}>{renderInline(line, `${keyBase}-p${idx}`)}</p>);
        }
    });
    flushList();
    return <>{out}</>;
}

const styles = {
    root: { display: 'flex', flexDirection: 'column', gap: 6 },
    p: { margin: 0, lineHeight: 1.7 },
    heading: { fontWeight: 800, margin: '4px 0 2px', lineHeight: 1.4, color: '#e2e8f0' },
    list: { margin: '2px 0', paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 3 },
    li: { lineHeight: 1.6 },
    quote: { margin: 0, paddingInlineStart: 10, borderInlineStart: '3px solid rgba(59,130,246,0.4)', color: '#94a3b8', fontStyle: 'italic' },
    hr: { border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 0' },
    inlineCode: { background: 'rgba(148,163,184,0.15)', borderRadius: 4, padding: '1px 5px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9em', color: '#93c5fd' },
    link: { color: '#60a5fa', textDecoration: 'underline' },
    codeWrap: { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', background: '#0a0f1e', margin: '2px 0' },
    codeHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' },
    codeLang: { fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px' },
    copyBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '2px 8px', color: '#93c5fd', fontSize: 10, cursor: 'pointer' },
    pre: { margin: 0, padding: 12, overflowX: 'auto' },
    code: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre' },
};

export default Markdown;
