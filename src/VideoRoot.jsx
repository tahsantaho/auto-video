import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, Loop } from 'remotion';
import { KINDS, THEMES } from './presets.js';
import Captions from './components/Captions.jsx';
import Effect from './components/Effects.jsx';

const TRANS = 10;

const Background = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const natural = Math.min(1, scene.dur / 6);
  const zoom = interpolate(f / (fps * scene.dur), [0, 1], [1.04, 1.04 + 0.14 * natural]);
  const pan = Math.sin(f / 180 + (scene.indexMod || 0)) * 8;
  if (scene.assetType === 'video') {
    return (
      <AbsoluteFill style={{ justifyContent: 'center' }}>
        <Loop durationInFrames={Math.max(1, Math.ceil(scene.dur * fps))}>
          <OffthreadVideo src={staticFile(scene.asset)} muted />
        </Loop>
      </AbsoluteFill>
    );
  }
  if (scene.assetType === 'photo') {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', overflow: 'hidden' }}>
        <Img
          src={staticFile(scene.asset)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom}) translateY(${pan}px)` }}
        />
      </AbsoluteFill>
    );
  }
  const th = scene.theme;
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(140deg, ${th.bg1} 0%, ${th.bg2} 60%, ${th.accent}22 100%)`,
    }} />
  );
};

const Vignette = () => (
  <AbsoluteFill style={{
    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)',
  }} />
);

const Scene = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(f, [0, TRANS], [0, 1], { extrapolateRight: 'clamp' });
  const slide = interpolate(f, [0, TRANS], [40, 0], { extrapolateRight: 'clamp' });
  return (
    <Sequence from={Math.max(0, Math.round((scene.start || 0) * fps))} durationInFrames={Math.max(2, Math.ceil(scene.dur * fps)) + TRANS}>
      <AbsoluteFill style={{ opacity: fadeIn, transform: `translateX(${slide}px)` }}>
        <Background scene={scene} />
        <Vignette />
        <Captions scene={scene} />
        {scene.effects.map((e, i) => (
          <Effect key={i} spec={e.spec} atGlobal={e.at} scene={scene} />
        ))}
      </AbsoluteFill>
    </Sequence>
  );
};

export default function VideoRoot({ scenes, music, narration, kind, theme }) {
  const list = Array.isArray(scenes) ? scenes : [];
  const th = THEMES[theme] || THEMES.warm;
  const k = KINDS[kind] || KINDS.B;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {list.map((s, i) => (
        <Scene key={i} scene={{ ...s, indexMod: i * 3, theme: th, font: k.fonts[i % k.fonts.length], capPos: k.capPos }} />
      ))}
      {narration ? <Audio src={staticFile(narration)} /> : null}
      {music ? <Audio src={staticFile(music.file)} volume={music.volume} loop /> : null}
    </AbsoluteFill>
  );
}
