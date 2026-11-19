import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const toBn = (n) => String(n).split('').map((c) => (/\d/.test(c) ? BN[+c] : c)).join('');
const fromBn = (s) => {
  let out = '';
  for (const ch of String(s)) { const i = BN.indexOf(ch); out += i >= 0 ? String(i) : ch; }
  const m = out.match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : null;
};
const animVal = (s, eased) => String(s).replace(/[০-৯0-9]+/, (m) => {
  const v = fromBn(m);
  return v == null ? m : toBn(String(Math.round(v * eased)));
});

// ---- প্রফেশনাল লাইন-আইকন সেট (২৪x২৪, স্ট্রোক-ভিত্তিক) ----
const I = {
  bolt: [<polygon key="a" points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />],
  battery: [
    <rect key="a" x="1.5" y="7" width="17" height="10" rx="2.5" />,
    <line key="b" x1="21.5" y1="10.5" x2="21.5" y2="13.5" />,
    <polygon key="c" points="10.5 8.5 7.5 12.5 10 12.5 9.5 15.5 12.5 11.5 10 11.5 10.5 8.5" fill="currentColor" stroke="none" />,
  ],
  clock: [<circle key="a" cx="12" cy="12" r="9" />, <polyline key="b" points="12 7 12 12 15.5 14" />],
  chart: [
    <line key="a" x1="3.5" y1="20.5" x2="21" y2="20.5" />,
    <line key="b" x1="7" y1="20" x2="7" y2="12" />,
    <line key="c" x1="12.5" y1="20" x2="12.5" y2="6" />,
    <line key="d" x1="18" y1="20" x2="18" y2="9.5" />,
  ],
  money: [
    <circle key="a" cx="12" cy="12" r="9" />,
    <path key="b" d="M12 6.5v11M15 8.8c-.6-1-1.7-1.5-3-1.5-1.8 0-2.9.9-2.9 2.1 0 2.9 6 1.4 6 4.2 0 1.3-1.2 2.2-3.1 2.2-1.7 0-2.8-.7-3.3-1.7" />,
  ],
  fire: [
    <path key="a" d="M12 2.5c1.4 2.8-.9 4.4-.9 6.8 0 1.4 1 2.5 2.4 2.5 1.5 0 2.4-1.1 2.4-2.6 1.9 1.7 3.6 4 3.6 6.3 0 3.9-3.3 6.5-7.5 6.5s-7.5-2.6-7.5-6.5c0-5.4 5.4-7.5 7.5-13z" fill="currentColor" stroke="none" />,
  ],
  star: [
    <polygon key="a" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none" />,
  ],
  bulb: [
    <path key="a" d="M9.2 18h5.6M10.2 21h3.6" />,
    <path key="b" d="M12 3a6 6 0 0 1 3.4 10.9c-.6.5-1 1.2-1 2h-4.8c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3z" />,
  ],
  question: [
    <circle key="a" cx="12" cy="12" r="9" />,
    <path key="b" d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.3-2.8 4" />,
    <line key="c" x1="12" y1="17.3" x2="12.01" y2="17.3" strokeWidth="3" />,
  ],
  target: [
    <circle key="a" cx="12" cy="12" r="9" />,
    <circle key="b" cx="12" cy="12" r="5" />,
    <circle key="c" cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />,
  ],
  rocket: [
    <path key="a" d="M12 2.5c2.7 1.9 4.3 5.2 4.3 8.5L14 13.6h-4l-2.3-2.6c0-3.3 1.6-6.6 4.3-8.5z" />,
    <circle key="b" cx="12" cy="8.8" r="1.5" />,
    <path key="c" d="M10 13.6 7.2 17l3-1.1M14 13.6 16.8 17l-3-1.1" />,
    <path key="d" d="M11 16.5c0 1.4 1 3.5 1 3.5s1-2.1 1-3.5" />,
  ],
  heart: [
    <path key="a" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1 7.8 7.7 7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" fill="currentColor" stroke="none" />,
  ],
  globe: [
    <circle key="a" cx="12" cy="12" r="9" />,
    <line key="b" x1="3" y1="12" x2="21" y2="12" />,
    <path key="c" d="M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18z" />,
  ],
  check: [<polyline key="a" points="20 6 9.5 17 4 12" strokeWidth="3" />],
  cross: [<line key="a" x1="6" y1="6" x2="18" y2="18" strokeWidth="3" />, <line key="b" x1="18" y1="6" x2="6" y2="18" strokeWidth="3" />],
  trend: [
    <polyline key="a" points="22.5 6.5 13.5 15.5 8.5 10.5 1.5 17.5" />,
    <polyline key="b" points="16.5 6.5 22.5 6.5 22.5 12.5" />,
  ],
  phone: [
    <rect key="a" x="7" y="2" width="10" height="20" rx="2.5" />,
    <line key="b" x1="11" y1="18" x2="13" y2="18" />,
  ],
  shield: [<path key="a" d="M12 22s8-3.8 8-9.8V5l-8-3-8 3v7.2C4 18.2 12 22 12 22z" />],
  leaf: [
    <path key="a" d="M11 20.5A7.5 7.5 0 0 1 3.5 13C3.5 7.5 8 3.5 20.5 3.5c0 12.5-4 17-9.5 17z" />,
    <path key="b" d="M4.5 20C7 15 10.5 11.5 15 9" />,
  ],
  bell: [
    <path key="a" d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.7 8.3-2.7 8.3h17.4S18 15 18 8.5" />,
    <path key="b" d="M13.7 20.5a2 2 0 0 1-3.4 0" />,
  ],
  book: [
    <path key="a" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />,
    <path key="b" d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />,
  ],
  calendar: [
    <rect key="a" x="3" y="4.5" width="18" height="17" rx="2" />,
    <line key="b" x1="16" y1="2.5" x2="16" y2="6.5" />,
    <line key="c" x1="8" y1="2.5" x2="8" y2="6.5" />,
    <line key="d" x1="3" y1="10" x2="21" y2="10" />,
  ],
  alert: [
    <path key="a" d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
    <line key="b" x1="12" y1="9" x2="12" y2="13.5" />,
    <line key="c" x1="12" y1="17.3" x2="12.01" y2="17.3" strokeWidth="3" />,
  ],
  drop: [<path key="a" d="M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z" />],
  wifi: [
    <path key="a" d="M1.5 9.2a16 16 0 0 1 21 0" />,
    <path key="b" d="M5 12.6a11 11 0 0 1 14 0" />,
    <path key="c" d="M8.5 16a6 6 0 0 1 7 0" />,
    <line key="d" x1="12" y1="19.7" x2="12.01" y2="19.7" strokeWidth="3" />,
  ],
  sun: [
    <circle key="a" cx="12" cy="12" r="4.2" />,
    <line key="e" x1="12" y1="1.5" x2="12" y2="3.5" />, <line key="f" x1="12" y1="20.5" x2="12" y2="22.5" />,
    <line key="g" x1="4.3" y1="4.3" x2="5.7" y2="5.7" />, <line key="h" x1="18.3" y1="18.3" x2="19.7" y2="19.7" />,
    <line key="i" x1="1.5" y1="12" x2="3.5" y2="12" />, <line key="j" x1="20.5" y1="12" x2="22.5" y2="12" />,
    <line key="k" x1="4.3" y1="19.7" x2="5.7" y2="18.3" />, <line key="l" x1="18.3" y1="5.7" x2="19.7" y2="4.3" />,
  ],
  cloud: [<path key="a" d="M17.8 10.2A7.5 7.5 0 1 0 8.8 20H18a4.8 4.8 0 0 0 0-9.8h-.2z" />],
  lock: [
    <rect key="a" x="4.5" y="11" width="15" height="10.5" rx="2" />,
    <path key="b" d="M8 11V7a4 4 0 0 1 8 0v4" />,
  ],
};

export const ICON_NAMES = Object.keys(I);

const Icon = ({ name, size = 96, color = '#fff', sw = 2, style }) => {
  const els = I[name] || I.bulb;
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ color, display: 'block', ...style }}
    >
      {els.map((el, i) => React.cloneElement(el, { key: i }))}
    </svg>
  );
};

// ---- থিম-সচেতন আনিমেটেড ব্যাকগ্রাউন্ট (কোড-মোড) ----
export function CodeBackground({ th, index = 0 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const drift1 = `translate(${Math.sin(t * 0.45 + index) * 45}px, ${Math.cos(t * 0.3 + index) * 35}px)`;
  const drift2 = `translate(${Math.cos(t * 0.35 + index * 2) * 55}px, ${Math.sin(t * 0.42) * 40}px)`;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(150deg, ${th.bg1} 0%, ${th.bg2} 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: '60%', paddingBottom: '60%', borderRadius: '50%', left: '-15%', top: '-12%', opacity: 0.55, background: `radial-gradient(circle, ${th.accent}55 0%, transparent 65%)`, transform: drift1 }} />
      <div style={{ position: 'absolute', width: '65%', paddingBottom: '65%', borderRadius: '50%', right: '-18%', bottom: '-15%', opacity: 0.42, background: `radial-gradient(circle, ${th.accent2}44 0%, transparent 65%)`, transform: drift2 }} />
      <AbsoluteFill style={{ opacity: 0.07, backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.5) 100%)' }} />
    </AbsoluteFill>
  );
}

const SPR = { damping: 13, stiffness: 130 };
const fade = (f, a, b) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const IconBadge = ({ icon, u, th, p, size }) => (
  <div style={{
    width: size || 150 * u, height: size || 150 * u, borderRadius: '50%',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    background: `linear-gradient(145deg, ${th.accent}, ${th.accent2})`,
    boxShadow: `0 14px 44px ${th.accent}66, inset 0 2px 6px rgba(255,255,255,0.35)`,
    transform: `scale(${Math.max(0.001, p)}) rotate(${(1 - p) * -22}deg)`,
  }}>
    <Icon name={icon} size={(size || 150 * u) * 0.56} color="#fff" sw={2.1} />
  </div>
);

const Card = ({ u, th, f, fps, children }) => {
  const p = spring({ frame: f, fps, config: SPR });
  return (
    <div style={{
      transform: `scale(${0.93 + 0.07 * p}) translateY(${(1 - p) * 30 * u}px)`,
      width: '88%', maxWidth: 880 * u,
      background: 'linear-gradient(160deg, rgba(255,255,255,0.11), rgba(255,255,255,0.045))',
      border: `2.5px solid ${th.accent}55`,
      borderRadius: 36 * u,
      padding: `${50 * u}px ${46 * u}px`,
      boxShadow: '0 26px 90px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 * u,
    }}>
      {children}
    </div>
  );
};

const TitleCard = ({ card, u, th, f, fps }) => {
  const pI = spring({ frame: f, fps, config: { damping: 9, stiffness: 150 } });
  const pT = fade(f, 5, 20);
  const line = interpolate(f, [12, 34], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pts = (card.points || []).slice(0, 2);
  return (
    <Card u={u} th={th} f={f} fps={fps}>
      <IconBadge icon={card.icon} u={u} th={th} p={pI} />
      <div style={{
        fontFamily: '"Baloo Da 2","Noto Sans Bengali",sans-serif', fontWeight: 700,
        fontSize: 74 * u, lineHeight: 1.25, color: '#fff', textAlign: 'center',
        opacity: pT, transform: `translateY(${(1 - pT) * 18 * u}px)`,
        textShadow: '0 4px 24px rgba(0,0,0,0.45)',
      }}>{card.headline}</div>
      <div style={{ height: 9 * u, width: `${line}%`, borderRadius: 6 * u, background: `linear-gradient(90deg, ${th.accent}, ${th.accent2})`, boxShadow: `0 0 18px ${th.accent}88` }} />
      {pts.map((t, i) => (
        <div key={i} style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontSize: 34 * u, color: 'rgba(255,255,255,0.85)', textAlign: 'center', opacity: fade(f, 18 + i * 8, 30 + i * 8) }}>{t}</div>
      ))}
    </Card>
  );
};

const ListCard = ({ card, u, th, f, fps }) => (
  <Card u={u} th={th} f={f} fps={fps}>
    {card.headline ? (
      <div style={{ fontFamily: '"Baloo Da 2","Noto Sans Bengali",sans-serif', fontWeight: 700, fontSize: 46 * u, color: '#fff', opacity: fade(f, 0, 10) }}>{card.headline}</div>
    ) : null}
    {(card.points || []).slice(0, 4).map((t, i) => {
      const p = Math.max(0, spring({ frame: f - (6 + i * 9), fps, config: { damping: 11, stiffness: 150 } }));
      return (
        <div key={i} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 20 * u,
          opacity: p, transform: `translateX(${(1 - p) * 46 * u}px)`,
        }}>
          <div style={{
            flexShrink: 0, width: 52 * u, height: 52 * u, borderRadius: 14 * u, display: 'flex',
            justifyContent: 'center', alignItems: 'center', background: `${th.accent}33`, border: `2px solid ${th.accent}`,
          }}>
            <div style={{ fontFamily: '"Baloo Da 2",sans-serif', fontWeight: 700, fontSize: 27 * u, color: th.accent }}>{toBn(i + 1)}</div>
          </div>
          <div style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontSize: 36 * u, lineHeight: 1.4, color: '#fff' }}>{t}</div>
        </div>
      );
    })}
  </Card>
);

const NumberCard = ({ card, u, th, f, fps }) => {
  const eased = interpolate(f, [2, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const val = animVal(card.value || '১০০', eased);
  const pN = spring({ frame: f, fps, config: { damping: 10, stiffness: 120 } });
  return (
    <Card u={u} th={th} f={f} fps={fps}>
      <div style={{
        fontFamily: '"Baloo Da 2",sans-serif', fontWeight: 700, fontSize: 190 * u, lineHeight: 1,
        color: th.accent, textShadow: `0 8px 60px ${th.accent}88`,
        transform: `scale(${0.6 + 0.4 * pN})`,
      }}>{val}</div>
      {card.headline ? <div style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontWeight: 600, fontSize: 40 * u, color: '#fff', textAlign: 'center', opacity: fade(f, 8, 20) }}>{card.headline}</div> : null}
      <div style={{ height: 7 * u, width: 120 * u, borderRadius: 5 * u, background: th.accent2, opacity: fade(f, 14, 24) }} />
      {card.note ? <div style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontSize: 30 * u, color: 'rgba(255,255,255,0.8)', textAlign: 'center', opacity: fade(f, 16, 28) }}>{card.note}</div> : null}
    </Card>
  );
};

const CompareCard = ({ card, u, th, f, fps }) => {
  const good = card.points || [];
  const bad = card.bad || [];
  const Col = ({ items, iconEl, color, from, delay }) => (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 14 * u, padding: 26 * u,
      borderRadius: 24 * u, background: `${color}1f`, border: `2px solid ${color}66`,
      opacity: fade(f, delay, delay + 10),
      transform: `translateX(${(1 - fade(f, delay, delay + 12)) * from * 40 * u}px)`,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Icon name={iconEl} size={54 * u} color={color} sw={2.6} /></div>
      {items.map((t, i) => (
        <div key={i} style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontSize: 29 * u, lineHeight: 1.4, color: '#fff', textAlign: 'center', opacity: fade(f, delay + 6 + i * 6, delay + 14 + i * 6) }}>{t}</div>
      ))}
    </div>
  );
  return (
    <Card u={u} th={th} f={f} fps={fps}>
      <div style={{ display: 'flex', width: '100%', gap: 20 * u, alignItems: 'stretch' }}>
        <Col items={good} iconEl="check" color="#4ade80" from={-1} delay={2} />
        <Col items={bad} iconEl="cross" color="#f87171" from={1} delay={7} />
      </div>
      {card.note ? <div style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontSize: 27 * u, color: 'rgba(255,255,255,0.8)', opacity: fade(f, 16, 28) }}>{card.note}</div> : null}
    </Card>
  );
};

