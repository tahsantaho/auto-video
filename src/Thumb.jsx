import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { THEMES } from './presets.js';

export default function Thumb({ thumb, theme }) {
  const th = THEMES[theme] || THEMES.warm;
  const bg1 = th.bg1, bg2 = th.bg2;
  return (
    <AbsoluteFill>
      {thumb.asset ? (
        <Img src={staticFile(thumb.asset)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
      ) : (
        <AbsoluteFill style={{ background: `linear-gradient(135deg, ${bg1}, ${bg2})` }} />
      )}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.75) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '6%' }}>
        <div style={{
          fontFamily: '"Baloo Da 2","Noto Sans Bengali",sans-serif',
          fontWeight: 700,
          fontSize: 138,
          lineHeight: 1.15,
          color: '#fff',
          textShadow: '0 6px 24px rgba(0,0,0,0.9)',
        }}>{thumb.text || ''}</div>
        <div style={{
          marginTop: 24, height: 14, width: '42%', borderRadius: 8,
          background: `linear-gradient(90deg, ${th.accent}, ${th.accent2})`,
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
