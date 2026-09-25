// 单独抓 TF tab body 区域里 banner 下方的具体元素（看 Pretty-print 究竟是什么）
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:3180/?token=VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';
const TOKEN = 'VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, TOKEN);
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const sessionLink = page.locator('[role="treeitem"]').filter({ hasText: '查看dsh-termfleet插件' }).first();
  if (await sessionLink.count() > 0) { await sessionLink.click(); await page.waitForTimeout(3000); }

  const expandBtn = page.locator('[data-sidebar-right-expand]').first();
  if (await expandBtn.count() > 0) { await expandBtn.click(); await page.waitForTimeout(2500); }

  const tf = page.locator('[data-sidebar-right-guide-entry="termfleet"]').first();
  await tf.click();
  await page.waitForTimeout(4000);

  // 抓 banner 之后 iframe 之前的元素
  const middle = await page.evaluate(() => {
    const body = document.querySelector('[data-tf-sidebar-tab-body]');
    if (!body) return null;
    // body 的子元素
    return Array.from(body.children).map(c => ({
      tag: c.tagName,
      cls: (c.className || '').slice(0, 100),
      text: (c.innerText || '').slice(0, 200).replace(/\n/g, ' | '),
      attrs: Array.from(c.attributes).filter(a => a.name.startsWith('data-') || a.name === 'title' || a.name === 'src').map(a => a.name + '=' + a.value),
    }));
  });
  console.log('TF tab body children:', JSON.stringify(middle, null, 2));

  // 也搜整个 panel 里 "Pretty" / "Print"
  const allWithText = await page.evaluate(() => {
    const panel = document.querySelector('[data-sidebar-right-panel]');
    if (!panel) return null;
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, null);
    const found = [];
    let n; while ((n = walker.nextNode())) {
      const t = (n.textContent || '').trim();
      if (/print|Pretty|pretty/i.test(t) && t.length < 80) found.push(t);
    }
    return found;
  });
  console.log('text containing print/Pretty:', JSON.stringify(allWithText));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });