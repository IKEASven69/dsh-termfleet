// 单独看 TF tab body 区域里到底是什么 chrome
const { chromium } = require('playwright');
const URL = process.env.TF_URL || 'http://127.0.0.1:3180/?token=VrLivvsGXqf-d7wZBzQPsaxNqtG7Mj2sDffPXopthIc';
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

  // 点 TF 引导胶囊
  const tf = page.locator('[data-sidebar-right-guide-entry="termfleet"]').first();
  await tf.click();
  await page.waitForTimeout(4000);

  // 抓 TF tab body 周边所有 element 文本 + 角色 + data-*
  const chrome = await page.evaluate(() => {
    const tabBody = document.querySelector('[data-tf-sidebar-tab-body]');
    if (!tabBody) return { error: 'tab body not found' };
    // 列出 tab body 的父链 + 同级
    const result = [];
    let el = tabBody;
    for (let i = 0; i < 6 && el; i++) {
      result.push({
        level: i,
        tag: el.tagName,
        cls: (el.className || '').slice(0, 100),
        dataKeys: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => `${a.name}=${a.value}`).slice(0, 8),
        text: (el.innerText || '').slice(0, 200).replace(/\n/g, ' | '),
      });
      el = el.parentElement;
    }
    // 抓所有 checkbox / 按钮 / 文字节点
    const tabBodyParent = tabBody.parentElement;
    const allCtrls = tabBodyParent ? Array.from(tabBodyParent.querySelectorAll('input, button, label')).map(c => ({
      tag: c.tagName,
      type: c.type || '',
      text: (c.innerText || c.value || c.title || '').slice(0, 50),
      cls: (c.className || '').slice(0, 80),
    })) : [];
    return { chain: result, controls: allCtrls };
  });

  console.log(JSON.stringify(chrome, null, 2));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });