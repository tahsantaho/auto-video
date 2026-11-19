# বাংলা ভিডিও অটোমেশন (GitHub Actions)

ফোন থেকেই চালানো যায় — কোডিং লাগে না।

## চালানোর পদ্ধতি
রিপো → **Actions** ট্যাব → **Video Pipeline** → **Run workflow** → ঘরগুলো পূরণ করে সবুজ বাটন।

## ঘর (ইনপুট)
| ঘর | কী দেবেন |
|---|---|
| mode | `script_only` (শুধু লেখা) → `voice_test` (লেখা+কণ্ঠ) → `draft` (দ্রুত ভিডিও) → `full` (সেরা মান) |
| minutes | মিনিট; `1.5` = দেড় মিনিট |
| aspect | `9:16` রিলস, `16:9` ইউটিউব, `1:1` ফেসবুক, `4:5` ফিড |
| kind | `A` টিউটোরিয়াল, `B` কার্টুন-ব্যাখ্যা (কুইজ/স্ট্যাম্প), `C` ম্যাপ-ডেটা |
| theme | `warm` `cool` `dark` `nature` `bright` |
| music | `auto` `off` `upbeat` `calm` |
| topic | টপিক (স্ক্রিপ্ট না দিলে লাগবে) |
| project | প্রিসেট নাম (projects.json দেখুন), ঐচ্ছিক |
| brief | আরও নির্দেশ, ঐচ্ছিক |
| script | পূর্ণ স্ক্রিপ্ট দিলে **একটি শব্দও বদলাবে না** |

## ফলাফল কোথায়
রান শেষে পাতার নিচে **Artifacts → video-output** ডাউনলোড করুন: `out/video_*.mp4`, `out/subs.srt`, `out/thumb.jpg`, `out/script.md`, `out/metadata.json`, `out/log.txt`।

## Secrets (Settings → Secrets and variables → Actions)
- `GEMINI_API_KEY`, `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID`, `PIXABAY_API_KEY` (ঐচ্ছিক; না থাকলে Pollinations), `PEXELS_API_KEY` (ঐচ্ছিক)।
- ⚠️ কোনো চাবি আগে কোথাও প্রকাশ পেয়ে থাকলে (যেমন চ্যাটে) সেই প্রোভাইডারের ড্যাশবোর্ড থেকে **রিসেট** করে নতুন মান Secrets-এ বসান।

## নিজের অডিও
রিপোতে `assets/voice.mp3` দিন (Add file)। তখন ক্লোন ভয়েস বাদ — আপনার রেকর্ডিংই হবে, বিরতি দেখে দৃশ্য-সময় মিলবে।
গান দিতে চাইলে `assets/music.mp3`। স্ক্রিপ্ট ফাইলে দিতে চাইলে `assets/script.txt` + topic ঘরে টপিক।

## সমন্বয়
- `providers.json` — প্রতিটি কাজের ফলব্যাক-ধারা (অন/অফ)।
- `project.txt` — সবসময়ের লেখার নিয়ম।
- `pronounce.json` — ইংরেজি শব্দের বাংলা উচ্চারণ।
- `data/log.txt` — কোন পথ (কোন সার্ভিস) চলেছে, কোথায় কী ব্যর্থ।
