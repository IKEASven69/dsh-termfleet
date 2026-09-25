// dsh-termfleet · 官方右侧栏挂载验证截图脚本
// 1) 访问 dsh web GUI
// 2) 等 React mount
// 3) 截 baseline (含会话头 TF 浮层入口)
// 4) 展开官方右侧栏（header.corner 的 ExpandButton）
// 5) 截 sidebar-empty (空引导页 - TF 引导胶囊)
// 6) 截 sidebar-tf-open (TF tab 激活, iframe 加载 /app)
// 7) 同时点 TF header utility 看浮层 (作为对照)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo';
const OUT = path.resolve(__dirname, '../docs/audit/screens');

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  // 令牌预存到 localStorage（避免 URL token 漂移）
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('tf_token', t); } catch {}
  }, 'fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') console.log(`[${t}]`, m.text());
  });

  console.log('1) goto', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  // 等 React/SidebarRight mount
  await page.waitForFunction(() => window.__tfClient !== undefined, { timeout: 30000 }).catch(() => {});
  console.log('   __tfClient =', await page.evaluate(() => window.__tfClient));

  // baseline
  await page.screenshot({ path: path.join(OUT, 'sidebar-right-v2-1-baseline.png'), fullPage: false });
  console.log('   shot: baseline');

  // 点进一个具体会话（左侧列表里有历史会话）—— hero 状态下 header/corner 不渲染
  // 会话项是 [role="treeitem"]，文本包含 "查看dsh-termfleet插件"
  const sessionLink = page.locator('[role="treeitem"]').filter({ hasText: '查看dsh-termfleet插件' }).first();
  const sessionCount = await sessionLink.count();
  console.log('   target treeitem count =', sessionCount);
  if (sessionCount > 0) {
    await sessionLink.click();
    await page.waitForTimeout(4000);
  } else {
    // 兜底：找含目标文本的 SPAN（_root_*）的最近可点击祖先
    const fallback = page.locator('text=查看dsh-termfleet插件').first();
    if (await fallback.count() > 0) {
      await fallback.click();
      await page.waitForTimeout(4000);
    }
  }

  await page.screenshot({ path: path.join(OUT, 'sidebar-right-v2-1b-session-open.png'), fullPage: false });
  console.log('   shot: session opened');

  // 找会话头 TF utility 按钮（按 title 文本定位）
  const headerTf = page.locator('button[title^="TermFleet 团队驾驶舱"]').first();
  const headerTfCount = await headerTf.count();
  console.log('   header TF button count =', headerTfCount);
  if (headerTfCount > 0) {
    await headerTf.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'sidebar-right-v2-2-header-float.png'), fullPage: false });
    console.log('   shot: header float');
    await headerTf.click(); // close
    await page.waitForTimeout(500);
  }

  // 展开右侧栏（corner expand button）—— 只在 sidebar 折叠 + 有 session 时出现
  const expandBtn = page.locator('[data-sidebar-right-expand]').first();
  const expandCount = await expandBtn.count();
  console.log('   sidebar expand button count =', expandCount);
  if (expandCount > 0) {
    await expandBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'sidebar-right-v2-3-expanded-empty.png'), fullPage: false });
    console.log('   shot: sidebar expanded');

    const guideEntries = await page.locator('[data-sidebar-right-guide-entry]').allTextContents();
    console.log('   guide entries =', JSON.stringify(guideEntries));

    // 引导胶囊直接点（type=button、data-sidebar-right-guide-entry 包含 termfleet）
    const tfGuide = page.locator('[data-sidebar-right-guide-entry="termfleet"]').first();
    const tfGuideCount = await tfGuide.count();
    console.log('   TF guide capsule count =', tfGuideCount);
    if (tfGuideCount > 0) {
      await tfGuide.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(OUT, 'sidebar-right-v2-4-tf-tab-open.png'), fullPage: false });
      console.log('   shot: tf tab open (via guide)');
      const iframeSrc = await page.locator('iframe[title="TermFleet"]').first().getAttribute('src').catch(() => null);
      console.log('   TermFleet iframe src =', iframeSrc);
    } else {
      // 兜底：sidebar 面板内 TermFleet chip
      const tfChip = page.locator('[data-sidebar-right-panel] button:has-text("TermFleet")').first();
      const tfChipCount = await tfChip.count();
      console.log('   TF chip in sidebar =', tfChipCount);
      if (tfChipCount > 0) {
        await tfChip.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(OUT, 'sidebar-right-v2-4-tf-tab-open.png'), fullPage: false });
        console.log('   shot: tf tab open (via chip)');
      }
    }
  } else {
    console.log('   WARN: sidebar expand button not found - corner slot may need session bound');
  }

  // 全屏兜底再一张
  await page.screenshot({ path: path.join(OUT, 'sidebar-right-v2-5-final.png'), fullPage: false });
  console.log('   shot: final');

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });