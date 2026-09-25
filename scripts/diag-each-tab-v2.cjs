// 诊断 v2：每次点回 guide 后再点下一个 kind，避免 dock surface 切走后找不到胶囊
const { chromium } = require('playwright');
const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';
const TOKEN = 'VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';

const KINDS = ['files', 'git', 'subagent', 'sidechat', 'terminal', 'termfleet', 'browser'];

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

  for (const kind of KINDS) {
    // 重新选胶囊（即使 dock 已切到别 tab，引导页入口还在 dock tab strip 里）
    // 先找 dock tab strip 上的 guide chip（kind="guide"）
    let capsule = page.locator(`[data-sidebar-right-guide-entry="${kind}"]`).first();
    if (await capsule.count() === 0) {
      // 引导胶囊不可见：切到 guide tab
      // guide tab 的入口可能是 DockSurface 里的 guide chip
      const guideChip = page.locator('[data-sidebar-right-panel] button[title*="guide"], [data-sidebar-right-panel] button:has-text("开始")').first();
      if (await guideChip.count() > 0) {
        await guideChip.click();
        await page.waitForTimeout(2000);
      }
      capsule = page.locator(`[data-sidebar-right-guide-entry="${kind}"]`).first();
    }
    if (await capsule.count() === 0) {
      console.log(`[${kind}] not found, skipping`);
      continue;
    }

    console.log(`\n[${kind}] clicking capsule`);
    await capsule.click();
    await page.waitForTimeout(4000);

    const info = await page.evaluate(() => {
      const panel = document.querySelector('[data-sidebar-right-panel]');
      const iframe = panel ? panel.querySelector('iframe') : null;
      // 提取 dock tab strip 上的所有 chip kind
      const chips = Array.from(panel ? panel.querySelectorAll('[data-sidebar-right-tab-strip] button, [data-sidebar-right-tab] button') : []).map(b => ({
        text: (b.innerText || '').slice(0, 30),
        title: b.title || '',
      }));
      return {
        panelText: panel ? (panel.innerText || '').slice(0, 400).replace(/\n/g, ' | ') : '',
        iframeSrc: iframe?.src?.slice(0, 120) || null,
        iframeTitle: iframe?.title || null,
        chips,
      };
    });
    console.log(`   panel text: ${info.panelText.slice(0, 200)}`);
    console.log(`   iframe: ${JSON.stringify(info.iframe)}`);
    console.log(`   chips: ${JSON.stringify(info.chips)}`);

    await page.screenshot({ path: `D:/coding/dsh-termfleet/docs/audit/screens/each-tab-${kind}.png`, fullPage: false });
    console.log(`   shot: each-tab-${kind}.png`);
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });