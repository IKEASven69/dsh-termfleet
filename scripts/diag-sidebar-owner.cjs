// 诊断：better-sidebar 装上后整个右栏是谁在渲染？
// 检查每个 panel/tab/guide entry 的 owner (data-* 属性 + nearest plugin marker)
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

  // 进会话
  const sessionLink = page.locator('[role="treeitem"]').filter({ hasText: '查看dsh-termfleet插件' }).first();
  if (await sessionLink.count() > 0) { await sessionLink.click(); await page.waitForTimeout(3000); }

  // 展开侧栏（找 expand 按钮）
  const expandBtn = page.locator('[data-sidebar-right-expand]').first();
  if (await expandBtn.count() > 0) { await expandBtn.click(); await page.waitForTimeout(2500); }

  // 关键诊断：列出所有右栏容器及它们的 data-* 属性 + 外层 plugin 标记
  const diag = await page.evaluate(() => {
    const result = { panels: [], guides: [], tabStrips: [], iframes: [] };

    // 收集所有 data-sidebar-right-* 容器
    document.querySelectorAll('[data-sidebar-right-panel], [data-sidebar-right-guide], [data-sidebar-right-tab-strip], [data-sidebar-right-tab], [data-sidebar-right-pane]').forEach((el) => {
      const attrs = {};
      for (const a of el.attributes) {
        if (a.name.startsWith('data-')) attrs[a.name] = a.value;
      }
      result.panels.push({
        tag: el.tagName,
        cls: (el.className || '').slice(0, 80),
        attrs,
        // 找最近的 owner 标记（plugin name 等）
        ownerHints: [
          el.getAttribute('data-plugin'),
          el.getAttribute('data-plugin-css'),
          (el.closest('[data-plugin]') || {}).getAttribute?.('data-plugin'),
          (el.closest('[data-bs]') || {}).getAttribute?.('data-bs'),
          (el.closest('[data-better-sidebar]') || {}).getAttribute?.('data-better-sidebar'),
        ].filter(Boolean),
        rect: el.getBoundingClientRect(),
      });
    });

    // 找所有引导胶囊及其 owner
    document.querySelectorAll('[data-sidebar-right-guide-entry]').forEach((el) => {
      result.guides.push({
        kind: el.getAttribute('data-sidebar-right-guide-entry'),
        text: (el.innerText || '').slice(0, 40),
        ownerHints: [
          el.closest('[data-plugin]')?.getAttribute('data-plugin'),
          el.closest('[data-bs]')?.getAttribute('data-bs'),
        ].filter(Boolean),
      });
    });

    // 找所有 iframe
    document.querySelectorAll('iframe').forEach((el) => {
      result.iframes.push({
        title: el.title || '',
        src: (el.src || '').slice(0, 120),
        ownerHints: [
          el.closest('[data-plugin]')?.getAttribute('data-plugin'),
        ].filter(Boolean),
      });
    });

    // 全局检查有没有 better-sidebar / dsh-better-sidebar 的标记
    result.bsMarkers = {
      rootHasBs: !!document.querySelector('[data-bs-pane], [data-better-sidebar], [data-bs-tab]'),
      bsScripts: Array.from(document.scripts || []).map(s => s.src || '').filter(s => s.includes('better-sidebar')).slice(0, 5),
      bsStyles: !!document.querySelector('style[data-plugin*="better-sidebar"]'),
      windowBsFlag: !!window.__betterSidebar || !!window.__bs || !!window.__dshBetterSidebar,
    };

    // 检查插件 CSS
    result.cssTags = Array.from(document.querySelectorAll('style[data-plugin]')).map(s => s.getAttribute('data-plugin'));

    return result;
  });

  console.log(JSON.stringify(diag, null, 2));

  await page.screenshot({ path: 'D:/coding/dsh-termfleet/docs/audit/screens/diag-1-sidebar-owner.png', fullPage: false });
  console.log('   shot: diag');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });