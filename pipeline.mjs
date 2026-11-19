import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const S = (k, d = '') => (process.env[k] ?? d).toString().trim();

const SPEC = (() => { try { return JSON.parse(fs.readFileSync('data/run.spec.json', 'utf8')) || {}; } catch { return {}; } })();

// ড্যাশবোর্ড থেকে আপডেট করা যায় এমন সেন্ট্রাল কনফিগ (কোড ছাড়াই পরিবর্তনযোগ্য)
const J_ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const WCFG = J_('config/workflow_config.json', {});
const WCFGD = WCFG.defaults || {};
const WCFGM = WCFG.modules || {};

const cfgVal = (envKey, specKey, fallback, norm, valid) => {
  const raw = S(envKey);
  let v = raw !== '' ? raw : (SPEC[specKey] ?? WCFGD[specKey] ?? '');
  if (norm) v = norm(String(v));
  if (v === '' || v === undefined || v === null) v = WCFGD[specKey] ?? fallback;
  if (valid && !valid.includes(v)) v = WCFGD[specKey] ?? fallback;
  return v;
};
const cfgNum = (envKey, specKey, fallback) => {
  let v = parseFloat(S(envKey) !== '' ? S(envKey) : (SPEC[specKey] ?? WCFGD[specKey] ?? ''));
  if (!Number.isFinite(v)) v = parseFloat(WCFGD[specKey]);
  if (!Number.isFinite(v)) v = fallback;
  return Math.max(0.25, Math.min(10, v));
};

const CFG = {
  mode: cfgVal('IN_MODE', 'mode', 'draft', s => s.toLowerCase().trim(), ['script_only', 'voice_test', 'draft', 'full']),
  minutes: cfgNum('IN_MINUTES', 'minutes', 1.5),
  aspect: cfgVal('IN_ASPECT', 'aspect', '9:16', s => s.trim()),
  resolution: cfgVal('IN_RESOLUTION', 'resolution', '', s => s.toLowerCase().trim(), ['', '480p', '720p', '1080p']),
  kind: cfgVal('IN_KIND', 'kind', 'B', s => s.toUpperCase().trim(), ['A', 'B', 'C']),
  theme: cfgVal('IN_THEME', 'theme', 'warm', s => s.toLowerCase().trim()),
  music: cfgVal('IN_MUSIC', 'music', 'auto', s => s.toLowerCase().trim(), ['auto', 'off', 'upbeat', 'calm']),
  visual: cfgVal('IN_VISUAL', 'visual', 'code', s => s.toLowerCase().trim(), ['code', 'stock']),
  iconPref: (S('IN_ICONS') || (WCFGD.icons || '')).split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean),
  edgeVoice: S('EDGE_VOICE') || (WCFG.tts && WCFG.tts.edge_voice) || 'bn-BD-NabanitaNeural',
  voicePreset: (S('TTS_PRESET') || (WCFG.tts && WCFG.tts.preset) || 'podcast').trim(),
  voiceGap: (() => { const g = parseFloat(S('VOICE_GAP') ?? (WCFG.tts && WCFG.tts.gap)); return Number.isFinite(g) ? Math.max(0, Math.min(2, g)) : 0.25; })(),
  topic: cfgVal('IN_TOPIC', 'topic', ''),
  project: cfgVal('IN_PROJECT', 'project', ''),
  brief: cfgVal('IN_BRIEF', 'brief', ''),
  script: cfgVal('IN_SCRIPT', 'script', ''),
  runId: String(SPEC.run_id || 'manual'),
  voiceId: S('CARTESIA_VOICE_ID'),
  voiceIds: `${S('CARTESIA_VOICE_IDS')},${S('CARTESIA_VOICE_ID')}`.split(/[\s,;]+/).map(s => s.trim()).filter(s => /^[a-zA-Z0-9-]{4,}$/.test(s)),
};

// এক সার্ভিসের জন্য অনেক কী: GEMINI_API_KEYS="k1,k2" বা নতুন লাইন দিয়ে। পুরনো একক GEMINI_API_KEY-ও চলবে।
const keysOf = (multiEnv, singleEnv) => `${S(multiEnv)},${S(singleEnv)}`.split(/[\s,;]+/).map(s => s.trim()).filter(s => s.length > 8);
const keyPools = {
  gemini: keysOf('GEMINI_API_KEYS', 'GEMINI_API_KEY'),
  cartesia: keysOf('CARTESIA_API_KEYS', 'CARTESIA_API_KEY'),
  pixabay: keysOf('PIXABAY_API_KEYS', 'PIXABAY_API_KEY'),
  pexels: keysOf('PEXELS_API_KEYS', 'PEXELS_API_KEY'),
  groq: keysOf('GROQ_API_KEYS', 'GROQ_API_KEY'),
  openrouter: keysOf('OPENROUTER_API_KEYS', 'OPENROUTER_API_KEY'),
};
CFG.geminiKeys = keyPools.gemini;
CFG.cartesiaKeys = keyPools.cartesia;
CFG.pixabayKeys = keyPools.pixabay;
CFG.pexelsKeys = keyPools.pexels;
CFG.groqKeys = keyPools.groq;
CFG.openrouterKeys = keyPools.openrouter;
CFG.geminiKey = CFG.geminiKeys[0] || '';
CFG.cartesiaKey = CFG.cartesiaKeys[0] || '';
CFG.pixabayKey = CFG.pixabayKeys[0] || '';
CFG.pexelsKey = CFG.pexelsKeys[0] || '';

const J = J_;
const T = (f, d = '') => { try { return fs.readFileSync(f, 'utf8'); } catch { return d; } };
const W = (f, c) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); };

const providers = {
  script_models: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
  voice: ['cartesia_sonic3', 'edge_tts'],
  visual: ['pixabay_video', 'pixabay_photo', 'pollinations'],
  music: ['user_file', 'synth'],
  ...J_('providers.json', {}),
  ...(WCFG.providers || {}),
};
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

const keyOk = (pool) => Array.isArray(pool) && pool.length > 0;
const keyLog = (pool, i, ok, msg = '') => log(`${ok ? '✔ কী চলেছে' : '✖ কী ব্যর্থ'} [${pool==='gemini'?'Gemini':pool==='groq'?'Groq':pool==='openrouter'?'OpenRouter':pool==='pixabay'?'Pixabay':pool==='pexels'?'Pexels':'Cartesia'}] #${i + 1}/${keyPools[pool]?.length || 0}${msg ? ' — ' + msg : ''}`);

const waitMs = (ms) => new Promise(r => setTimeout(r, ms));

const retry = async (n, fn, tag) => {
  let last;
  for (let i = 1; i <= n; i++) {
    try { return await fn(i); } catch (e) {
      last = e;
      log(`${tag} চেষ্টা ${i}/${n} ব্যর্থ: ${String(e).slice(0, 200)}`);
      if (i < n) await waitMs(i * 30000);
    }
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
  if (!keyOk(CFG.geminiKeys)) throw new Error('GEMINI_API_KEY / GEMINI_API_KEYS কোনোটিই নেই');
  const models = (process.env.GEMINI_MODEL_CHAIN || providers.script_models.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  let last = null;
  for (const model of models) {
    for (const key of CFG.geminiKeys) {
      const ki = CFG.geminiKeys.indexOf(key);
      for (let a = 1; a <= 2; a++) {
        try {
          const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: temp, maxOutputTokens: 8192 } };
          if (json) body.generationConfig.responseMimeType = 'application/json';
          const r = await jfetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
          const d = await r.json();
          const text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
          if (!text) throw new Error('খালি উত্তর (সম্ভবত সেফটি ব্লক)');
          modelUsed = model;
          keyLog('gemini', ki, true);
          return text;
        } catch (e) {
          last = e;
          keyLog('gemini', ki, false, String(e).slice(0, 150));
          if (/current quota|plan and billing/i.test(String(e))) throw new Error('Gemini দৈনিক কোটা শেষ (429) — ফলব্যাক প্রোভাইডার ব্যবহার হবে');
          if (/HTTP 429/.test(String(e))) await waitMs(45000);
          else if (/HTTP 503|AbortError|aborted/i.test(String(e))) await waitMs(45000);
          if (/HTTP 4(29|03|00)/.test(String(e))) break;
        }
      }
    }
    log(`Gemini: মডেল ${model} থেকে পরেরটায় ফলব্যাক`);
  }
  throw last || new Error('Gemini সব মডেল ব্যর্থ');
}

// ফলব্যাক টেক্সট-প্রোভাইডার: Groq (ফ্রি কী), OpenRouter (ফ্রি কী), Pollinations (কী ছাড়া)
async function openaiChat(base, key, model, prompt, { json = false, temp = 0.8 } = {}) {
  const body = { model, temperature: temp, messages: [{ role: 'user', content: prompt }] };
  if (json) body.response_format = { type: 'json_object' };
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const r = await jfetch(base, { method: 'POST', headers, body: JSON.stringify(body) }, 90000);
  const d = await r.json();
  const text = (d.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('খালি উত্তর');
  return text;
}

async function groq(prompt, opts = {}) {
  if (!keyOk(CFG.groqKeys)) throw new Error('GROQ_API_KEY(S) নেই');
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  let last = null;
  for (const model of models) {
    for (const key of CFG.groqKeys) {
      const ki = CFG.groqKeys.indexOf(key);
      try {
        const text = await openaiChat('https://api.groq.com/openai/v1/chat/completions', key, model, prompt, opts);
        modelUsed = `groq:${model}`;
        keyLog('groq', ki, true);
        return text;
      } catch (e) {
        last = e;
        keyLog('groq', ki, false, String(e).slice(0, 150));
        if (/HTTP 429/.test(String(e))) await waitMs(20000);
        if (/HTTP 4(29|03|00)/.test(String(e))) break;
      }
    }
  }
  throw last || new Error('Groq ব্যর্থ');
}

async function openrouter(prompt, opts = {}) {
  if (!keyOk(CFG.openrouterKeys)) throw new Error('OPENROUTER_API_KEY(S) নেই');
  const models = ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free'];
  let last = null;
  for (const model of models) {
    for (const key of CFG.openrouterKeys) {
      const ki = CFG.openrouterKeys.indexOf(key);
      try {
        const text = await openaiChat('https://openrouter.ai/api/v1/chat/completions', key, model, prompt, opts);
        modelUsed = `openrouter:${model}`;
        keyLog('openrouter', ki, true);
        return text;
      } catch (e) {
        last = e;
        keyLog('openrouter', ki, false, String(e).slice(0, 150));
        if (/HTTP 429/.test(String(e))) await waitMs(20000);
        if (/HTTP 4(29|03|00)/.test(String(e))) break;
      }
    }
  }
  throw last || new Error('OpenRouter ব্যর্থ');
}

async function pollinationsText(prompt, opts = {}) {
  const body = { model: 'openai', temperature: opts.temp ?? 0.8, messages: [{ role: 'user', content: prompt }] };
  const r = await jfetch('https://text.pollinations.ai/openai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, 90000);
  let text = (await r.text()).trim();
  try { const d = JSON.parse(text); text = (d.choices?.[0]?.message?.content || '').trim() || text; } catch {}
  if (!text) throw new Error('পোলিনেশনস খালি উত্তর');
  modelUsed = 'pollinations:openai';
  return text;
}

async function llm(prompt, opts = {}) {
  const chain = [
    ['Gemini', gemini],
    ['Groq', groq],
    ['OpenRouter', openrouter],
    ['Pollinations', pollinationsText],
  ];
  let last = null;
  for (const [name, fn] of chain) {
    try { return await fn(prompt, opts); }
    catch (e) {
      last = e;
      log(`${name} ব্যর্থ — পরের প্রোভাইডারে ফলব্যাক (${String(e).slice(0, 120)})`);
    }
  }
  throw last || new Error('সব স্ক্রিপ্ট-প্রোভাইডার ব্যর্থ');
}

const tryParseJson = (text) => {
  const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : text);
};

// ---------- স্ক্রিপ্ট ----------
const ICONS_OK = ['bolt', 'battery', 'clock', 'chart', 'money', 'fire', 'star', 'bulb', 'question', 'target', 'rocket', 'heart', 'globe', 'trend', 'phone', 'shield', 'leaf', 'bell', 'book', 'calendar', 'alert', 'drop', 'wifi', 'sun', 'cloud', 'lock', 'check', 'cross'];
const CARD_TYPES = ['title', 'list', 'number', 'compare', 'quote', 'stat'];
const FALLBACK_ICONS = ['bulb', 'bolt', 'target', 'chart', 'star', 'rocket', 'heart', 'shield', 'clock', 'trend'];
function planPrompt(kind, theme) {
  const cardRule = CFG.visual === 'code' ? `

প্রতিটি দৃশ্যে আরও একটি "card" ফিল্ড দেবে (কোড-গ্রাফিক্স ভিজ্যুয়াল — ছবি/ভিডিও নয়, পর্দায় কোডে আঁকা প্রফেশনাল অ্যানিমেটেড কার্ড):
"card":{"type":"title|list|number|compare|quote|stat — ঠিক একটি","icon":"নীচের তালিকা থেকে ঠিক একটি নাম","headline":"দৃশ্যের মূল কথা, সংক্ষিপ্ত বাংলা","points":["পয়েন্ট ১","পয়েন্ট ২","পয়েন্ট ৩"],"bad":["ভুল/খারাপ পয়েন্ট — শুধু compare টাইপে ২টি"],"value":"বড় সংখ্যা বাংলায় যেমন ৮৫% — শুধু number/stat","note":"ছোট সহায়ক লেখা (ঐচ্ছিক)"}
আইকন-তালিকা (icon অবশ্যই এদের মধ্যে থেকে হবে): ${ICONS_OK.join(', ')}
type বাছাই: শুরু/শিরোনাম দৃশ্য→title, তালিকা→list, চমক-সংখ্যা→number (পুরো ভিডিওতে ৩-এর বেশি নয়), ভালো-মন্দ তুলনা→compare (একবারই), উক্তি→quote, শতকরা/পরিসংখ্যান→stat। points-এ ২-৩টি ছোট পয়েন্ট, compare-এ points=ভালো পয়েন্ট, bad=মন্দ পয়েন্ট।`
    : '';
  return `তুমি বাংলা ভিডিও পরিকল্পক। শুধু JSON দাও, এই কাঠামোয়:
{"scenes":[{"text":"দৃশ্যের হুবহু ন্যারেশন অংশ","imageQuery":"ছবি খোঁজার জন্য সহজ ইংরেজি কীওয়ার্ড","effects":["উপযুক্ত হলে: icon:🤖 | counter:0,100,5 | stamp-red:টেক্সট | stamp-green:টেক্সট | bar:70 | slider | quiz:প্রশ্ন?|সঠিক|ভুল১|ভুল২ | spotlight | map | effect লাগবে না হলে খালি স্ট্রিং"]}],"title":"ইউটিউব টাইটেল (বাংলা, ৮০ অক্ষরের মধ্যে)","description":"ইউটিউব বর্ণনা, ২-৩ বাক্য","hashtags":["#বাংলা","#..."],"thumbText":"থাম্বনেইলে বড় করে লেখা ৩-৫ শব্দ","keywordsRed":["ক্যাপশনে লাল করার নেতিবাচক শব্দ"],"keywordsGreen":["সবুজ করার ইতিবাচক শব্দ"],"musicMood":"upbeat|calm"}
নিয়ম: scenes[].text জোড়া দিলে হুবহু পূর্ণ স্ক্রিপ্ট হবে (কোনো শব্দ বাদ/যোগ/বদল নয়)। দৃশ্য ৮-১৪টি, প্রতিটি ১-২ বাক্য। ধরন: ${kind} (A=টিউটোরিয়াল, B=ফ্ল্যাট কার্টুন-ব্যাখ্যা+কুইজ, C=ম্যাপ/ডেটা+কাউন্টার)। theme: ${theme}. ইফেক্ট সব দৃশ্যে নয়, যেখানে অর্থবহ; কমপক্ষে ৩টি দৃশ্যে। imageQuery ইংরেজিতে সহজ, ধরনের স্টাইলে।${cardRule}`;
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
    const planP = await llm(`${planPrompt(kind, theme)}\n\nনিচের স্ক্রিপ্টের প্রতিটি শব্দ অপরিবর্তিত রাখতে হবে। শুধু দৃশ্যে ভাগ করো, ছবি/ইফেক্ট/মেটাডেটা বানাও।\n\nস্ক্রিপ্ট:\n${narration}`, { json: true, temp: 0.4 });
    return { narration, ...tryParseJson(planP), theme, kind, metaOnly: true };
  }

  log(`স্ক্রিপ্ট: টপিক থেকে লেখা হচ্ছে (Gemini, কথ্য বাংলা, ${kind})`);
  let narration = await llm(
    `${projectTxt}\n\nটপিক: ${CFG.topic || 'রোজকার জীবনে কাজে লাগে এমন একটি চমকপ্রদ তথ্য'}\nটার্গেট: আনুমানিক ${targetWords} শব্দ, একটানা প্যারাগ্রাফ।\nউচ্চারণ-তালিকা (ইংরেজি শব্দ ঠিক এভাবে বাংলা হরফে লিখবে): ${prons || 'নেই'}\nধরন ${kind}: ${kind === 'A' ? 'সহজ টিউটোরিয়াল, ধাপে ধাপে, উদাহরণসহ' : kind === 'C' ? 'তথ্য/ম্যাপ/সংখ্যাভিত্তিক, আকর্ষণীয় তথ্য-উপস্থাপনা' : 'গল্পের ছলে ব্যাখ্যা, কুইজ/চ্যালেঞ্জ আবহ'}।\n${CFG.brief ? 'অতিরিক্ত নির্দেশ: ' + CFG.brief + '\n' : ''}শুধু স্ক্রিপ্ট লেখো — শিরোনাম, মার্কডাউন, কমেন্ট, দৃশ্য-নাম্বার কিছুই নয়। মুখে বলার মতো স্বাভাবিক, আবেগ আছে, এআই-সুলভ খাঁটি-বাক্য নয়।`);
  for (let i = 1; i <= 3; i++) {
    const rev = await llm(`তুমি কড়া সম্পাদক। নিচের বাংলা ভয়েসওভার স্ক্রিপ্টে বানান, ব্যাকরণ, ভাঙা বাক্য ও এআই-সুলভ ভাষা ঠিক করো। মানে ও দৈর্ঘ্য কাছাকাছি রাখবে, কথ্য স্বাভাবিক রাখবে। শুধু চূড়ান্ত স্ক্রিপ্ট লিখবে।\n\nরিভিউ ${i}/3\n\n${narration}`, { temp: 0.5 });
    if (rev && rev.length >= narration.length * 0.6) { narration = rev; log(`স্ক্রিপ্ট রিভিউ ${i}/3 প্রয়োগ`); }
  }
  const planP = await llm(`${planPrompt(kind, theme)}\n\nস্ক্রিপ্ট (শব্দ বদল নয়, শুধু ভাগ):\n${narration}`, { json: true, temp: 0.4 });
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

// প্রফেশনাল ভয়েস-প্রিসেট: ডকুমেন্টারি/পডকাস্ট/নিউজ/কার্টুন-ব্যাখ্যা
const VOICE_PRESETS = {
  podcast:     { name: 'পডকাস্ট — উষ্ণ, আলাপের মতো', extra: { speed: 0.95 }},
  documentary: { name: 'ডকুমেন্টারি — ধীর, গম্ভীর', extra: { speed: 0.88 }},
  news:        { name: 'নিউজ — স্পষ্ট, দ্রুত', extra: { speed: 1.05 }},
  natural:     { name: 'স্বাভাবিক', extra: {} },
};

async function voiceCartesia(text, file) {
  if (!keyOk(CFG.cartesiaKeys)) throw new Error('CARTESIA_API_KEY / CARTESIA_API_KEYS কোনোটিই নেই');
  const voiceIds = CFG.voiceIds.length ? CFG.voiceIds : [CFG.voiceId];
  if (!voiceIds[0]) throw new Error('CARTESIA_VOICE_ID(গুলো) নেই');
  let last = null;
  for (const vid of voiceIds) {
    for (const key of CFG.cartesiaKeys) {
      const ki = CFG.cartesiaKeys.indexOf(key);
      try {
        const preset = VOICE_PRESETS[CFG.voicePreset] || VOICE_PRESETS.podcast;
        const body = { model_id: 'sonic-3', transcript: text, voice: vid, language: 'bn', ...preset.extra, output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 } };
        if (process.env.CARTESIA_EXTRA) Object.assign(body, tryParseJson('{' + process.env.CARTESIA_EXTRA + '}'));
        const r = await jfetch('https://api.cartesia.ai/tts/bytes', {
          method: 'POST',
          headers: { 'X-API-Key': key, 'Cartesia-Version': '2024-06-10', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        if (fs.statSync(file).size < 2000) throw new Error('Cartesia অডিও খুব ছোট');
        keyLog('cartesia', ki, true);
        return file;
      } catch (e) { last = e; keyLog('cartesia', ki, false, String(e).slice(0, 150)); }
    }
  }
  throw last || new Error('Cartesia সব কী/ভয়েস ব্যর্থ');
}

async function voiceEdge(text, file) {
  const inst = spawnSync('python3', ['-m', 'edge_tts', '--help'], { encoding: 'utf8', timeout: 60000 });
  if (inst.status !== 0) run('python3', ['-m', 'pip', 'install', '--quiet', 'edge-tts'], 'pip-edge-tts', 180000);
  const v = process.env.EDGE_VOICE || CFG.edgeVoice;
  const preset = VOICE_PRESETS[CFG.voicePreset] || VOICE_PRESETS.podcast;
  const rate = preset.extra.speed ? `--rate=${Math.round((preset.extra.speed - 1) * 100)}%` : '';
  W('/tmp/tts_input.txt', text);
  run('python3', ['-m', 'edge_tts', `--voice=${v}`, ...(rate ? [rate] : []), '--file=/tmp/tts_input.txt', `--write-media=${file}`], 'edge-tts', 180000);
  if (fs.statSync(file).size < 1000) throw new Error('edge-tts অডিও খুব ছোট');
  return file;
}

function concatVoice(scenes, out) {
  const list = scenes.map(s => `file '${path.resolve(s.voiceFile).replace(/'/g, '')}'`).join('\n');
  W(`${OUT}/list.txt`, list);
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', `${OUT}/list.txt`, '-c:a', 'libmp3lame', '-q:a', '2', out], 'ffmpeg-voice-concat', 300000);
}

const OUT = 'out';
const PUB = 'public';

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
    fs.copyFileSync('assets/voice.mp3', `${PUB}/voice_full.mp3`);
    return { file: 'voice_full.mp3', path: 'user_audio', total: Math.max(total, start) };
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
      let acc = 0; scenes.forEach(s => { s.start = +acc.toFixed(2); acc += s.dur + CFG.voiceGap; });
      log(`ভয়েস: প্রিসেট=${CFG.voicePreset}, দৃশ্য-গ্যাপ=${CFG.voiceGap} সেকেন্ড`);
      concatVoice(scenes, `${OUT}/voice_full.mp3`);
      fs.copyFileSync(`${OUT}/voice_full.mp3`, `${PUB}/voice_full.mp3`);
      log(`ভয়েস পথ: ${provider}${provider === 'cartesia_sonic3' ? ' (আপনার ক্লোন)' : ' (ফলব্যাক, ক্লোন নয়)'}, মোট ${acc.toFixed(1)} সেকেন্ড`);
      return { file: 'voice_full.mp3', path: provider, total: acc };
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
  if (!keyOk(CFG.pixabayKeys)) throw new Error('PIXABAY_API_KEY / PIXABAY_API_KEYS কোনোটিই নেই');
  let last = null;
  for (const key of CFG.pixabayKeys) {
    const ki = CFG.pixabayKeys.indexOf(key);
    try {
      let url;
      if (wantVideo) {
        const r = await jfetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(q)}&per_page=7&safesearch=true`);
        const hits = (await r.json()).hits || [];
        const v = hits.map(h => h.videos && (h.videos.medium || h.videos.small || h.videos.tiny)).filter(Boolean)[0];
        if (!v) throw new Error('ভিডিও নেই');
        url = v.url;
      } else {
        const r = await jfetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&per_page=7&image_type=photo&safesearch=true`);
        const hits = (await r.json()).hits || [];
        url = hits.map(h => h.largeImageURL || h.webformatURL).filter(Boolean)[0];
        if (!url) throw new Error('ছবি নেই');
      }
      keyLog('pixabay', ki, true);
      return download(url, file);
    } catch (e) { last = e; keyLog('pixabay', ki, false, String(e).slice(0, 120)); }
  }
  throw last || new Error('Pixabay সব কী ব্যর্থ');
}

