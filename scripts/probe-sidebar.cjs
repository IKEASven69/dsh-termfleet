// 找会话列表的 DOM 结构
const { chromium } = require('playwright');
const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, 'fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo');
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const items = await page.evaluate(() => {
    // 找含"查看dsh-termfleet插件"文本的所有祖先
    const target = Array.from(document.querySelectorAll('*')).find(el => {
      const t = (el.textContent || '').trim();
      return t === '查看dsh-termfleet插件' || t.startsWith('查看dsh-termfleet插件');
    });
    if (!target) return { found: false };
    const ancestors = [];
    let cur = target;
    while (cur && cur.tagName !== 'BODY') {
      ancestors.push({
        tag: cur.tagName, cls: (cur.className || '').slice(0, 60), role: cur.getAttribute('role'),
        tabindex: cur.getAttribute('tabindex'), id: cur.id || '',
        text: (cur.innerText || '').slice(0, 60), cursor: getComputedStyle(cur).cursor
      });
      cur = cur.parentElement;
      if (ancestors.length > 6) break;
    }
    return { found: true, target: { tag: target.tagName, text: (target.innerText||'').slice(0,60) }, ancestors };
  });
  console.log(JSON.stringify(items, null, 2));
  await browser.close();
})();