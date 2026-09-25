// 诊断：把侧栏每个 tab 都点开截一张图，看每个 tab 内部渲染状态
const { chromium } = require('playwright');
const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';
const TOKEN = 'VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200));
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const sessionLink = page.locator('[role="treeitem"]').filter({ hasText: '查看dsh-termfleet插件' }).first();
  if (await sessionLink.count() > 0) { await sessionLink.click(); await page.waitForTimeout(3000); }

  const expandBtn = page.locator('[data-sidebar-right-expand]').first();
  if (await expandBtn.count() > 0) { await expandBtn.click(); await page.waitForTimeout(2500); }

  // 列出所有引导胶囊
  const guideEntries = await page.locator('[data-sidebar-right-guide-entry]').all();
  console.log('guide entries:');
  for (let i = 0; i < guideEntries.length; i++) {
    const kind = await guideEntries[i].getAttribute('data-sidebar-right-guide-entry');
    const text = await guideEntries[i].innerText();
    console.log(`  [${i}] kind=${kind} text=${JSON.stringify(text.slice(0, 30))}`);
  }

  // 每个胶囊点开一次
  for (let i = 0; i < guideEntries.length; i++) {
    const kind = await guideEntries[i].getAttribute('data-sidebar-right-guide-entry');
    const text = (await guideEntries[i].innerText()).slice(0, 30);
    console.log(`\n[${i}] clicking ${kind} (${JSON.stringify(text)})`);

    // 重新选（DOM 可能已变）
    const ent = page.locator(`[data-sidebar-right-guide-entry="${kind}"]`).first();
    if (await ent.count() === 0) { console.log('  skip: not found'); continue; }
    await ent.click();
    await page.waitForTimeout(3500);

    // 检查 tab strip / tab body / iframe 内容
    const info = await page.evaluate(() => {
      const panel = document.querySelector('[data-sidebar-right-panel]');
      const strip = document.querySelector('[data-sidebar-right-tab-strip]');
      const tabActive = panel ? panel.querySelector('[data-active="true"], [aria-selected="true"], .active, [data-current]') : null;
      const iframe = panel ? panel.querySelector('iframe') : null;
      const allRoots = panel ? Array.from(panel.querySelectorAll('div')).slice(0, 30).map(d => ({
        cls: (d.className || '').slice(0, 60),
        text: (d.innerText || '').slice(0, 60),
        rect: d.getBoundingClientRect(),
      })) : [];
      return {
        panelOpen: panel?.getAttribute('data-sidebar-right-open'),
        panelCls: panel?.className,
        stripPresent: !!strip,
        stripCls: strip?.className,
        activeTabText: tabActive?.innerText?.slice(0, 60),
        iframeSrc: iframe?.src?.slice(0, 120),
        iframeTitle: iframe?.title,
        // panel 内可见文本（最长 200）
        panelText: panel ? (panel.innerText || '').slice(0, 300) : '',
      };
    });
    console.log('   panel =', JSON.stringify(info, null, 2).slice(0, 600));

    await page.screenshot({ path: `D:/coding/dsh-termfleet/docs/audit/screens/each-tab-${i}-${kind}.png`, fullPage: false });
    console.log(`   shot: each-tab-${i}-${kind}.png`);
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });