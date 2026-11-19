import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const S = (k, d = '') => (process.env[k] ?? d).toString().trim();

const SPEC = (() => { try { return JSON.parse(fs.readFileSync('data/run.spec.json', 'utf8')) || {}; } catch { return {}; } })();
const cfgVal = (envKey, specKey, fallback, norm, valid) => {
  const raw = S(envKey);
  let v = raw !== '' ? raw : (SPEC[specKey] ?? '');
  if (norm) v = norm(String(v));
  if (v === '' || v === undefined || v === null) v = fallback;
  if (valid && !valid.includes(v)) v = fallback;
  return v;
};
const cfgNum = (envKey, specKey, fallback) => {
  let v = parseFloat(S(envKey) !== '' ? S(envKey) : (SPEC[specKey] ?? ''));
  if (!Number.isFinite(v)) v = parseFloat(SPEC[specKey]);
  if (!Number.isFinite(v)) v = fallback;
  return Math.max(0.25, Math.min(10, v));
};

const CFG = {
  mode: cfgVal('IN_MODE', 'mode', 'draft', s => s.toLowerCase().trim(), ['script_only', 'voice_test', 'draft', 'full']),
  minutes: cfgNum('IN_MINUTES', 'minutes', 1.5),
  aspect: cfgVal('IN_ASPECT', 'aspect', '9:16', s => s.trim(), ['9:16', '16:9', '1:1', '4:5']),
  kind: cfgVal('IN_KIND', 'kind', 'B', s => s.toUpperCase().trim(), ['A', 'B', 'C']),
  theme: cfgVal('IN_THEME', 'theme', 'warm', s => s.toLowerCase().trim()),
  music: cfgVal('IN_MUSIC', 'music', 'auto', s => s.toLowerCase().trim(), ['auto', 'off', 'upbeat', 'calm']),
  topic: cfgVal('IN_TOPIC', 'topic', ''),
  project: cfgVal('IN_PROJECT', 'project', ''),
  brief: cfgVal('IN_BRIEF', 'brief', ''),
  script: cfgVal('IN_SCRIPT', 'script', ''),
  runId: String(SPEC.run_id || 'manual'),
  geminiKey: S('GEMINI_API_KEY'),
  cartesiaKey: S('CARTESIA_API_KEY'),
  voiceId: S('CARTESIA_VOICE_ID'),
  pixabayKey: S('PIXABAY_API_KEY'),
  pexelsKey: S('PEXELS_API_KEY'),
};

const J = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const T = (f, d = '') => { try { return fs.readFileSync(f, 'utf8'); } catch { return d; } };
const W = (f, c) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); };

const providers = J('providers.json', {
  script_models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
  voice: ['cartesia_sonic3', 'edge_tts'],
  visual: ['pixabay_video', 'pixabay_photo', 'pollinations'],
  music: ['user_file', 'synth'],
});
const presets = J('projects.json', {});
const pronounce = J('pronounce.json', {});
const projectTxt = T('project.txt', '');

const LOGF = process.env.PIPE_LOG || 'data/log.txt';
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  fs.mkdirSync(path.dirname(LOGF), { recursive: true });
  fs.appendFileSync(LOGF, line + '\n');
};
const die = (m) => { log(`মারাত্মক ত্রুটি: ${m}`); process.exit(1); };

const ASPECTS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const FPS = 30;

const retry = async (n, fn, tag) => {
  let last;
  for (let i = 1; i <= n; i++) {
    try { return await fn(i); } catch (e) { last = e; log(`${tag} চেষ্টা ${i}/${n} ব্যর্থ: ${String(e).slice(0, 200)}`); }
  }
  throw last;
};

async function jfetch(url, opt = {}, ms = 120000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
  } finally { clearTimeout(t); }
}

function run(cmd, args, tag, ms = 600000) {
  if (process.env.PIPE_DRY === '1') return { stdout: '' };
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: ms, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${tag} ব্যর্থ (exit=${r.status}, signal=${r.signal}, err=${r.error?.message || '-'}): ${(r.stderr || r.stdout || '(আউটপুট খালি)').slice(-500)}`);
  return r;
}

let modelUsed = null;
async function gemini(prompt, { json = false, temp = 0.8 } = {}) {
  if (!CFG.geminiKey) throw new Error('GEMINI_API_KEY নেই');
  const models = (process.env.GEMINI_MODEL_CHAIN || providers.script_models.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  let last = null;
  for (const model of models) {
    for (let a = 1; a <= 2; a++) {
      try {
        const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: temp, maxOutputTokens: 8192 } };
        if (json) body.generationConfig.responseMimeType = 'application/json';
        const r = await jfetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CFG.geminiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const d = await r.json();
        const text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
        if (!text) throw new Error('খালি উত্তর (সম্ভবত সেফটি ব্লক)');
        modelUsed = model;
        return text;
      } catch (e) {
        last = e;
        log(`Gemini ${model} চেষ্টা ${a}/2 ব্যর্থ: ${String(e).slice(0, 150)}`);
        if (/HTTP 4(29|03|00)/.test(String(e)) && a === 1) break;
      }
    }
    log(`Gemini: মডেল ${model} থেকে পরেরটায় ফলব্যাক`);
  }
  throw last || new Error('Gemini সব মডেল ব্যর্থ');
}

const tryParseJson = (text) => {
  const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : text);
};

// ---------- স্ক্রিপ্ট ----------
function planPrompt(kind, theme) {
  return `তুমি বাংলা ভিডিও পরিকল্পক। শুধু JSON দাও, এই কাঠামোয়:
{"scenes":[{"text":"দৃশ্যের হুবহু ন্যারেশন অংশ","imageQuery":"ছবি খোঁজার জন্য সহজ ইংরেজি কীওয়ার্ড","effects":["উপযুক্ত হলে: icon:🤖 | counter:0,100,5 | stamp-red:টেক্সট | stamp-green:টেক্সট | bar:70 | slider | quiz:প্রশ্ন?|সঠিক|ভুল১|ভুল২ | spotlight | map | effect লাগবে না হলে খালি স্ট্রিং"]}],"title":"ইউটিউব টাইটেল (বাংলা, ৮০ অক্ষরের মধ্যে)","description":"ইউটিউব বর্ণনা, ২-৩ বাক্য","hashtags":["#বাংলা","#..."],"thumbText":"থাম্বনেইলে বড় করে লেখা ৩-৫ শব্দ","keywordsRed":["ক্যাপশনে লাল করার নেতিবাচক শব্দ"],"keywordsGreen":["সবুজ করার ইতিবাচক শব্দ"],"musicMood":"upbeat|calm"}
নিয়ম: scenes[].text জোড়া দিলে হুবহু পূর্ণ স্ক্রিপ্ট হবে (কোনো শব্দ বাদ/যোগ/বদল নয়)। দৃশ্য ৮-১৪টি, প্রতিটি ১-২ বাক্য। ধরন: ${kind} (A=টিউটোরিয়াল, B=ফ্ল্যাট কার্টুন-ব্যাখ্যা+কুইজ, C=ম্যাপ/ডেটা+কাউন্টার)। theme: ${theme}. ইফেক্ট সব দৃশ্যে নয়, যেখানে অর্থবহ; কমপক্ষে ৩টি দৃশ্যে। imageQuery ইংরেজিতে সহজ, ধরনের স্টাইলে।`;
}

async function buildScript() {
  const targetWords = Math.round(CFG.minutes * 60 * 2.3);
  const preset = CFG.project && presets[CFG.project] ? presets[CFG.project] : {};
  const theme = preset.theme || CFG.theme;
  const kind = preset.kind || CFG.kind;
  const prons = Object.entries(pronounce).map(([a, b]) => `${a} → ${b}`).join('; ');

  if (CFG.script && CFG.mode === 'voice_test') {
    const narration = CFG.script.replace(/\r/g, '').trim();
    const parts = narration.split(/(?<=[।!?])\s+/).filter(s => s.trim().length);
    let texts;
    if (parts.length < 2) texts = [narration];
    else { const h = Math.ceil(parts.length / 2); texts = [parts.slice(0, h).join(' '), parts.slice(h).join(' ')]; }
    log(`ভয়েস-টেস্ট: Gemini-বিহীন, ${texts.length}টি ভাগ, ${narration.length} অক্ষর`);
    return { narration, scenes: texts.map(t => ({ text: t })), title: 'ভয়েস টেস্ট', description: '', hashtags: [], thumbText: 'ভয়েস টেস্ট', keywordsRed: [], keywordsGreen: [], musicMood: 'calm', theme, kind };
  }

  if (CFG.script) {
    const narration = CFG.script.replace(/\r/g, '').trim();
    log(`স্ক্রিপ্ট: ব্যবহারকারীর লেখা হুবহু (${narration.length} অক্ষর), শব্দ পরিবর্তন নেই`);
    const planP = await gemini(`${planPrompt(kind, theme)}\n\nনিচের স্ক্রিপ্টের প্রতিটি শব্দ অপরিবর্তিত রাখতে হবে। শুধু দৃশ্যে ভাগ করো, ছবি/ইফেক্ট/মেটাডেটা বানাও।\n\nস্ক্রিপ্ট:\n${narration}`, { json: true, temp: 0.4 });
    return { narration, ...tryParseJson(planP), theme, kind, metaOnly: true };
  }

  log(`স্ক্রিপ্ট: টপিক থেকে লেখা হচ্ছে (Gemini, কথ্য বাংলা, ${kind})`);
  let narration = await gemini(
    `${projectTxt}\n\nটপিক: ${CFG.topic || 'রোজকার জীবনে কাজে লাগে এমন একটি চমকপ্রদ তথ্য'}\nটার্গেট: আনুমানিক ${targetWords} শব্দ, একটানা প্যারাগ্রাফ।\nউচ্চারণ-তালিকা (ইংরেজি শব্দ ঠিক এভাবে বাংলা হরফে লিখবে): ${prons || 'নেই'}\nধরন ${kind}: ${kind === 'A' ? 'সহজ টিউটোরিয়াল, ধাপে ধাপে, উদাহরণসহ' : kind === 'C' ? 'তথ্য/ম্যাপ/সংখ্যাভিত্তিক, আকর্ষণীয় তথ্য-উপস্থাপনা' : 'গল্পের ছলে ব্যাখ্যা, কুইজ/চ্যালেঞ্জ আবহ'}।\n${CFG.brief ? 'অতিরিক্ত নির্দেশ: ' + CFG.brief + '\n' : ''}শুধু স্ক্রিপ্ট লেখো — শিরোনাম, মার্কডাউন, কমেন্ট, দৃশ্য-নাম্বার কিছুই নয়। মুখে বলার মতো স্বাভাবিক, আবেগ আছে, এআই-সুলভ খাঁটি-বাক্য নয়।`);
  for (let i = 1; i <= 3; i++) {
    const rev = await gemini(`তুমি কড়া সম্পাদক। নিচের বাংলা ভয়েসওভার স্ক্রিপ্টে বানান, ব্যাকরণ, ভাঙা বাক্য ও এআই-সুলভ ভাষা ঠিক করো। মানে ও দৈর্ঘ্য কাছাকাছি রাখবে, কথ্য স্বাভাবিক রাখবে। শুধু চূড়ান্ত স্ক্রিপ্ট লিখবে।\n\nরিভিউ ${i}/3\n\n${narration}`, { temp: 0.5 });
    if (rev && rev.length >= narration.length * 0.6) { narration = rev; log(`স্ক্রিপ্ট রিভিউ ${i}/3 প্রয়োগ`); }
  }
  const planP = await gemini(`${planPrompt(kind, theme)}\n\nস্ক্রিপ্ট (শব্দ বদল নয়, শুধু ভাগ):\n${narration}`, { json: true, temp: 0.4 });
  return { narration, ...tryParseJson(planP), theme, kind };
}

// ---------- ভয়েস ----------
const probeSec = (file) => {
  const head = Buffer.from(fs.readFileSync(file).slice(0, 16)).toString('utf8').replace(/[^\x20-\x7e]/g, '.');
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], 'ffprobe', 60000);
  const d = parseFloat(r.stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe সময় পড়তে পারেনি (${file}, সাইজ=${fs.statSync(file).size}, শুরুটা='${head}')`);
  return d;
};

function silences(file) {
  const r = spawnSync('ffmpeg', ['-i', file, '-af', 'silencedetect=noise=-35dB:d=0.25', '-f', 'null', '-'],
    { encoding: 'utf8', timeout: 300000 });
  const out = (r.stderr || '') + (r.stdout || '');
  const res = []; let s = null;
  for (const m of out.matchAll(/silence_(start|end): ([-\d.]+)/g)) {
    if (m[1] === 'start') s = parseFloat(m[2]);
    else if (s != null) { res.push({ start: s, end: parseFloat(m[2]) }); s = null; }
  }
  return res;
}

const ttsText = (t) => { let s = t; for (const [a, b] of Object.entries(pronounce)) s = s.split(a).join(b); return s; };

async function voiceCartesia(text, file) {
  if (!CFG.cartesiaKey) throw new Error('CARTESIA_API_KEY নেই');
  if (!CFG.voiceId) throw new Error('CARTESIA_VOICE_ID নেই');
  const body = { model_id: 'sonic-3', transcript: text, voice: CFG.voiceId, language: 'bn', output_format: { container: 'mp3', bitrate: 128000 } };
  if (process.env.CARTESIA_EXTRA) Object.assign(body, tryParseJson('{' + process.env.CARTESIA_EXTRA + '}'));
  const r = await jfetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: { 'X-API-Key': CFG.cartesiaKey, 'Cartesia-Version': '2024-06-10', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  if (fs.statSync(file).size < 2000) throw new Error('Cartesia অডিও খুব ছোট');
  return file;
}

async function voiceEdge(text, file) {
  const inst = spawnSync('python3', ['-m', 'edge_tts', '--help'], { encoding: 'utf8', timeout: 60000 });
  if (inst.status !== 0) run('python3', ['-m', 'pip', 'install', '--quiet', 'edge-tts'], 'pip-edge-tts', 180000);
  const v = process.env.EDGE_VOICE || 'bn-BD-NabanitaNeural';
  W('/tmp/tts_input.txt', text);
  run('python3', ['-m', 'edge_tts', `--voice=${v}`, '--file=/tmp/tts_input.txt', `--write-media=${file}`], 'edge-tts', 180000);
  if (fs.statSync(file).size < 1000) throw new Error('edge-tts অডিও খুব ছোট');
  return file;
}

function concatVoice(scenes, out) {
  const list = scenes.map(s => `file '${path.resolve(s.voiceFile).replace(/'/g, '')}'`).join('\n');
  W(`${OUT}/list.txt`, list);
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', `${OUT}/list.txt`, '-c:a', 'libmp3lame', '-q:a', '3', out], 'ffmpeg-voice-concat', 300000);
}

const OUT = 'out';

async function buildVoice(scenes) {
  if (fs.existsSync('assets/voice.mp3')) {
    log('ভয়েস: ব্যবহারকারীর নিজের অডিও (assets/voice.mp3) — ক্লোন ভয়েস বাদ');
    const total = probeSec('assets/voice.mp3');
    const sum = scenes.reduce((a, s) => a + Math.max(1, s.text.length), 0);
    const bounds = scenes.map((s, i) => scenes.slice(0, i + 1).reduce((a, x) => a + Math.max(1, x.text.length), 0) / sum * total);
    const mids = silences('assets/voice.mp3').filter(x => x.end - x.start > 0.3).map(x => (x.start + x.end) / 2);
    bounds.forEach((b, i) => {
      if (i < scenes.length - 1 && mids.length) {
        const cand = mids.reduce((p, q) => (Math.abs(q - b) < Math.abs(p - b) ? q : p), mids[0]);
        if (cand != null && Math.abs(cand - b) < 1.5) bounds[i] = cand;
      } else if (i === scenes.length - 1) bounds[i] = total;
    });
    let start = 0;
    scenes.forEach((s, i) => { s.start = start; s.dur = Math.max(0.8, bounds[i] - start); start = bounds[i]; });
    log(`ভয়েস: নিজের অডিও ${total.toFixed(1)} সেকেন্ড, বিরতি দেখে দৃশ্য-সময় মেলানো`);
    return { file: 'assets/voice.mp3', path: 'user_audio', total: Math.max(total, start) };
  }

  if (scenes.length > 200) throw new Error('অস্বাভাবিক দৃশ্য-সংখ্যা');
  for (const provider of providers.voice) {
    try {
      for (const s of scenes) {
        s.voiceFile = `${OUT}/voice-${s.index}.mp3`;
        await retry(2, async () => {
          const f = provider === 'cartesia_sonic3' ? await voiceCartesia(ttsText(s.text), s.voiceFile) : await voiceEdge(ttsText(s.text), s.voiceFile);
          s.dur = Math.max(0.8, probeSec(f));
        }, `ভয়েস ${provider} দৃশ্য ${s.index}`);
      }
      let acc = 0; scenes.forEach(s => { s.start = +acc.toFixed(2); acc += s.dur + 0.25; });
      concatVoice(scenes, `${OUT}/voice_full.mp3`);
      log(`ভয়েস পথ: ${provider}${provider === 'cartesia_sonic3' ? ' (আপনার ক্লোন)' : ' (ফলব্যাক, ক্লোন নয়)'}, মোট ${acc.toFixed(1)} সেকেন্ড`);
      return { file: `${OUT}/voice_full.mp3`, path: provider, total: acc };
    } catch (e) { log(`ভয়েস পথ ${provider} ব্যর্থ: ${String(e).slice(0, 250)}`); }
  }
  throw new Error('কোনো ভয়েস পথই চলেনি');
}

// ---------- ভিজ্যুয়াল ----------
async function download(url, file) {
  const r = await jfetch(url, {}, 90000);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 20000) throw new Error('ফাইল খুব ছোট');
  fs.writeFileSync(file, buf);
  return file;
}

