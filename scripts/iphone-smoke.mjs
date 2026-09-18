import playwright from 'file:///D:/AI-COMPANY/npm/node_modules/@playwright/mcp/node_modules/playwright-core/index.js'
const { chromium } = playwright

const url = 'http://127.0.0.1:4173/'
const browser = await chromium.launch({
  headless: true,
  executablePath:
    'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1148/chrome-win/chrome.exe',
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  deviceScaleFactor: 3,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(String(err)))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('h1')
const homeText = await page.locator('h1').innerText()
await page.getByRole('button', { name: '开始学习' }).click()
await page.waitForSelector('.spell')
const stage1 = await page.locator('.stage').innerText()
const wordBox = await page.locator('.word-panel').boundingBox()
const inputBox = await page.locator('.spell').boundingBox()
await page.locator('.spell').type('abacus', { delay: 12 })
await page.waitForTimeout(200)
const afterFirst = await page.locator('.progress').innerText()
await page.locator('.spell').type('abacus', { delay: 10 })
await page.waitForTimeout(250)
const stage2 = await page.locator('.stage').innerText()
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.stage')
const restoredStage = await page.locator('.stage').innerText()
const pages = ['词库与章节', '学习结算', '数据来源']
const pageTitles = []
await page.getByRole('button', { name: '退出并保存' }).click()
for (const name of pages) {
  await page.getByRole('button', { name }).click()
  pageTitles.push(await page.locator('h1').innerText())
  await page.getByRole('button', { name: '返回首页' }).click({ force: true })
}
await browser.close()
console.log(
  JSON.stringify(
    {
      homeText,
      stage1,
      afterFirst,
      stage2,
      restoredStage,
      pageTitles,
      wordBox,
      inputBox,
      errors,
    },
    null,
    2,
  ),
)
