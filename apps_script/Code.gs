/**
 * বাংলা ভিডিও অটোমেশন — Apps Script ট্রিগার
 * ============================================
 * কাজ: Asia/Dhaka সময় অনুযায়ী GitHub-এর "Video Pipeline" workflow ট্রিগার করা
 * (repository_dispatch)। GitHub-এর নিজস্ব cron-এ বিলম্ব হয় এবং ৬০ দিন নিষ্ক্রিয় থাকলে
 * scheduled workflow বন্ধ হয়ে যায় — Apps Script ট্রিগার সেই দুটো ঝুঁকিই এড়ায়।
 *
 * সেটআপ (একবার):
 * ১. script.google.com → "নতুন প্রজেক্ট" → এই কোড পেস্ট করুন
 * ২. বাম পাশে ⚙️ Project Settings → Script Properties → এগুলো যোগ করুন:
 *      GH_TOKEN        = GitHub Personal Access Token (repo scope) — এটি কখনো কোডে লিখবেন না
 *      PIPE_PASSPHRASE = একটি লম্বা পাসফ্রেজ — GitHub Secrets-এও একই নামে বসাতে হবে
 * ৩. Save → উপরে ফাংশন বাছাই করে setupTrigger() দিন → Run → একবার Authorize করুন
 * ৪. টেস্ট: triggerNow() চালিয়ে GitHub → Actions-এ নতুন রান এসেছে কিনা দেখুন
 * ৫. পাসফ্রেজ GitHub Secrets-এর PIPE_PASSPHRASE-এর সাথে মিলবে — না মিললে রান হবে না
 */

// ↓↓↓ এই অংশ একবার বদলান (আপনার রিপো অনুযায়ী) ↓↓↓
const GITHUB_OWNER = 'tahsantaho';
const GITHUB_REPO = 'auto-video';
const WORKFLOW_FILE = 'video.yml';
const DISPATCH_EVENT = 'run-video';

const SCRIPT_PROPS = {
  TOKEN_KEY: 'GH_TOKEN',
  PASSPHRASE_KEY: 'PIPE_PASSPHRASE',
};

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'triggerNow') ScriptApp.deleteTrigger(t);
  });
  // প্রতি সকাল ৬টায় (ঢাকা সময়) — প্রতিদিন চাইলে নিচের everyDays(1) লাইন ব্যবহার করুন
  ScriptApp.newTrigger('triggerNow')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone('Asia/Dhaka')
    .create();
}

function triggerNow() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(SCRIPT_PROPS.TOKEN_KEY);
  const passphrase = props.getProperty(SCRIPT_PROPS.PASSPHRASE_KEY);
  if (!token || !passphrase) {
    throw new Error('Script Properties-এ GH_TOKEN ও PIPE_PASSPHRASE বসানো হয়নি');
  }
  const res = UrlFetchApp.fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      payload: JSON.stringify({
        event_type: DISPATCH_EVENT,
        client_payload: { source: 'apps-script', passphrase },
      }),
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() === 204) {
    Logger.log('✅ ট্রিগার সফল — GitHub Actions-এ রান শুরু হয়েছে');
  } else {
    throw new Error(`❌ GitHub ফিরিয়েছে ${res.getResponseCode()}: ${res.getContentText().slice(0, 300)}`);
  }
}
