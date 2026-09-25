// 看 DockSurface chrome 区域到底有几个按钮
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

  // 找 dock surface 上 tab strip + chrome 区所有按钮
  const chrome = await page.evaluate(() => {
    const surface = document.querySelector('[data-dockkit-surface]');
    if (!surface) return null;
    // 列出 surface 内所有 button/input/checkbox
    return Array.from(surface.querySelectorAll('button, input, [role="checkbox"]')).map(el => ({
      tag: el.tagName,
      type: el.type || '',
      role: el.getAttribute('role') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      dataKeys: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).slice(0, 5),
      text: (el.innerText || el.value || '').slice(0, 40).trim(),
      title: el.title || '',
      rect: el.getBoundingClientRect(),
    }));
  });
  console.log(JSON.stringify(chrome, null, 2));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });