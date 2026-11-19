import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTION_BASE, CAPTION_GREEN, CAPTION_RED } from '../presets.js';

const colorOf = (c, active) => (c === 'red' ? CAPTION_RED : c === 'green' ? CAPTION_GREEN : active ? CAPTION_BASE : 'rgba(255,255,255,0.66)');

export default function Captions({ scene }) {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const glob = f / fps + (scene.start || 0);
  const cue = (scene.cues || []).find(c => glob >= c.start && glob < c.start + c.dur);
  if (!cue) return null;

  return (
    <AbsoluteFill style={{ alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        top: height * (scene.capPos || 0.8),
        left: width * 0.06,
        width: width * 0.88,
        textAlign: 'center',
        fontFamily: `"${scene.font || 'Noto Sans Bengali'}", sans-serif`,
        fontWeight: 700,
        fontSize: height * 0.042,
        lineHeight: 1.55,
        color: '#fff',
        textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
        background: 'rgba(0,0,0,0.32)',
        borderRadius: 18,
        padding: `${height * 0.012}px ${width * 0.03}px`,
      }}>
        {cue.words.map((word, i) => {
          const active = glob >= word.start && glob < word.start + word.dur;
          const em = active ? interpolate((glob - word.start) / Math.max(0.05, word.dur), [0, 0.2, 0.8, 1], [1, 1.13, 1.13, 1], { extrapolateRight: 'clamp' }) : 1;
          return (
            <span key={i} style={{
              color: colorOf(word.color, active),
              display: 'inline-block',
              transform: `scale(${em})`,
              margin: '0 0.14em',
              fontWeight: active ? 700 : 600,
            }}>
              {word.w}{' '}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
