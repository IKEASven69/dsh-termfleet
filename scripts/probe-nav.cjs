// 看 nav 完整结构
const { chromium } = require('playwright');
const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, 'fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo');
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const navs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('nav')).map(n => n.outerHTML.slice(0, 4000));
  });
  console.log('NAV #', navs.length);
  navs.forEach((n, i) => { console.log(`\n=== NAV ${i} ===\n${n.slice(0, 3000)}`); });
  await browser.close();
})();