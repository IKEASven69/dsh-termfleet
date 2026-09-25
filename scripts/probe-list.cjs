// 探针：找会话项"打开"按钮（不是操作按钮）
const { chromium } = require('playwright');
const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, 'fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo');
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // 找出所有可点击的"会话链接"（不是操作按钮）
  const links = await page.evaluate(() => {
    const out = [];
    // 找会话项的 li / div
    document.querySelectorAll('nav li, nav [role="listitem"], nav div').forEach((el, i) => {
      const t = el.innerText || '';
      if (t.length > 0 && t.length < 200 && (t.includes('dsh-termfleet') || t.includes('dsh-notch') || t.includes('sensenova') || t.includes('生图') || t.includes('会话'))) {
        out.push({ i, tag: el.tagName, cls: el.className, text: t.slice(0, 100), cursor: getComputedStyle(el).cursor });
      }
    });
    return out;
  });
  console.log('LINKS:', JSON.stringify(links.slice(0, 30), null, 2));

  // 用 session-id 属性找链接
  const sessionAttr = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-session-id]')).map(e => ({
      tag: e.tagName, sid: e.getAttribute('data-session-id'), text: (e.innerText || '').slice(0, 80), cursor: getComputedStyle(e).cursor
    }));
  });
  console.log('SESSION ATTR:', JSON.stringify(sessionAttr, null, 2));

  await browser.close();
})();