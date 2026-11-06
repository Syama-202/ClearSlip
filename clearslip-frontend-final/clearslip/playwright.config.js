import { defineConfig, devices } from '@playwright/test'

// `npm run e2e`: the whole app in a real browser — the real backend and the
// production build of the frontend, started here on their own ports so they
// don't clash with `npm run dev`. The backend runs without an AI key and with keyword search only
// (RAG_DENSE=off), so the test never calls Groq or downloads the search model.
// First run on a new machine: `npx playwright install chromium`
// (or set PW_CHANNEL=msedge / chrome to use a browser that's already installed).
const API = 'http://localhost:4300'
const SITE = 'http://localhost:5300'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: SITE,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    ...(process.env.PW_CHANNEL && { channel: process.env.PW_CHANNEL }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'node server.js',
      cwd: '../../clearslip-backend',
      url: `${API}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { PORT: '4300', FRONTEND_URL: SITE, GROQ_API_KEY: '', N8N_WEBHOOK_URL: '', RAG_DENSE: 'off', NODE_ENV: 'development' },
    },
    // The production build, not the dev server: what Render serves, with its
    // Content-Security-Policy and self-hosted OCR files
    {
      command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 5300 --strictPort',
      url: SITE,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { VITE_API_URL: API },
    },
  ],
})
