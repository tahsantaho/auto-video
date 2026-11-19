import fs from 'node:fs';

const SR = 44100;

function writeWav(file, samples, sr = SR) {
  const n = samples.length, data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, samples[i])); data.writeInt16LE(Math.round(v * 32000), i * 2); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + n * 2, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(n * 2, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
import path from 'node:path';

const env = (i, n, atk = 0.02, rel = 0.3) => {
  const t = i / n;
  const a = Math.min(1, i / (atk * n)), r = Math.min(1, (1 - t) / rel);
  return Math.min(a, r);
};

function music(mood, file, seconds = 30) {
  const bpm = mood === 'calm' ? 62 : mood === 'upbeat' ? 108 : 90;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const scales = { calm: [285.76, 340.71, 381.71], upbeat: [392, 440, 493.88] };
  const roots = scales[mood] || [392, 440, 349.23];
  const N = Math.floor(seconds * SR);
  const out = new Float32Array(N);
  for (let pos = 0, barI = 0; pos < N; barI++) {
    const root = roots[barI % roots.length];
    const chord = [root / 2, root, root * 1.25, root * 1.5];
    const len = Math.min(N - pos, Math.floor(bar * SR));
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      let v = 0;
      for (let k = 0; k < chord.length; k++) {
        v += Math.sin(2 * Math.PI * chord[k] * t) * (0.05 / (k + 1));
        v += Math.sin(2 * Math.PI * chord[k] * 2 * t) * 0.012;
      }
      v *= 0.5 * env(i, len, 0.3, 0.5);
      if (mood === 'upbeat') {
        const bi = i / SR / beat;
        if (bi % 1 < 0.001 || Math.abs(bi % 1) > 0.999) v += Math.max(-1, Math.min(1, (Math.random() * 2 - 1) * 0.4)) * Math.exp(-t * 80) * 0.5;
        if (Math.floor(bi * 2) % 2 === 1) v += Math.sin(2 * Math.PI * 6000 * t) * Math.exp(-t * 120) * 0.05;
      }
      out[pos + i] = v;
    }
    pos += len;
  }
  writeWav(file, out, SR);
}

function sfx(kind, file) {
  const dur = kind === 'whoosh' ? 0.5 : kind === 'ding' ? 0.7 : 0.15;
  const N = Math.floor(dur * SR);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR, p = i / N;
    let v = 0;
    if (kind === 'pop') v = Math.sin(2 * Math.PI * (900 - 700 * p) * t) * Math.exp(-t * 30) * 0.9;
    else if (kind === 'ding') v = (Math.sin(2 * Math.PI * 1568 * t) + 0.6 * Math.sin(2 * Math.PI * 2349 * t)) * Math.exp(-t * 6) * 0.5;
    else v = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) * (0.2 + 0.8 * (1 - p)) * 0.7;
    out[i] = v;
  }
  writeWav(file, out, SR);
}

const [, , kind, sub, file, seconds] = process.argv;
if (kind === 'music') music(sub, file, parseInt(seconds || '30', 10));
else if (kind === 'sfx') sfx(sub, file);
else { console.error('ব্যবহার: node synth_audio.mjs music <mood> <out.wav> [sec] | sfx <pop|ding|whoosh> <out.wav>'); process.exit(1); }
