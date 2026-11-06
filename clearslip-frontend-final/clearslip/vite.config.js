import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The files in-browser OCR needs, served from ClearSlip itself instead of public
// CDNs: visitors' browsers then contact no one but ClearSlip, and OCR keeps working
// if a CDN is down. tesseract.js picks one engine file (SIMD if the browser has it);
// both are LSTM-only builds, matching createWorker('eng', 1) in readPayslipFile.js.
const OCR_FILES = {
  'tesseract/worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract/tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract/tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract/eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
}
const fromNodeModules = file => path.resolve('node_modules', file)

function selfHostedOcr() {
  return {
    name: 'clearslip-self-hosted-ocr',
    // `npm run dev`: answer /tesseract/… straight from node_modules
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = OCR_FILES[req.url.split('?')[0].slice(1)]
        if (!file) return next()
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        fs.createReadStream(fromNodeModules(file)).pipe(res)
      })
    },
    // `npm run build`: copy them into dist/tesseract/
    generateBundle() {
      for (const [fileName, file] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName, source: fs.readFileSync(fromNodeModules(file)) })
      }
    },
  }
}

/**
 * The built page's Content-Security-Policy, as a <meta> tag: the API's address is
 * only known at build time (VITE_API_URL), so a fixed header in render.yaml
 * couldn't name it. Only for the build — the dev server relies on inline scripts.
 *   script-src 'wasm-unsafe-eval'  OCR compiles its WebAssembly engine
 *   img-src data: blob:            the uploaded photo's preview
 *   connect-src                    this site and the API, nothing else
 * frame-ancestors can't be set from a meta tag; X-Frame-Options (render.yaml) covers it.
 */
function contentSecurityPolicy(apiUrl) {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${new URL(apiUrl).origin}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'clearslip-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  }
}

export default defineConfig(({ mode }) => {
  // Same default as src/utils/api.js
  const apiUrl = process.env.VITE_API_URL || loadEnv(mode, process.cwd()).VITE_API_URL || 'http://localhost:4000'
  return {
    plugins: [react(), selfHostedOcr(), contentSecurityPolicy(apiUrl)],
    server: { port: 5173 },
    // `npm test`: unit and component tests in a simulated browser (jsdom).
    // The end-to-end test in e2e/ runs in a real browser with Playwright instead.
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      setupFiles: ['./src/test/setup.js'],
      restoreMocks: true,
    },
  }
})