async function pexelsPhoto(q, file) {
  if (!keyOk(CFG.pexelsKeys)) throw new Error('PEXELS_API_KEY / PEXELS_API_KEYS কোনোটিই নেই');
  let last = null;
  for (const key of CFG.pexelsKeys) {
    const ki = CFG.pexelsKeys.indexOf(key);
    try {
      const r = await jfetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=5`, { headers: { Authorization: key } });
      const u = ((await r.json()).photos || []).map(p => p.src?.large2x || p.src?.large).filter(Boolean)[0];
      if (!u) throw new Error('ছবি নেই');
      keyLog('pexels', ki, true);
      return download(u, file);
    } catch (e) { last = e; keyLog('pexels', ki, false, String(e).slice(0, 120)); }
  }
  throw last || new Error('Pexels সব কী ব্যর্থ');
}

async function pollinations(q, file, w, h) {
  const style = { A: 'modern tech, clean, vivid', B: 'flat vector illustration, cartoon, minimal, kid-friendly', C: 'minimal infographic style, map, data' }[CFG.kind] || '';
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(q + ', ' + style)}?width=${Math.min(1280, w)}&height=${Math.min(1280, h)}&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
  return download(url, file);
}

function assignCard(s) {
  const c = (s.card && typeof s.card === 'object') ? s.card : {};
  const type = CARD_TYPES.includes(c.type) ? c.type : CARD_TYPES[(s.index + 1) % CARD_TYPES.length];
  const icon = ICONS_OK.includes(c.icon) ? c.icon : FALLBACK_ICONS[s.index % FALLBACK_ICONS.length];
  const words = s.text.split(/\s+/).filter(Boolean);
  const chunk = (n) => { const per = Math.ceil(words.length / n); return Array.from({ length: n }, (_, k) => words.slice(k * per, (k + 1) * per).join(' ')).filter(Boolean); };
  const points = (Array.isArray(c.points) && c.points.length) ? c.points.map(String) : (words.length > 6 ? chunk(3) : []);
  const bad = (Array.isArray(c.bad) && c.bad.length) ? c.bad.map(String) : ['অগোছালো অভ্যাস', 'ওলটপালট ব্যবহার'];
  s.card = {
    type,
    icon,
    headline: String(c.headline || '').trim() || words.slice(0, 7).join(' ') || CFG.topic || '',
    points: points.slice(0, type === 'compare' ? 2 : 4),
    bad: type === 'compare' ? bad.slice(0, 2) : undefined,
    value: String(c.value || (type === 'number' ? '৫২' : type === 'stat' ? '৮৫%' : '')),
    note: String(c.note || '').trim(),
  };
}

async function buildVisuals(scenes, rw, rh) {
  if (CFG.visual === 'code') {
    for (const s of scenes) { assignCard(s); s.asset = null; s.assetType = 'code'; }
    log(`ভিজ্যুয়াল: কোড-গ্রাফিক্স মোড — ${scenes.length}টি দৃশ্য সম্পূর্ণ কোডে আঁকা হবে (স্টক ফুটেজ নেই)`);
    return;
  }
  const chain = providers.visual.filter(v =>
    v === 'pollinations' ? true : v.startsWith('pixabay') ? !!CFG.pixabayKey : !!CFG.pexelsKey);
  for (const s of scenes) {
    let done = false;
    for (const v of chain) {
      try {
        if (v === 'pixabay_video') { await pixabay(s.imageQuery, `${PUB}/scene-${s.index}.mp4`, true); s.asset = `scene-${s.index}.mp4`; s.assetType = 'video'; done = true; }
        else if (v === 'pixabay_photo') { await pixabay(s.imageQuery, `${PUB}/scene-${s.index}.jpg`, false); s.asset = `scene-${s.index}.jpg`; s.assetType = 'photo'; done = true; }
        else if (v === 'pexels_photo') { await pexelsPhoto(s.imageQuery, `${PUB}/scene-${s.index}.jpg`); s.asset = `scene-${s.index}.jpg`; s.assetType = 'photo'; done = true; }
        else if (v === 'pollinations') { await pollinations(s.imageQuery, `${PUB}/scene-${s.index}.jpg`, rw, rh); s.asset = `scene-${s.index}.jpg`; s.assetType = 'photo'; done = true; }
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
  run('node', ['tools/synth_audio.mjs', 'music', mv, `${PUB}/music_raw.wav`, String(Math.min(240, Math.ceil(total) + 2))], 'synth-music', 120000);
  run('ffmpeg', ['-y', '-i', `${PUB}/music_raw.wav`, '-c:a', 'libmp3lame', '-q:a', '2', `${PUB}/music.mp3`], 'music-mp3', 120000);
  log(`গান: অটো-সিন্থ (${mv})`);
  return { file: 'music.mp3', volume: 0.12 };
}

function buildSfx() {
  if (WCFGM.sfx === false) { log('এসএফএক্স: বন্ধ (কনফিগ)'); return; }
  if (process.env.PIPE_DRY === '1') return;
  fs.mkdirSync(`${PUB}/sfx`, { recursive: true });
  if (fs.existsSync(`${PUB}/sfx/pop.wav`)) return;
  for (const sfx of ['pop', 'ding', 'whoosh', 'click']) run('node', ['tools/synth_audio.mjs', 'sfx', sfx, `${PUB}/sfx/${sfx}.wav`], `sfx-${sfx}`, 60000);
  log('এসএফএক্স: সিন্থ pop/ding/whoosh/click তৈরি');
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
  fs.mkdirSync(PUB, { recursive: true });

  const plan = await retry(3, buildScript, 'স্ক্রিপ্ট-ধাপ');
  W(`${OUT}/script.md`, plan.narration || '');
  W(`${OUT}/metadata.json`, JSON.stringify({ title: plan.title || CFG.topic, description: plan.description || '', hashtags: plan.hashtags || [], thumbText: plan.thumbText || plan.title || '' }, null, 2));
  log(`স্ক্রিপ্ট তৈরি: ${(plan.narration || '').length} অক্ষর, ${plan.model || ''} মেটাডেটা সহ (Gemini মডেল: ${modelUsed})`);
  if (CFG.mode === 'script_only') { log('মোড script_only — শেষ'); return; }

  buildSfx();
  const EFFECT_RE = /^(icon:|counter:|stamp-red:|stamp-green:|bar:|slider|quiz:|spotlight|map)/;
  const normEffects = (v) => {
    if (Array.isArray(v)) return v.map(e => String(e)).filter(Boolean);
    if (typeof v === 'string' && v.trim()) {
      const parts = v.split(/\s*\|\s*/).map(x => x.trim()).filter(Boolean);
      const merged = [];
      for (const p of parts) {
        const prev = merged.length - 1;
        if (prev >= 0 && /quiz:/i.test(merged[prev]) && !EFFECT_RE.test(p)) merged[prev] += '|' + p;
        else merged.push(p);
      }
      const hit = merged.filter(x => EFFECT_RE.test(x));
      return hit.length ? hit : merged;
    }
    return [];
  };
  const rawScenes = (Array.isArray(plan.scenes) ? plan.scenes : []).map((s, i) => ({
    index: i, text: String(s?.text || '').trim(),
    imageQuery: String(s?.imageQuery || CFG.topic || 'abstract background').slice(0, 120),
    effects: normEffects(s?.effects).map(e => String(e)).filter(Boolean).slice(0, 3),
    card: (s?.card && typeof s.card === 'object') ? s.card : null,
  })).filter(s => s.text.length);
  if (!rawScenes.length) rawScenes.push({ index: 0, text: plan.narration, imageQuery: CFG.topic, effects: [] });
  log(`দৃশ্য: ${rawScenes.length}টি`);

  const voice = await buildVoice(rawScenes);
  const cues = WCFGM.subtitles === false ? [] : buildCues(rawScenes, plan.keywordsRed || [], plan.keywordsGreen || []);
  W(`${OUT}/subs.srt`, cues.map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.start + c.dur)}\n${c.text}\n`).join('\n'));
  log(`SRT ${WCFGM.subtitles === false ? 'বন্ধ (কনফিগ)' : `তৈরি: ${cues.length} ক্যাপশন`}`);
  if (CFG.mode === 'voice_test') { log('মোড voice_test — রেন্ডার বাদ, শেষ'); return; }

  const [Wd, Hd] = /^\d+x\d+$/.test(CFG.aspect)
    ? CFG.aspect.split('x').map(Number)
    : ASPECTS[CFG.aspect];
  const RES_LONG = { '480p': 854, '720p': 1280, '1080p': 1920 };
  const sc = CFG.mode === 'draft' ? 0.5 : 1;
  let RW = Math.round(Wd * sc / 2) * 2, RH = Math.round(Hd * sc / 2) * 2;
  if (CFG.resolution) {
    const target = RES_LONG[CFG.resolution], long = Math.max(Wd, Hd);
    const f = sc * (target / long);
    RW = Math.round(Wd * f / 2) * 2; RH = Math.round(Hd * f / 2) * 2;
  }
  log(`রেন্ডার সাইজ: ${RW}x${RH}${CFG.resolution ? ` (লক্ষ্য ${CFG.resolution})` : ''}`);

  await buildVisuals(rawScenes, RW, RH);
  const music = buildMusic(voice.total, plan.musicMood || 'upbeat');

  rawScenes.forEach(s => {
    s.cues = cues.filter(c => c.start >= s.start - 0.5 && c.start < s.start + s.dur + 0.5);
    s.effects = s.effects.map((e, k) => ({ spec: e, at: +(s.start + s.dur * (0.3 + k * 0.3)).toFixed(2) }));
  });

  const props = {
    fps: FPS, width: RW, height: RH, kind: plan.kind, theme: plan.theme,
    visual: CFG.visual, iconPref: CFG.iconPref,
    narration: voice.file,
    music, scenes: rawScenes,
    thumb: { text: plan.thumbText || plan.title || 'ভিডিও', asset: (rawScenes.find(s => s.assetType === 'photo') || {}).asset || null, kind: plan.kind },
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
  if (WCFGM.thumbnail === false) {
    log('থাম্বনেইল বন্ধ (কনফিগ)');
  } else try {
    run('npx', ['remotion', 'still', 'src/index.jsx', 'Thumb', `${OUT}/thumb.jpg`, '--props', `${OUT}/props.json`, '--quality', '90', '--log', 'error'], 'remotion-thumb', 240000);
    log('থাম্বনেইল তৈরি');
  } catch (e) { log(`থাম্বনেইল ব্যর্থ: ${String(e).slice(0, 200)}`); }

  W(`${OUT}/summary.json`, JSON.stringify({
    mode: CFG.mode, aspect: CFG.aspect, kind: plan.kind, theme: plan.theme,
    voicePath: voice.path, geminiModel: modelUsed, totalSec: +voice.total.toFixed(1), visual: CFG.visual,
    scenes: rawScenes.length, music: music ? music.file : 'off',
  }, null, 2));
  log(`সম্পন্ন — আউটপুট আর্টিফ্যাক্টে (${OUT}/)`);
};

main().catch(e => { console.error(e); die(e.stack || String(e)); });
