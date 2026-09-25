// 探针：侧栏展开后 DOM 长什么样
const { chromium } = require('playwright');

const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('tf_token', t); } catch {} }, 'fZAPZzZaif3cMJVw_j_czn5NAgnKAyo1VIvjBtF3Meo');
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);

  // 找侧栏按钮（i:25-28 是 sidebar-right chrome）
  const out = await page.evaluate(() => {
    const sidebarTab = document.querySelector('[data-sidebar-right-panel]');
    const sidebarOpen = sidebarTab?.getAttribute('data-sidebar-right-open');
    const tabStrip = document.querySelector('[data-sidebar-right-tab-strip]');
    const guide = document.querySelector('[data-sidebar-right-guide]');
    const guideEntries = Array.from(document.querySelectorAll('[data-sidebar-right-guide-entry]')).map(e => ({
      kind: e.getAttribute('data-sidebar-right-guide-entry'),
      text: e.innerText
    }));
    const tabs = Array.from(document.querySelectorAll('[data-sidebar-right-tab-strip] button, [data-sidebar-right-tab]')).map(e => ({
      tag: e.tagName, title: e.title, text: (e.innerText || '').slice(0, 80)
    }));
    const rightPanel = document.querySelector('[data-sidebar-right-panel]')?.outerHTML?.slice(0, 2500);
    const sessionHeader = document.querySelector('header [class*="ConversationRoot"]')?.outerHTML?.slice(0, 1500);
    const sessionHeaderAll = Array.from(document.querySelectorAll('header')).map(h => h.outerHTML.slice(0, 800));
    return { sidebarOpen, hasSidebarTab: !!sidebarTab, guideEntries, tabs, sessionHeaderAll, rightPanel: rightPanel ? 'present' : 'absent' };
  });
  console.log(JSON.stringify(out, null, 2));

  await browser.close();
})();