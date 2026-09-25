// 探针：列出页面所有按钮的 title 与文本，帮助找 selector
const { chromium } = require('playwright');

const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('tf_token', t); } catch {}
  }, 'fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo');
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);

  const data = await page.evaluate(() => {
    const out = { buttons: [], navLinks: [], allText: [] };
    document.querySelectorAll('button').forEach((b, i) => {
      out.buttons.push({ i, title: b.title || '', text: (b.innerText || '').slice(0, 60), aria: b.getAttribute('aria-label') || '' });
    });
    document.querySelectorAll('nav a, nav button').forEach((b, i) => {
      out.navLinks.push({ i, tag: b.tagName, title: b.title || '', text: (b.innerText || '').slice(0, 60) });
    });
    out.allText = (document.body.innerText || '').slice(0, 1500);
    return out;
  });
  console.log('BUTTONS:', JSON.stringify(data.buttons.slice(0, 40), null, 2));
  console.log('NAV LINKS:', JSON.stringify(data.navLinks, null, 2));
  console.log('TEXT:', data.allText);

  await browser.close();
})();