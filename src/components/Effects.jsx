import React from 'react';
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const WIN = 2.6;

const Panel = ({ children, style = {} }) => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
    <div style={{
      background: 'rgba(10,10,14,0.78)',
      borderRadius: 24,
      padding: '28px 36px',
      fontFamily: '"Noto Sans Bengali", sans-serif',
      color: '#fff',
      textAlign: 'center',
      boxShadow: '0 12px 50px rgba(0,0,0,0.5)',
      ...style,
    }}>{children}</div>
  </AbsoluteFill>
);

const effects = {
  'icon:': ({ spec, f, fps }) => {
    const val = spec.slice(5) || '✅';
    const p = spring({ frame: f, fps, config: { damping: 9, stiffness: 160 } });
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', pointerEvents: 'none' }}>
        <div style={{ margin: '6%', fontSize: 92, transform: `scale(${p}) rotate(${(1 - p) * -18}deg)` }}>{val}</div>
      </AbsoluteFill>
    );
  },
  counter: ({ spec, f, fps }) => {
    const [, from, to, dur = 2] = spec.split(':').concat(['', '0']);
    const p = Math.min(1, f / (fps * Math.min(2 / 1, dur || 1)));
    const val = Math.round((+from || 0) + ((+to || 100) - (+from || 0)) * p);
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', pointerEvents: 'none' }}>
        <div style={{ margin: '0 6% 22%', fontFamily: '"Noto Sans Bengali", sans-serif', fontWeight: 700, fontSize: 74, color: '#4ade80', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
          {val.toLocaleString('bn-BD')}
        </div>
      </AbsoluteFill>
    );
  },
  bar: ({ spec, f, fps }) => {
    const pct = Math.min(100, Math.max(5, parseInt((spec.split(':')[1] || '70'), 10))) / 100;
    const p = Math.min(1, f / (fps * 0.9));
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'stretch', pointerEvents: 'none' }}>
        <div style={{ margin: '0 10% 18%' }}>
          <div style={{ height: 22, background: 'rgba(255,255,255,0.18)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ width: `${pct * p * 100}%`, height: '100%', borderRadius: 12, background: 'linear-gradient(90deg,#22c55e,#4ade80)' }} />
          </div>
        </div>
      </AbsoluteFill>
    );
  },
  slider: ({ f, fps }) => {
    const p = interpolate(f, [0, fps * 1.2], [0, 1], { extrapolateRight: 'clamp' });
    return (
      <AbsoluteFill style={{ justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ margin: '0 10% 16%', position: 'relative', height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 6 }}>
          <div style={{ position: 'absolute', left: `${p * 92}%`, top: -14, width: 36, height: 36, borderRadius: 18, background: '#38bdf8', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }} />
        </div>
      </AbsoluteFill>
    );
  },
  'stamp-red:': ({ spec, f, fps }) => WStamp({ f, fps, color: '#f87171', ring: '#ef4444', text: spec.slice(10) || 'ভুল' }),
  'stamp-green:': ({ spec, f, fps }) => WStamp({ f, fps, color: '#4ade80', ring: '#22c55e', text: spec.slice(12) || 'সঠিক' }),
  quiz: ({ spec, f, fps }) => {
    const [, q, correct, w1 = '', w2 = ''] = spec.split('|');
    const reveal = f > (fps * WIN) * 0.55;
    const opt = (t, right) => (
      <div style={{
        margin: '6px 0', padding: '10px 18px', borderRadius: 14, fontWeight: 600, fontSize: 26,
        background: reveal && right ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)',
        border: reveal && right ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.15)',
      }}>{t}</div>
    );
    return (
      <Panel style={{ minWidth: '70%' }}>
        <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>{q || 'প্রশ্ন'}</div>
        {opt(`✓ ${correct || ''}`, true)}
        {opt(`✗ ${w1}`, false)}
        {w2 ? opt(`✗ ${w2}`, false) : null}
        {reveal && f % Math.round(fps / 2) === 0 ? null : null}
      </Panel>
    );
  },
  spotlight: () => (
    <AbsoluteFill style={{
      background: 'radial-gradient(circle at 50% 42%, rgba(0,0,0,0) 12%, rgba(0,0,0,0.82) 42%)',
      pointerEvents: 'none',
    }} />
  ),
  map: ({ f, fps }) => (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{ width: '82%', height: '52%', background: 'rgba(12,20,38,0.85)', borderRadius: 22, border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <svg viewBox="0 0 400 300" width="100%" height="100%">
          {[40, 80, 120, 160, 200, 240].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />)}
          {[60, 140, 220, 300, 360].map(x => <line key={x} x1={x} y1="0" x2={x} y2="300" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />)}
          <path d="M 60 230 C 130 150, 200 190, 250 110 S 340 70, 360 60" fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="500" strokeDashoffset={500 - Math.min(500, f / (fps * 1.5) * 500)} strokeLinecap="round" />
          {[[60, 230], [250, 110], [360, 60]].map(([x, y]) => (
            <g key={x + y}><circle cx={x} cy={y} r="8" fill="#f87171" opacity="0.9" /><circle cx={x} cy={y} r="16" fill="none" stroke="#f87171" opacity="0.4" /></g>
          ))}
        </svg>
      </div>
    </AbsoluteFill>
  ),
};

const WStamp = ({ f, fps, color, ring, text }) => {
  const p = spring({ frame: f, fps, config: { damping: 8, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{
        transform: `scale(${p}) rotate(-8deg)`,
        color, border: `6px solid ${ring}`, borderRadius: 14,
        padding: '10px 30px', fontWeight: 700, fontSize: 64,
        fontFamily: '"Baloo Da 2","Noto Sans Bengali",sans-serif',
        background: 'rgba(0,0,0,0.25)', opacity: 0.95,
      }}>{text}</div>
    </AbsoluteFill>
  );
};

export default function Effect({ spec, atGlobal, scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localAt = (atGlobal - (scene.start || 0)) * fps;
  const win = spec.startsWith('quiz') ? Math.round(fps * WIN * 1.4) : Math.round(fps * WIN);
  const local = frame - localAt;
  if (local < 0 || local > win) return null;
  if (!spec) return null;
  const fn = spec.startsWith('icon:') ? effects['icon:']
    : spec.startsWith('stamp-red:') ? effects['stamp-red:']
    : spec.startsWith('stamp-green:') ? effects['stamp-green:']
    : spec.startsWith('quiz') ? effects.quiz
    : spec.startsWith('counter') ? effects.counter
    : spec.startsWith('bar') ? effects.bar
    : spec.startsWith('slider') ? effects.slider
    : spec === 'spotlight' ? effects.spotlight
    : spec === 'map' ? effects.map
    : null;
  if (!fn) return null;
  return (
    <>
      {local < 3 && (spec.startsWith('icon') || spec.startsWith('stamp')) ? (
        <Audio src={staticFile('out/sfx/pop.wav')} volume={0.5} />
      ) : null}
      {local < 3 && spec === 'quiz' ? <Audio src={staticFile('out/sfx/ding.wav')} volume={0.4} /> : null}
      {fn({ spec, f: local, fps })}
    </>
  );
}
