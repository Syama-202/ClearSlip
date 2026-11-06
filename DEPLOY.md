# Deploying ClearSlip

A step-by-step checklist for putting ClearSlip online on Render's free tier, checking it works, and keeping an eye on it. Expect it to take about 30 minutes the first time.

`render.yaml` describes both services, so Render sets most things up for you. You only fill in the addresses and keys.

---

## 1. Before you start

- [ ] The latest commit is pushed to `main`, and the **CI** workflow on GitHub is green (Actions tab). CI runs the 316 backend tests, the 27 frontend tests, a vulnerability check on both packages, the frontend build, and the 8 end-to-end browser tests.
- [ ] You have a [Render](https://render.com) account and have let it read the `Syama-202/ClearSlip` repository. The repository is private, so in Render go to **Account settings → GitHub** and grant access to it.
- [ ] Optional: a Groq API key from [console.groq.com](https://console.groq.com), for AI answers in Ask ClearSlip and the AI payslip reader. Without it the app still works: payslips are read by the rules engine, and Ask ClearSlip shows the matching official passages without an AI-written answer.

## 2. Create the services

1. In Render, go to **New → Blueprint** and pick the repository. Render reads `render.yaml` and proposes two services:
   - `clearslip-backend`, a Node web service. It is built with `npm ci --omit=dev` and health-checked at `/api/health`.
   - `clearslip-frontend`, a static site. It is built with `npm ci && npm run build` and served with security and cache headers.
2. Render asks for the variables marked `sync: false`. For now, leave the two addresses blank; you'll fill them in once Render has given each service its URL (step 3).

| Service | Variable | Value | Needed? |
|---|---|---|---|
| backend | `FRONTEND_URL` | the frontend's URL, e.g. `https://clearslip-frontend.onrender.com` (no trailing `/`) | **Yes**. Without it, browsers are refused (CORS) |
| backend | `GROQ_API_KEY` | your Groq key | Optional |
| backend | `SENTRY_DSN` | from Sentry (see §5) | Optional |
| backend | `N8N_WEBHOOK_URL`, `N8N_SECRET` | your n8n webhook | Optional ("Email checklist") |
| frontend | `VITE_API_URL` | the backend's URL, e.g. `https://clearslip-backend.onrender.com` (no trailing `/`) | **Yes**. Without it, the site calls `localhost` |

Set already in `render.yaml`, so leave these alone:
- `NODE_ENV=production`
- `GROQ_FALLBACK_MODEL=openai/gpt-oss-20b`
- `OCR_WORKERS=1`, which fits the 512 MB free plan
- `SIGNING_SECRET`, which Render generates once

3. Click **Apply** and wait for both first deploys to finish.

## 3. Connect the two services

Each service needs the other's address, and Render only shows the addresses after the first deploy.

1. Copy both URLs from the Render dashboard.
2. **Backend:** open **Environment**, set `FRONTEND_URL` to the frontend URL, and save. Render redeploys it.
3. **Frontend:** open **Environment**, set `VITE_API_URL` to the backend URL, and save. Then run **Manual Deploy → Clear build cache & deploy**. Vite writes this address into the site when it builds, so changing the variable does nothing until the site is rebuilt.

## 4. Check it works

### Automated: the smoke test (2 minutes)

From your machine:

```bash
cd clearslip-backend
npm run smoke -- https://clearslip-backend.onrender.com https://clearslip-frontend.onrender.com
```

It sends about five requests from outside, the way a visitor's browser would. It never calls the AI, so it costs no Groq tokens. The first check waits up to 90 seconds in case the backend is asleep. Expect `13/13 checks passed`.

| Check | What a failure usually means |
|---|---|
| API is up | Wrong URL, the deploy hasn't finished, or `NODE_ENV` isn't `production` |
| Security headers | Helmet isn't running (the wrong start command?) |
| Decodes the sample payslip | The rules engine is broken, or `SIGNING_SECRET` is missing (no checklist token) |
| Tax calculator | Tax rules changed without updating the tests |
| Ask refuses off-topic questions | The search index (`src/rag/index.json`) is missing or stale |
| Large bodies refused (413) / JSON 404 | The body limits or the error handler were changed |
| CORS allows the site | `FRONTEND_URL` is unset, or has a typo or a trailing `/` |
| CORS refuses other sites | CORS was opened up to every site, which it shouldn't be |
| Site loads with security headers | The `headers` in `render.yaml` didn't apply |
| Site built with this API address | `VITE_API_URL` is unset or wrong, or the site wasn't rebuilt after setting it |
| Content-Security-Policy allows this API | Same cause: the policy is written from `VITE_API_URL` at build time, and a wrong address blocks every API call in the browser |
| OCR files are served by the site itself | The build didn't copy `/tesseract/` (an old `vite.config.js`?): photo and scanned-PDF reading would fail |

The script exits with code 1 if anything fails, so you can run it after every deploy.

### By hand: in a browser (5 minutes)

- [ ] Open the site and click **Try a sample payslip**. The take-home is ₹67,300 and the action cards appear.
- [ ] Upload a payslip photo. It's read on your device. In the browser's Network tab:
  - no image is uploaded;
  - the only requests go to the site itself and the API (the OCR files load from `/tesseract/`);
  - the Console shows no "Content Security Policy" errors.
- [ ] Ask "Which regime is better for me?" with the payslip attached. The answer streams in, labelled parts appear, and the sources open on official sites. This needs `GROQ_API_KEY`.
- [ ] **Save as PDF** produces a clean, one-column report: the summary cards and the start of the breakdown on page 1, and the take-home total once, after all the rows.
- [ ] Check the layout on a phone, and on a laptop at full width.
- [ ] Open the Privacy Policy. The contact address is correct.

## 5. Monitoring

### Uptime monitor (free, 5 minutes to set up)

A free Render service sleeps after about 15 minutes idle, and waking it takes up to a minute. A monitor that pings it keeps it awake and emails you if it goes down.

1. Create a free monitor at [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org).
2. Use type **HTTP(s)**, URL `https://clearslip-backend.onrender.com/api/health`, and an interval of **5 minutes**.
3. Turn on email alerts.

Render's free tier gives each workspace a fixed number of instance hours a month, roughly enough for one service running all month. Keep only the backend awake (the static frontend doesn't use hours), and check Render's current free-tier limits. If you only need the backend awake for a demo, start the monitor an hour before and pause it afterwards.

### Error tracking with Sentry (optional, free tier)

The server reports only real faults (5xx errors), tagged with the request ID and path. Request bodies, cookies, query strings and user details are removed before anything is sent, so no payslip data reaches Sentry.

1. At [sentry.io](https://sentry.io), create a project for the **Node.js** platform and copy its DSN.
2. Add the package. It isn't installed by default, and Render installs exactly what `package-lock.json` lists:
   ```bash
   cd clearslip-backend
   npm install @sentry/node
   ```
   Commit `package.json` and `package-lock.json`, then push.
3. Set `SENTRY_DSN` on the backend in Render.
4. The deploy log should show `Error tracking  on (Sentry)`. If it shows `off — … not installed`, step 2 didn't reach the deploy.

### Logs

**Render → clearslip-backend → Logs** shows one JSON line per request, for example:
```json
{"t":"2026-11-05T10:12:03.120Z","id":"a1b2c3d4","method":"POST","path":"/api/decode","status":200,"ms":184}
```
A line holds no payslip text, question or IP address. Every response carries the same ID in its `X-Request-Id` header, and error responses include it as `requestId`. To trace a report, find the ID in the browser's Network tab and search the logs for it.

## 6. After a deploy goes wrong

- **Roll back:** in Render, open the service, go to **Events**, pick the last good deploy, and choose **Rollback**.
- **Backend keeps restarting:** check the logs for `out of memory`. Keep `OCR_WORKERS=1` on the free plan.
- **"Couldn't reach ClearSlip" in the site:** the backend is asleep or down. Open `/api/health` and wait a minute. If it still fails, run the smoke test.
- **Ask ClearSlip shows only sources:** the Groq key is missing, expired or rate-limited. The free tier allows about two answers a minute. The notice above the sources says which.

## 7. Optional: your own domain

1. In each service's **Settings → Custom Domains**, add the domain (e.g. `clearslip.in` and `api.clearslip.in`) and create the DNS records Render shows. HTTPS is set up automatically.
2. Update `FRONTEND_URL` (backend) and `VITE_API_URL` (frontend) to the new addresses, then rebuild the frontend (step 3.3).
3. Run the smoke test again with the new URLs.
