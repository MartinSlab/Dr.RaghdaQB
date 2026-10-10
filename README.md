# Physics Quiz (Next.js + Vercel)

Students: enter name + class → pick a quiz (or "All topics mixed") → shuffled MCQs → score + review.
Teacher: secret URL + password → upload .docx → AI extracts/solves → review/edit → publish. See scores, filter, export CSV.

## Deploy in 6 steps

1. **API key**: create an account at https://console.anthropic.com → Settings → API Keys → Create key. Add a few dollars of credit (a 100-question file costs a few cents).
2. **GitHub**: create a new repo and upload this folder's contents.
3. **Vercel**: https://vercel.com → Add New → Project → import the repo → (don't deploy yet).
4. **Database**: in the Vercel project → Storage → Create / Marketplace → **Upstash Redis** (free plan) → connect to the project. This adds the KV_REST_API_URL / KV_REST_API_TOKEN variables automatically.
5. **Environment variables** (Settings → Environment Variables):
   - `ANTHROPIC_API_KEY` = your key
   - `ADMIN_PASSWORD` = a strong password
   - `ADMIN_SLUG` = a secret word, e.g. `teacher-x7k2q9`
6. **Deploy**. Students use `https://your-site.vercel.app`; you use `https://your-site.vercel.app/<ADMIN_SLUG>`.

(After adding variables you must redeploy once.)

## Local run
```
npm install
cp .env.example .env.local   # fill values
npm run dev
```

## Database check
Open `https://your-site.vercel.app/api/health` — it must show `{"ok":true}`.
If it shows an error, the message says what to fix. The usual causes:
1. `MONGODB_URI` is missing → add it in Vercel → Settings → Environment Variables (and in `.env` locally), then redeploy.
2. MongoDB Atlas → Network Access → add `0.0.0.0/0`.
3. Wrong password in the URI (URL-encode special characters).
