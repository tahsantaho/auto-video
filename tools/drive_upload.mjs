import fs from 'node:fs';

// Google Drive-এ ফলাফল সেভ (চেকপয়েন্ট)। সব কী সরাসরি GitHub Secrets থেকে এনভায়রনমেন্টে আসে।
// প্রয়োজনীয় সিক্রেট (ঐচ্ছিক — না দিলে এই ধাপ লাফিয়ে যাবে):
//   GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_FOLDER_ID
// ব্যবহার: node tools/drive_upload.mjs <ফাইল> <Drive-এ নাম> [mimetype]

const args = process.argv.slice(2);
if (args.length < 2) { console.error('ব্যবহার: node drive_upload.mjs <file> <driveName> [mime]'); process.exit(2); }
const [file, name, mime] = args;

const env = (k) => (process.env[k] || '').trim();
const REFRESH = env('GOOGLE_REFRESH_TOKEN');
const CLIENT_ID = env('GOOGLE_CLIENT_ID');
const CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET');
const FOLDER = env('GOOGLE_DRIVE_FOLDER_ID');

if (!REFRESH || !CLIENT_ID || !CLIENT_SECRET) {
  console.log('[drive] GOOGLE_* সিক্রেট নেই — Drive আপলোড লাফানো হলো (ভিডিও তবুও Artifacts-এ থাকবে)।');
  process.exit(0);
}
if (!fs.existsSync(file) || fs.statSync(file).size === 0) { console.error(`[drive] ফাইল নেই: ${file}`); process.exit(1); }

const log = (m) => console.log(`[drive] ${m}`);

async function accessToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    refresh_token: REFRESH, grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  if (!r.ok) throw new Error(`টোকেন ব্যর্থ HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).access_token;
}

async function upload(file, name, mime, token, attempt = 1) {
  const init = new URLSearchParams({ uploadType: 'resumable' });
  if (FOLDER) init.set('addParents', FOLDER);
  const meta = { name };
  const initRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files?${init}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime || 'application/octet-stream',
      'X-Upload-Content-Length': String(fs.statSync(file).size),
    },
    body: JSON.stringify(meta),
  });
  if (!initRes.ok) throw new Error(`সেশন-শুরু ব্যর্থ HTTP ${initRes.status}`);
  const url = initRes.headers.get('location');
  if (!url) throw new Error('আপলোড URL নেই');

  const size = fs.statSync(file).size;
  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Length': String(size), 'Content-Type': mime || 'application/octet-stream' },
    body: fs.readFileSync(file),
  });
  if (put.ok) return put.json();
  throw new Error(`আপলোড ব্যর্থ HTTP ${put.status} (মাঝপথ নেটওয়ার্ক কাটলে আবার চেষ্টা হবে)`);
}

try {
  const token = await accessToken();
  let done = null;
  for (let i = 1; i <= 3; i++) {
    try { done = await upload(file, name, mime, token, i); break; }
    catch (e) { log(`চেষ্টা ${i}/3 ব্যর্থ: ${String(e).slice(0, 200)}`); if (i === 3) throw e; }
  }
  log(`✅ সফল: https://drive.google.com/file/d/${done.id}/view (${fs.statSync(file).size} bytes, ${name})`);
} catch (e) {
  console.error(`[drive] ❌ ${String(e).slice(0, 300)}`);
  process.exit(1);
}
