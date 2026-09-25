// dsh-termfleet · 官方右侧栏 + dsh-better-sidebar 共存验证
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';
const TOKEN = 'VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';
const OUT = path.resolve(__dirname, '../docs/audit/screens');

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error') console.log(`[err]`, m.text());
  });

  console.log('1) goto', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  console.log('   __tfClient =', await page.evaluate(() => window.__tfClient));

  // baseline（hero 状态）
  await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-1-baseline.png'), fullPage: false });
  console.log('   shot: baseline');

  // 进会话
  const sessionLink = page.locator('[role="treeitem"]').filter({ hasText: '查看dsh-termfleet插件' }).first();
  if (await sessionLink.count() > 0) {
    await sessionLink.click();
    await page.waitForTimeout(4000);
  } else {
    console.log('   WARN: no session link found, try fallback');
    const fallback = page.locator('text=查看dsh-termfleet插件').first();
    if (await fallback.count() > 0) await fallback.click();
    await page.waitForTimeout(4000);
  }
  await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-2-session-open.png'), fullPage: false });
  console.log('   shot: session open');

  // header TF 按钮
  const headerTf = page.locator('button[title^="TermFleet 团队驾驶舱"]').first();
  if (await headerTf.count() > 0) {
    await headerTf.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-3-header-float.png'), fullPage: false });
    console.log('   shot: header float');
    await headerTf.click();
    await page.waitForTimeout(500);
  } else {
    console.log('   WARN: header TF button not found');
  }

  // 展开右侧栏
  const expandBtn = page.locator('[data-sidebar-right-expand]').first();
  if (await expandBtn.count() === 0) {
    // 可能侧栏已展开，找 collapse 按钮（aria-label="收起右侧边栏"）
    const collapseBtn = page.locator('button[aria-label="收起右侧边栏"]').first();
    if (await collapseBtn.count() > 0) {
      console.log('   sidebar already expanded (no expand button needed)');
    } else {
      console.log('   FATAL: sidebar expand button not found');
      await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-FATAL-no-expand.png'), fullPage: false });
      await browser.close();
      process.exit(2);
    }
  } else {
    await expandBtn.click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-4-sidebar-empty.png'), fullPage: false });
  console.log('   shot: sidebar expanded');

  // 引导胶囊全列
  const guideEntries = await page.locator('[data-sidebar-right-guide-entry]').allTextContents();
  console.log('   guide entries =', JSON.stringify(guideEntries));

  // 列侧栏所有 button 文本（看 better-sidebar 都有啥 tab）
  const allButtons = await page.evaluate(() => {
    const panel = document.querySelector('[data-sidebar-right-panel]');
    if (!panel) return [];
    return Array.from(panel.querySelectorAll('button')).map(b => (b.innerText || b.title || '').slice(0, 40)).filter(Boolean);
  });
  console.log('   sidebar buttons =', JSON.stringify(allButtons.slice(0, 40)));

  // 列所有 tab strip chip
  const chips = await page.evaluate(() => {
    const strip = document.querySelector('[data-sidebar-right-tab-strip]');
    if (!strip) return [];
    return Array.from(strip.querySelectorAll('button, [role="tab"]')).map(b => ({
      text: (b.innerText || '').slice(0, 40),
      title: b.title || '',
      aria: b.getAttribute('aria-label') || ''
    }));
  });
  console.log('   tab chips =', JSON.stringify(chips));

  // 点 TF 引导胶囊
  const tfGuide = page.locator('[data-sidebar-right-guide-entry="termfleet"]').first();
  if (await tfGuide.count() > 0) {
    await tfGuide.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-5-tf-tab.png'), fullPage: false });
    console.log('   shot: tf tab opened');
  }

  // 看 TF 是否还在 tab strip 里（和 better-sidebar 共存）
  const tfChipsAfter = await page.evaluate(() => {
    const strip = document.querySelector('[data-sidebar-right-tab-strip]');
    if (!strip) return [];
    return Array.from(strip.querySelectorAll('button')).map(b => (b.innerText || '').slice(0, 30)).filter(Boolean);
  });
  console.log('   tab chips after tf open =', JSON.stringify(tfChipsAfter));

  // 兜底：点 better-sidebar 的第一个 tab（看是哪种类型 tab），然后再截一张完整对照
  const firstBsTab = page.locator('[data-sidebar-right-tab-strip] button').filter({ hasNotText: 'TermFleet' }).first();
  if (await firstBsTab.count() > 0) {
    const txt = await firstBsTab.innerText();
    console.log('   trying better-sidebar tab:', txt.slice(0, 30));
    await firstBsTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-6-bs-tab.png'), fullPage: false });
    console.log('   shot: better-sidebar tab');
  }

  // 同时打开 TF + BS tab（看 dock kit 怎么处理 split）
  if (await tfGuide.count() > 0) {
    await tfGuide.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-7-tf-and-bs.png'), fullPage: false });
    console.log('   shot: tf + bs coexist');
  }

  await page.screenshot({ path: path.join(OUT, 'sidebar-coexist-8-final.png'), fullPage: false });
  console.log('   shot: final');

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });