// 单独测 TF tab 的 banner 效果（不依赖引导胶囊回归）
const { chromium } = require('playwright');
const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';
const TOKEN = 'VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const sessionLink = page.locator('[role="treeitem"]').filter({ hasText: '查看dsh-termfleet插件' }).first();
  if (await sessionLink.count() > 0) { await sessionLink.click(); await page.waitForTimeout(3000); }

  const expandBtn = page.locator('[data-sidebar-right-expand]').first();
  if (await expandBtn.count() > 0) { await expandBtn.click(); await page.waitForTimeout(2500); }

  // 直接点 TF 引导胶囊
  const tf = page.locator('[data-sidebar-right-guide-entry="termfleet"]').first();
  console.log('TF capsule count:', await tf.count());
  await tf.click();
  await page.waitForTimeout(4000);  // 等 fetch 完成 + banner 渲染

  const info = await page.evaluate(() => {
    const banner = document.querySelector('[data-tf-status]');
    const iframe = document.querySelector('[data-tf-sidebar-tab-body] iframe');
    return {
      bannerKind: banner?.getAttribute('data-tf-status'),
      bannerText: banner?.innerText || '',
      bannerColor: banner ? window.getComputedStyle(banner).color : '',
      iframeSrc: iframe?.src,
      iframeTitle: iframe?.title,
    };
  });
  console.log('TF tab state:', JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'D:/coding/dsh-termfleet/docs/audit/screens/banner-1-tf-tab.png', fullPage: false });
  console.log('shot: banner-1-tf-tab.png');

  // 验证头部浮层（也加 banner 了）
  const headerTf = page.locator('button[title^="TermFleet 团队驾驶舱"]').first();
  if (await headerTf.count() > 0) {
    await headerTf.click();
    await page.waitForTimeout(3500);
    const panelInfo = await page.evaluate(() => {
      const banner = document.querySelector('[data-tf-status]');
      return {
        bannerKind: banner?.getAttribute('data-tf-status'),
        bannerText: banner?.innerText || '',
      };
    });
    console.log('header float banner:', JSON.stringify(panelInfo, null, 2));
    await page.screenshot({ path: 'D:/coding/dsh-termfleet/docs/audit/screens/banner-2-header-float.png', fullPage: false });
    console.log('shot: banner-2-header-float.png');
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });