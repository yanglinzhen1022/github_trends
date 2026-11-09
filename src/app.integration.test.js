import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 加载真实 index.html 的 body，让 app.js 在真实 DOM 结构上运行
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
const bodyHtml = html.match(/<body>([\s\S]*)<\/body>/)[1];

const daysAgoISO = (d) => new Date(Date.now() - d * 86400000).toISOString();

// 搜索 API 返回顺序（按 Star 总数降序）：
// ccc(900) > bbb(500) > aaa(200)
// 窗口期内真实涨星：aaa(+5) > bbb(+1) > ccc(+0)
// → 增量模式重排后应为 aaa, bbb, ccc
const REPOS = [
  { id: 3, name: 'ccc', full_name: 'owner/ccc', stargazers_count: 900, forks_count: 10, language: 'Rust', description: 'c', html_url: 'https://github.com/owner/ccc', owner: { login: 'owner' } },
  { id: 2, name: 'bbb', full_name: 'owner/bbb', stargazers_count: 500, forks_count: 5, language: 'Go', description: 'b', html_url: 'https://github.com/owner/bbb', owner: { login: 'owner' } },
  { id: 1, name: 'aaa', full_name: 'owner/aaa', stargazers_count: 200, forks_count: 1, language: 'JavaScript', description: 'a', html_url: 'https://github.com/owner/aaa', owner: { login: 'owner' } },
];

const STARGAZERS = {
  'owner/aaa': [daysAgoISO(30), daysAgoISO(6), daysAgoISO(5), daysAgoISO(4), daysAgoISO(3), daysAgoISO(2)], // 5 in window
  'owner/bbb': [daysAgoISO(40), daysAgoISO(3)], // 1 in window
  'owner/ccc': [daysAgoISO(60), daysAgoISO(30)], // 0 in window
};

// 可按测试调整的 mock 配置
let rateLimitRemaining = 5000;
let stargazerDelayMs = 0;
let stargazerMode = 'ok'; // 'ok' | 'denied'（模拟 Fine-grained PAT 缺权限时的 403）
const fetchCalls = [];

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    headers: { get: () => null },
  };
}

function cardNames() {
  return Array.from(document.querySelectorAll('.repo-card .repo-title a')).map(a => a.textContent);
}

beforeAll(async () => {
  // 配置 mock（必须在导入 app.js 前替换 fetch）
  global.fetch = async (url) => {
    const u = String(url);
    fetchCalls.push(u);

    if (u.includes('/search/repositories')) {
      return jsonResponse({ items: REPOS });
    }
    if (u.includes('/rate_limit')) {
      return jsonResponse({ resources: { core: { remaining: rateLimitRemaining, limit: 5000 } } });
    }
    if (u.includes('/stargazers')) {
      if (stargazerMode === 'denied') {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ message: 'Resource not accessible with personal access token' }),
        };
      }
      if (stargazerDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, stargazerDelayMs));
      }
      const fullName = u.split('/repos/')[1].split('/stargazers')[0];
      return jsonResponse((STARGAZERS[fullName] || []).map(at => ({ starred_at: at, user: { login: 'u' } })));
    }
    throw new Error(`unexpected fetch: ${u}`);
  };

  // 先搭建 DOM，再加载 app.js（app.js 在模块顶层捕获 DOM 引用）
  document.body.innerHTML = bodyHtml;
  await import('./app.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));

  // 等待首次（新秀模式）加载完成：骨架屏没有 .repo-title a
  await vi.waitFor(() => {
    expect(document.querySelectorAll('.repo-card .repo-title a').length).toBe(3);
  }, { timeout: 5000 });
});