async function pixabay(q, file, wantVideo) {
  if (!CFG.pixabayKey) throw new Error('PIXABAY_API_KEY নেই');
  if (wantVideo) {
    const r = await jfetch(`https://pixabay.com/api/videos/?key=${CFG.pixabayKey}&q=${encodeURIComponent(q)}&per_page=7&safesearch=true`);
    const hits = (await r.json()).hits || [];
    const v = hits.map(h => h.videos && (h.videos.medium || h.videos.small || h.videos.tiny)).filter(Boolean)[0];
    if (!v) throw new Error('ভিডিও নেই');
    return download(v.url, file);
  }
  const r = await jfetch(`https://pixabay.com/api/?key=${CFG.pixabayKey}&q=${encodeURIComponent(q)}&per_page=7&image_type=photo&safesearch=true`);
  const hits = (await r.json()).hits || [];
  const u = hits.map(h => h.largeImageURL || h.webformatURL).filter(Boolean)[0];
  if (!u) throw new Error('ছবি নেই');
  return download(u, file);
}

async function pexelsPhoto(q, file) {
  if (!CFG.pexelsKey) throw new Error('PEXELS_API_KEY নেই');
  const r = await jfetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=5`, { headers: { Authorization: CFG.pexelsKey } });
  const u = ((await r.json()).photos || []).map(p => p.src?.large2x || p.src?.large).filter(Boolean)[0];
  if (!u) throw new Error('ছবি নেই');
  return download(u, file);
}

async function pollinations(q, file, w, h) {
  const style = { A: 'modern tech, clean, vivid', B: 'flat vector illustration, cartoon, minimal, kid-friendly', C: 'minimal infographic style, map, data' }[CFG.kind] || '';
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(q + ', ' + style)}?width=${Math.min(1280, w)}&height=${Math.min(1280, h)}&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
  return download(url, file);
}

async function buildVisuals(scenes, rw, rh) {
  const chain = providers.visual.filter(v =>
    v === 'pollinations' ? true : v.startsWith('pixabay') ? !!CFG.pixabayKey : !!CFG.pexelsKey);
  for (const s of scenes) {
    let done = false;
    for (const v of chain) {
      try {
        if (v === 'pixabay_video') { s.asset = await pixabay(s.imageQuery, `${OUT}/scene-${s.index}.mp4`, true); s.assetType = 'video'; done = true; }
        else if (v === 'pixabay_photo') { s.asset = await pixabay(s.imageQuery, `${OUT}/scene-${s.index}.jpg`, false); s.assetType = 'photo'; done = true; }
        else if (v === 'pexels_photo') { s.asset = await pexelsPhoto(s.imageQuery, `${OUT}/scene-${s.index}.jpg`); s.assetType = 'photo'; done = true; }
        else if (v === 'pollinations') { s.asset = await pollinations(s.imageQuery, `${OUT}/scene-${s.index}.jpg`, rw, rh); s.assetType = 'photo'; done = true; }
        if (done) break;
      } catch (e) { log(`ছবি দৃশ্য ${s.index} পথ ${v} ব্যর্থ: ${String(e).slice(0, 120)}`); }
    }
    if (!done) { s.asset = null; s.assetType = 'gradient'; log(`ছবি দৃশ্য ${s.index}: সব পথ ব্যর্থ — গ্রেডিয়েন্ট ফলব্যাক`); }
    else log(`ছবি দৃশ্য ${s.index}: ${s.assetType} (${s.asset})`);
  }
}

// ---------- গান ও এসএফএক্স ----------
function buildMusic(total, mood) {
  if (CFG.music === 'off') { log('গান: বন্ধ রাখা হয়েছে'); return null; }
  if (fs.existsSync('assets/music.mp3')) { log('গান: assets/music.mp3 ব্যবহার'); return { file: 'assets/music.mp3', volume: 0.14 }; }
  const mv = ['upbeat', 'calm'].includes(CFG.music) ? CFG.music : (mood === 'calm' ? 'calm' : 'upbeat');
  run('node', ['tools/synth_audio.mjs', 'music', mv, `${OUT}/music_raw.wav`, String(Math.min(240, Math.ceil(total) + 2))], 'synth-music', 120000);
  run('ffmpeg', ['-y', '-i', `${OUT}/music_raw.wav`, '-c:a', 'libmp3lame', '-q:a', '5', `${OUT}/music.mp3`], 'music-mp3', 120000);
  log(`গান: অটো-সিন্থ (${mv})`);
  return { file: `${OUT}/music.mp3`, volume: 0.12 };
}

function buildSfx() {
  if (process.env.PIPE_DRY === '1') return;
  fs.mkdirSync(`${OUT}/sfx`, { recursive: true });
  if (fs.existsSync(`${OUT}/sfx/pop.wav`)) return;
  for (const sfx of ['pop', 'ding', 'whoosh']) run('node', ['tools/synth_audio.mjs', 'sfx', sfx, `${OUT}/sfx/${sfx}.wav`], `sfx-${sfx}`, 60000);
  log('এসএফএক্স: সিন্থ pop/ding/whoosh তৈরি');
}

// ---------- SRT ----------
const fmt = (t) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60), ms = Math.round((t - Math.floor(t)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

function buildCues(scenes, keyRed, keyGreen) {
  const cues = [];
  for (const s of scenes) {
    const words = s.text.split(/\s+/).filter(Boolean);
    const perChar = s.dur / (words.reduce((a, w) => a + w.length + 1, 0) || 1);
    const chunkMax = s.dur > 6 ? 4 : 3;
    const chunks = [];
    let c = [];
    for (const w of words) {
      if (c.length >= chunkMax) { chunks.push(c); c = []; }
      c.push(w);
    }
    if (c.length) chunks.push(c);
    let time = s.start;
    for (const ch of chunks) {
      const dur = Math.max(0.5, ch.reduce((a, w) => a + w.length + 1, 0) * perChar);
      const wd = ch.reduce((a, w) => a + w.length + 1, 0) || 1;
      cues.push({
        text: ch.join(' '), start: +time.toFixed(2), dur: +dur.toFixed(2),
        words: ch.map((w, i) => ({
          w,
          start: +(time + ch.slice(0, i).reduce((a, x) => a + x.length + 1, 0) / wd * dur).toFixed(2),
          dur: +((w.length + 1) / wd * dur).toFixed(2),
          color: keyRed.includes(w) ? 'red' : keyGreen.includes(w) ? 'green' : null,
        })),
      });
      time += dur;
    }
  }
  return cues;
}

// ---------- মূল ----------
const main = async () => {
  W('data/last_run.json', JSON.stringify({ run_id: CFG.runId, mode: CFG.mode, started_at: new Date().toISOString() }, null, 2));
  log(`শুরু: run_id=${CFG.runId}, mode=${CFG.mode}, minutes=${CFG.minutes}, aspect=${CFG.aspect}, kind=${CFG.kind}, theme=${CFG.theme}, music=${CFG.music}, project=${CFG.project || '-'}`);
  fs.mkdirSync(OUT, { recursive: true });

  const plan = await retry(3, buildScript, 'স্ক্রিপ্ট-ধাপ');
  W(`${OUT}/script.md`, plan.narration || '');
  W(`${OUT}/metadata.json`, JSON.stringify({ title: plan.title || CFG.topic, description: plan.description || '', hashtags: plan.hashtags || [], thumbText: plan.thumbText || plan.title || '' }, null, 2));
  log(`স্ক্রিপ্ট তৈরি: ${(plan.narration || '').length} অক্ষর, ${plan.model || ''} মেটাডেটা সহ (Gemini মডেল: ${modelUsed})`);
  if (CFG.mode === 'script_only') { log('মোড script_only — শেষ'); return; }

  buildSfx();
  const rawScenes = (plan.scenes || []).map((s, i) => ({
    index: i, text: String(s?.text || '').trim(),
    imageQuery: String(s?.imageQuery || CFG.topic || 'abstract background').slice(0, 120),
    effects: (s?.effects || []).map(e => String(e)).filter(Boolean).slice(0, 3),
  })).filter(s => s.text.length);
  if (!rawScenes.length) rawScenes.push({ index: 0, text: plan.narration, imageQuery: CFG.topic, effects: [] });
  log(`দৃশ্য: ${rawScenes.length}টি`);

  const voice = await buildVoice(rawScenes);
  const cues = buildCues(rawScenes, plan.keywordsRed || [], plan.keywordsGreen || []);
  W(`${OUT}/subs.srt`, cues.map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.start + c.dur)}\n${c.text}\n`).join('\n'));
  log(`SRT তৈরি: ${cues.length} ক্যাপশন`);
  if (CFG.mode === 'voice_test') { log('মোড voice_test — রেন্ডার বাদ, শেষ'); return; }

  const [Wd, Hd] = ASPECTS[CFG.aspect];
  const sc = CFG.mode === 'draft' ? 0.5 : 1;
  const RW = Math.round(Wd * sc / 2) * 2, RH = Math.round(Hd * sc / 2) * 2;

  await buildVisuals(rawScenes, RW, RH);
  const music = buildMusic(voice.total, plan.musicMood || 'upbeat');

  rawScenes.forEach(s => {
    s.cues = cues.filter(c => c.start >= s.start - 0.5 && c.start < s.start + s.dur + 0.5);
    s.effects = s.effects.map((e, k) => ({ spec: e, at: +(s.start + s.dur * (0.3 + k * 0.3)).toFixed(2) }));
  });

  const props = {
    fps: FPS, width: RW, height: RH, kind: plan.kind, theme: plan.theme,
    music, scenes: rawScenes,
    thumb: { text: plan.thumbText || plan.title || 'ভিডিও', asset: rawScenes[0]?.asset || null, kind: plan.kind },
  };
  W(`${OUT}/props.json`, JSON.stringify(props, null, 1));

  const tag = `${CFG.mode}-${CFG.aspect.replace(':', 'x')}`;
  const outV = `${OUT}/video_${tag}.mp4`;
  const renderArgs = (crf, extra) => ['remotion', 'render', 'src/index.jsx', 'Main', outV, '--props', `${OUT}/props.json`, '--codec', 'h264', '--crf', crf, '--log', 'error', ...(extra || [])];
  try {
    run('npx', renderArgs(CFG.mode === 'draft' ? '30' : '23', ['--concurrency', process.env.RENDER_CONCURRENCY || '2']), 'remotion-render', 2400000);
    log(`রেন্ডার শেষ: ${outV}`);
  } catch (e) {
    log(`সাধারণ রেন্ডার ব্যর্থ, হালকা প্রিসেটে আবার: ${String(e).slice(0, 250)}`);
    run('npx', renderArgs('35', ['--concurrency', '1', '--jpeg-quality', '60']), 'remotion-render-fallback', 2400000);
    log(`ফলব্যাক রেন্ডার শেষ: ${outV}`);
  }
  try {
    run('npx', ['remotion', 'still', 'src/index.jsx', 'Thumb', `${OUT}/thumb.jpg`, '--props', `${OUT}/props.json`, '--quality', '90', '--log', 'error'], 'remotion-thumb', 240000);
    log('থাম্বনেইল তৈরি');
  } catch (e) { log(`থাম্বনেইল ব্যর্থ: ${String(e).slice(0, 200)}`); }

  W(`${OUT}/summary.json`, JSON.stringify({
    mode: CFG.mode, aspect: CFG.aspect, kind: plan.kind, theme: plan.theme,
    voicePath: voice.path, geminiModel: modelUsed, totalSec: +voice.total.toFixed(1),
    scenes: rawScenes.length, music: music ? music.file : 'off',
  }, null, 2));
  log(`সম্পন্ন — আউটপুট আর্টিফ্যাক্টে (${OUT}/)`);
};

main().catch(e => { console.error(e); die(e.stack || String(e)); });
