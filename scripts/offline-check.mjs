import playwright from 'file:///D:/AI-COMPANY/npm/node_modules/@playwright/mcp/node_modules/playwright-core/index.js'
const { chromium } = playwright
const browser = await chromium.launch({
  headless: true,
  executablePath:
    'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1148/chrome-win/chrome.exe',
})
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForFunction(() => 'serviceWorker' in navigator)
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.register('./sw.js')
  await navigator.serviceWorker.ready
  if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING')
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => navigator.serviceWorker.controller)
const cached = await page.evaluate(async () => {
  const keys = await caches.keys()
  const matches = []
  for (const key of keys) {
    const cache = await caches.open(key)
    const reqs = await cache.keys()
    matches.push(...reqs.map((r) => r.url))
  }
  return { keys, matches }
})
await context.setOffline(true)
let title = ''
try {
  await page.reload({ waitUntil: 'domcontentloaded' })
  title = await page.locator('h1').innerText()
} catch (err) {
  title = `offline-reload-failed:${String(err).slice(0, 80)}`
  const shell = await page.evaluate(async () => {
    const res = await caches.match('./index.html')
    return Boolean(res)
  })
  title = shell ? 'cached-index-present' : title
}
await browser.close()
console.log(JSON.stringify({ title, cached, errors }))