describe('growth mode integration', () => {
  it('shows progress, re-ranks by window star growth, and renders badges', async () => {
    const callsBefore = fetchCalls.length;
    stargazerDelayMs = 250; // 拉长统计阶段，确保能观察到进行中的进度条

    const select = document.getElementById('trend-mode');
    select.value = 'growth';
    select.dispatchEvent(new Event('change'));

    // 1. 进行中：进度条可见
    const statusEl = document.getElementById('growth-status');
    await vi.waitFor(() => expect(statusEl.hidden).toBe(false), { timeout: 5000 });
    expect(statusEl.textContent).toContain('正在统计');

    // 2. 完成后：按真实涨星重排（aaa+5 → bbb+1 → ccc+0）
    await vi.waitFor(() => {
      expect(cardNames()).toEqual(['owner/aaa', 'owner/bbb', 'owner/ccc']);
    }, { timeout: 5000 });

    // 3. 徽标与数值
    const firstCard = document.querySelector('.repo-card');
    expect(firstCard.textContent).toContain('🔥 +5');
    const cards = Array.from(document.querySelectorAll('.repo-card'));
    expect(cards[1].textContent).toContain('🔥 +1');
    expect(cards[2].textContent).not.toContain('🔥');

    // 4. 进度条在完成后隐藏，且确实发出了 stargazers 请求（正向对照）
    expect(statusEl.hidden).toBe(true);
    const growthCalls = fetchCalls.slice(callsBefore);
    expect(growthCalls.some(c => c.includes('/stargazers'))).toBe(true);
  });

  it('skips stargazer statistics when unauthenticated quota is insufficient', async () => {
    sessionStorage.removeItem('growth_cache'); // 清掉上一轮的增量缓存
    rateLimitRemaining = 3; // 少于候选数 × 2 的安全阈值
    stargazerDelayMs = 0;

    const select = document.getElementById('trend-mode');

    // 先切回新秀模式（恢复搜索顺序），再切入增量模式触发预检
    select.value = 'new';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      expect(cardNames()).toEqual(['owner/ccc', 'owner/bbb', 'owner/aaa']);
    }, { timeout: 5000 });

    const callsBeforeGrowth = fetchCalls.length;
    select.value = 'growth';
    select.dispatchEvent(new Event('change'));

    // 预检失败：显示配额提示，而不是烧光配额后什么都不显示
    const statusEl = document.getElementById('growth-status');
    await vi.waitFor(() => expect(statusEl.hidden).toBe(false), { timeout: 5000 });
    expect(statusEl.textContent).toContain('配额');
    expect(statusEl.textContent).toContain('3');

    // 候选按 Star 总数展示，未做增量重排
    expect(cardNames()).toEqual(['owner/ccc', 'owner/bbb', 'owner/aaa']);

    // 没有发出任何 stargazers 请求
    const growthCalls = fetchCalls.slice(callsBeforeGrowth);
    expect(growthCalls.some(c => c.includes('/stargazers'))).toBe(false);
  });

  it('verifies the token on save and reflects it in the header button', async () => {
    rateLimitRemaining = 5000;

    // 打开弹窗 → 粘贴 Token → 保存 → 弹窗内应出现验证结果
    document.getElementById('token-btn').click();
    document.getElementById('token-input').value = 'ghp_test_token';
    document.getElementById('token-save-btn').click();

    const hint = document.getElementById('token-verify-hint');
    await vi.waitFor(() => {
      expect(hint.textContent).toContain('✅');
    }, { timeout: 5000 });
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain('5000');
    expect(hint.classList.contains('success')).toBe(true);

    // 顶部按钮变为已配置状态
    expect(document.getElementById('token-btn').textContent).toContain('Token ✓');
  });

  it('explains when a saved token lacks stargazers permission (403)', async () => {
    sessionStorage.removeItem('growth_cache'); // 上一步的增量缓存
    stargazerMode = 'denied'; // 模拟 Fine-grained PAT 未勾选 Stargazers 权限

    // Token 已在上一步保存（localStorage），预检应被跳过，直接进入统计
    const select = document.getElementById('trend-mode');
    select.value = 'growth';
    select.dispatchEvent(new Event('change'));

    const statusEl = document.getElementById('growth-status');
    await vi.waitFor(() => {
      expect(statusEl.hidden).toBe(false);
      expect(statusEl.textContent).toContain('权限');
    }, { timeout: 5000 });
    expect(statusEl.textContent).toContain('Stargazers');
  });
});
