import fs from 'node:fs';
import path from 'node:path';

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

const normalize = (arr, peak = 0.55) => {
  let m = 0;
  for (const v of arr) m = Math.max(m, Math.abs(v));
  if (m > 0.0001) { const g = peak / m; for (let i = 0; i < arr.length; i++) arr[i] *= g; }
  return arr;
};

// এক-পোল লো-পাস ফিল্টার — দানাদার/ঝিরঝির উচ্চ-কম্পাঙ্ক ধরিয়ে নরম স্বর বানায়
const lowpass = (arr, cutoff) => {
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0;
  for (let i = 0; i < arr.length; i++) { y = (1 - a) * arr[i] + a * y; arr[i] = y; }
  return arr;
};
const hipass = (arr, cutoff) => {
  const l = lowpass(arr.slice(), cutoff);
  for (let i = 0; i < arr.length; i++) arr[i] = arr[i] - l[i];
  return arr;
};

// ব্যান্ড-পাস যার কাট-অফ সময়ের সাথে বদলায় — whoosh-এর জন্য
const sweepBand = (arr, f0, f1) => {
  const N = arr.length;
  let lo = 0, hi = 0;
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = N > 1 ? i / (N - 1) : 0;
    const fc = f0 + (f1 - f0) * (0.5 - Math.cos(Math.PI * t) / 2);
    const aLop = Math.exp(-2 * Math.PI * (fc + fc * 0.3) / SR);
    const aHip = Math.exp(-2 * Math.PI * Math.max(20, fc - fc * 0.3) / SR);
    lo = (1 - aLop) * arr[i] + aLop * lo;
    hi = (1 - aHip) * arr[i] + aHip * hi;
    out[i] = lo - hi;
  }
  return out;
};

const fadeEdges = (arr, sec) => {
  const n = Math.floor(sec * SR);
  for (let i = 0; i < Math.min(n, Math.floor(arr.length / 2)); i++) {
    const g = i / n;
    arr[i] *= g;
    arr[arr.length - 1 - i] *= g;
  }
  return arr;
};

// অ্যাটাক/রিলিজ এনভেলপ — প্রতিটি কর্ড-বারের শুরু-শেষ নরম
const env = (i, n, atk = 0.3, rel = 0.5) => {
  const a = Math.min(1, i / (atk * n)), r = Math.min(1, (n - i) / (rel * n));
  return Math.max(0, Math.min(a, r));
};

function music(mood, file, seconds = 30) {
  const bpm = mood === 'calm' ? 62 : mood === 'upbeat' ? 108 : 90;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const scales = { calm: [285.76, 340.71, 381.71], upbeat: [392, 440, 493.88] };
  const roots = scales[mood] || [392, 440, 349.23];
  const N = Math.ceil(seconds * SR);
  const out = new Float32Array(N);
  const globalFade = (gt) => Math.min(1, gt / 2.2, Math.max(0, (seconds - gt) / 2.2));
  for (let pos = 0, barI = 0; pos < N; barI++) {
    const root = roots[barI % roots.length];
    const chord = [root / 2, root, root * 1.25, root * 1.5];
    const len = Math.min(N - pos, Math.floor(bar * SR));
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const gt = (pos + i) / SR;
      let v = 0;
      for (let k = 0; k < chord.length; k++) {
        const det = 1 + 0.0012 * (k % 2 ? 1 : -1);
        const env = Math.min(1, i / (SR * 1.8), (len - i) / (SR * 1.6));
        v += Math.sin(2 * Math.PI * chord[k] * t) * env * (0.055 / (k + 1));
        v += Math.sin(2 * Math.PI * chord[k] * det * t) * env * (0.055 / (k + 1)) * 0.7;
        v += Math.sin(2 * Math.PI * chord[k] * 2 * t) * env * 0.006;
      }
      if (mood !== 'calm') {
        const bi = i / SR / beat;
        const q = bi % 4;
        if (q < 0.5 || (q > 1.5 && q < 2.5) || q > 3) {
          v += Math.sin(2 * Math.PI * (72 + 18 * Math.exp(-t * 24)) * t) * Math.exp(-t * 9) * 0.2;
        }
        if (bi % 2 > 1 && bi % 2 < 1.5) {
          v += Math.sin(2 * Math.PI * 330 * t) * Math.exp(-(t - beat) * 14) * 0.06;
        }
      }
      out[pos + i] = v * 0.5 * env(i, Math.max(len, 1), 0.4, 0.6) * globalFade(gt);
    }
    pos += len;
  }
  lowpass(out, mood === 'calm' ? 900 : 1600);
  normalize(out, 0.42);
  fadeEdges(out, 0.8);
  writeWav(file, out, SR);
}

function sfx(kind, file) {
  const dur = kind === 'whoosh' ? 0.55 : kind === 'ding' ? 0.8 : kind === 'click' ? 0.09 : 0.14;
  const N = Math.floor(dur * SR);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR, p = i / N;
    if (kind === 'pop') out[i] = Math.sin(2 * Math.PI * (880 - 520 * p) * t) * Math.exp(-t * 34) * 0.8;
    else if (kind === 'ding') out[i] = (Math.sin(2 * Math.PI * 1318 * t) + 0.5 * Math.sin(2 * Math.PI * 1976 * t) + 0.2 * Math.sin(2 * Math.PI * 2637 * t)) * Math.exp(-t * 5.5) * 0.6;
    else if (kind === 'click') out[i] = ((Math.random() * 2 - 1) * 0.5 + 0.9 * Math.sin(2 * Math.PI * 1700 * t)) * Math.exp(-t * 120) * 0.7;
    else out[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) * 1.1;
  }
  if (kind === 'whoosh') {
    const swept = sweepBand(Array.from(out), 350, 2400);
    for (let i = 0; i < N; i++) out[i] = swept[i] * (0.35 + 0.65 * Math.sin(Math.PI * (i / N)));
  } else if (kind === 'click') {
    lowpass(out, 3600);
  } else if (kind === 'pop') {
    lowpass(out, 2600);
  }
  normalize(out, kind === 'whoosh' ? 0.5 : kind === 'click' ? 0.55 : 0.7);
  writeWav(file, out, SR);
}

const [, , kind, sub, file, seconds] = process.argv;
if (kind === 'music') music(sub, file, parseInt(seconds || '30', 10));
else if (kind === 'sfx') sfx(sub, file);
else { console.error('ব্যবহার: node synth_audio.mjs music <mood> <out.wav> [sec] | sfx <pop|ding|whoosh|click> <out.wav>'); process.exit(1); }