const QuoteCard = ({ card, u, th, f, fps }) => (
  <Card u={u} th={th} f={f} fps={fps}>
    <div style={{ fontFamily: 'Georgia,serif', fontSize: 150 * u, lineHeight: 0.5, color: th.accent, opacity: fade(f, 0, 8), marginTop: 26 * u }}>❝</div>
    <div style={{
      fontFamily: '"Noto Sans Bengali",sans-serif', fontWeight: 600, fontSize: 46 * u, lineHeight: 1.5,
      color: '#fff', textAlign: 'center', opacity: fade(f, 5, 20),
      transform: `translateY(${(1 - fade(f, 5, 20)) * 16 * u}px)`,
    }}>{card.headline || card.value}</div>
    <div style={{ height: 6 * u, width: 90 * u, borderRadius: 4 * u, background: th.accent2, opacity: fade(f, 12, 22) }} />
    {card.note ? <div style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontSize: 32 * u, color: 'rgba(255,255,255,0.8)', opacity: fade(f, 14, 26) }}>{card.note}</div> : null}
  </Card>
);

const StatCard = ({ card, u, th, f, fps }) => {
  const p = spring({ frame: f, fps, config: SPR });
  const eased = interpolate(p, [0, 1], [0, 1]);
  const num = fromBn(card.value);
  const pct = num == null ? eased : Math.max(0, Math.min(100, num)) / 100;
  const R = 118, C = 2 * Math.PI * R;
  return (
    <Card u={u} th={th} f={f} fps={fps}>
      <div style={{ position: 'relative', width: 290 * u, height: 290 * u, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg viewBox="0 0 290 290" width={290 * u} height={290 * u} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
          <circle cx="145" cy="145" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="20" />
          <circle cx="145" cy="145" r={R} fill="none" stroke={th.accent} strokeWidth="20" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct * eased)}
            style={{ filter: `drop-shadow(0 0 14px ${th.accent}99)` }} />
        </svg>
        <div style={{ fontFamily: '"Baloo Da 2",sans-serif', fontWeight: 700, fontSize: 66 * u, color: '#fff' }}>
          {num == null ? (card.value || '') : animVal(card.value, eased)}
        </div>
      </div>
      {card.headline ? <div style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontWeight: 600, fontSize: 36 * u, color: '#fff', textAlign: 'center', opacity: fade(f, 8, 20) }}>{card.headline}</div> : null}
      {card.note ? <div style={{ fontFamily: '"Noto Sans Bengali",sans-serif', fontSize: 29 * u, color: 'rgba(255,255,255,0.8)', textAlign: 'center', opacity: fade(f, 16, 28) }}>{card.note}</div> : null}
    </Card>
  );
};

const CARDS = { title: TitleCard, list: ListCard, number: NumberCard, compare: CompareCard, quote: QuoteCard, stat: StatCard };

const DEFAULT_ICONS = ['bulb', 'bolt', 'target', 'chart', 'star', 'rocket'];

// কোড-গ্রাফিক্স দৃশ্য: অ্যানিমেটেড কার্ড, থিম-সচেতন
export function CodeScene({ scene, th, iconPref }) {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const card = scene.card || {};
  const Comp = CARDS[card.type] || CARDS.title;
  const prefs = (iconPref && iconPref.length ? iconPref : DEFAULT_ICONS).filter(n => ICON_NAMES.includes(n));
  const pool = prefs.length ? prefs : DEFAULT_ICONS;
  const icon = pool.includes(card.icon) ? card.icon : pool[scene.index % pool.length];
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <Comp card={{ ...card, icon }} u={u} th={th} f={f} fps={fps} />
    </AbsoluteFill>
  );
}
