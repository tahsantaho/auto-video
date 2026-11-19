import React from 'react';
import { registerRoot, Composition, continueRender, delayRender } from 'remotion';
import './fonts.css';
import VideoRoot from './VideoRoot.jsx';
import Thumb from './Thumb.jsx';

const FONT_LIST = ['Noto Sans Bengali', 'Hind Siliguri', 'Baloo Da 2', 'Tiro Bangla'];
const fontHandle = delayRender('bengali-fonts');
if (typeof document !== 'undefined') {
  Promise.all(FONT_LIST.map(f => document.fonts.load(`700 64px "${f}"`)))
    .then(() => continueRender(fontHandle))
    .catch(() => continueRender(fontHandle));
}

const emptyProps = {
  fps: 30, width: 1080, height: 1920, kind: 'B', theme: 'warm', music: null,
  scenes: [], thumb: { text: '', asset: null, kind: 'B' },
};

const calc = ({ props }) => {
  const fps = props.fps || 30;
  const total = (props.scenes || []).reduce((a, s) => Math.max(a, (s.start || 0) + (s.dur || 0)), 0) + 1;
  return {
    fps,
    width: props.width || 1080,
    height: props.height || 1920,
    durationInFrames: Math.max(10, Math.ceil(total * fps)),
  };
};

const Root = () => (
  <>
    <Composition
      id="Main"
      component={VideoRoot}
      durationInFrames={30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={emptyProps}
      calculateMetadata={calc}
    />
    <Composition
      id="Thumb"
      component={Thumb}
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{ thumb: { text: '', asset: null, kind: 'B' }, theme: 'warm' }}
    />
  </>
);

registerRoot(Root);
