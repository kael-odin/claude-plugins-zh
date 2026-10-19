const MARKET_REPO = 'kael-odin/claude-plugins-zh';
const MARKET_URL = `https://github.com/${MARKET_REPO}.git`;

const I18N = {
  zh: {
    title: 'Claude Code 官方插件 · 中文市场',
    subtitle: (n, z) => `${n} 个官方插件 · 中文介绍 ${z}/${n} · 无损可证 · 每日更新`,
    searchPh: '例如：代码审查、数据库、figma、安全扫描、PDF …',
    clear: '清空',
    cats: '快速分类',
    all: '全部',
    quick: { all: '全部', inrepo: '仓内插件', git: 'git 引用', url: 'URL 引用' },
    summary: (n, y, z) => `显示 ${n} / ${y} 个插件 · 中文介绍 ${z}/${y} · 数据每日自动同步`,
    intro: '简介',
    enOriginal: '英文原文',
    links: '链接',
    website: '打开官方网站 ↗',
    repoLink: '查看来源仓库 ↗',
    inrepo: '仓内插件',
    git: 'git 引用',
    url: 'URL 引用',
    installTitle: '把中文市场加进 Claude Code',
    installSteps: ['Claude Code 会话里输入 /plugin marketplace add', '填入下方仓库地址（或复制 git URL 到终端 claude plugin marketplace add）', '/plugin 面板出现「kael-odin-plugins-zh」'],
    copy: '复制',
    copied: '已复制 ✓',
    snapshot: '数据快照',
    originNote: '来源',
    footerLegal: '上游 anthropics/claude-plugins-official 以 Apache-2.0 发布；插件内容与商标归 Anthropic 及各自权利人所有，中文译文仅供参考，与英文原文冲突时以英文原文为准。',
    close: '关闭详情',
    catAll: '全部分类',
    sortDefault: '推荐排序',
  },
  en: {
    title: 'Claude Code Official Plugins · Chinese Marketplace',
    subtitle: (n, z) => `${n} official plugins · ${z}/${n} Chinese descriptions · lossless · daily updates`,
    searchPh: 'e.g. code review, database, figma, security, PDF …',
    clear: 'Clear',
    cats: 'Categories',
    all: 'All',
    quick: { all: 'All', inrepo: 'In-repo', git: 'git ref', url: 'URL ref' },
    summary: (n, y, z) => `Showing ${n} of ${y} plugins · ${z}/${y} Chinese descriptions · synced daily`,
    intro: 'Intro',
    enOriginal: 'English original',
    links: 'Links',
    website: 'Open official website ↗',
    repoLink: 'Open source repository ↗',
    inrepo: 'In-repo',
    git: 'git ref',
    url: 'URL ref',
    installTitle: 'Add the Chinese marketplace to Claude Code',
    installSteps: ['Type /plugin marketplace add in a Claude Code session', 'Use the repo below (or claude plugin marketplace add in a terminal)', 'The /plugin panel shows “kael-odin-plugins-zh”'],
    copy: 'Copy',
    copied: 'Copied ✓',
    snapshot: 'Snapshot',
    originNote: 'Source',
    footerLegal: 'Upstream anthropics/claude-plugins-official is Apache-2.0; plugin content and trademarks belong to Anthropic and their respective owners. Translations are informational.',
    close: 'Close details',
    catAll: 'All categories',
    sortDefault: 'Recommended',
  },
};

const state = { q: '', cat: null, quick: 'all', sort: 'default', lang: 'zh', theme: 'light', selected: null };
let CATALOG = null;
let ITEMS = [];

const $ = (s) => document.querySelector(s);
const t = () => I18N[state.lang];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => (s ?? '').toLowerCase();
const fmt = (n) => n.toLocaleString('en-US');

function colorFor(key) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 45%)`;
}

function buildItems() {
  ITEMS = CATALOG.plugins.map((p) => ({
    type: p.kind,
    key: p.name,
    icon: p.icon ?? null,
    color: colorFor(p.name),
    initial: p.name[0].toUpperCase(),
    zh: p.name,
    en: p.categoryZh ?? '',
    desc: p.descriptionZh || p.descriptionEn || '',
    long: p.descriptionZh || p.descriptionEn || '',
    longEn: p.descriptionEn,
    category: p.categoryZh || t().all,
    badges: [
      { text: t().quick[p.kind] ?? p.kind, cls: 'kind' },
      ...(p.categoryZh ? [{ text: p.categoryZh, cls: '' }] : []),
    ],
    search: [p.name, p.descriptionZh, p.descriptionEn, p.categoryZh, p.author, p.repo],
    raw: p,
  }));
}

function match(it) {
  if (state.quick !== 'all' && it.type !== state.quick) return false;
  if (state.cat && it.category !== state.cat) return false;
  if (!state.q) return true;
  const q = norm(state.q);
  return it.search.some((v) => norm(v).includes(q));
}

function sorted(list) {
  const byName = (a, b) => a.zh.localeCompare(b.zh, 'zh-Hans-CN');
  if (state.sort === 'az') return [...list].sort(byName);
  if (state.sort === 'za') return [...list].sort((a, b) => byName(b, a));
  return list;
}

function iconHTML(it, size) {
  const s = `style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;background:${esc(it.color)}"`;
  if (it.icon) {
    return `<img class="icon" loading="lazy" src="${esc(it.icon)}" alt="${esc(it.zh)}" ${s}
      onerror="this.classList.add('hide');this.nextElementSibling.classList.remove('hide')">
      <div class="tile hide" ${s}>${esc(it.initial)}</div>`;
  }
  return `<div class="tile" ${s}>${esc(it.initial)}</div>`;
}

function renderRail() {
  const T = t();
  const counts = new Map();
  for (const it of ITEMS) {
    if (state.quick !== 'all' && it.type !== state.quick) continue;
    counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  }
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = [...counts.values()].reduce((x, y) => x + y, 0);
  $('#rail').innerHTML = [{ key: null, label: T.all, count: total }]
    .concat(cats.map(([label, count]) => ({ key: label, label, count })))
    .map((c) => `<button class="side-btn ${state.cat === c.key ? 'active' : ''}" data-cat="${esc(c.key ?? '')}">
        <span>${esc(c.label)}</span><span>${fmt(c.count)}</span></button>`)
    .join('');
  $('#rail').querySelectorAll('.side-btn').forEach((el) =>
    el.addEventListener('click', () => {
      state.cat = el.dataset.cat || null;
      renderAll();
    }),
  );
  const sel = $('#f-cat');
  sel.innerHTML = `<option value="">${esc(t().catAll)}</option>` +
    cats.map(([label, count]) => `<option value="${esc(label)}"${label === state.cat ? ' selected' : ''}>${esc(label)} (${count})</option>`).join('');
}

function renderPills() {
  const T = t();
  const defs = [
    ['all', `${T.quick.all} ${fmt(ITEMS.length)}`],
    ['in-repo', `${T.quick.inrepo} ${fmt(ITEMS.filter((i) => i.type === 'in-repo').length)}`],
    ['git-subdir', `${T.quick.git} ${fmt(ITEMS.filter((i) => i.type === 'git-subdir').length)}`],
    ['url', `${T.quick.url} ${fmt(ITEMS.filter((i) => i.type === 'url').length)}`],
  ];
  $('#pills').innerHTML = defs
    .map(([k, label]) => `<button class="quick-btn ${state.quick === k ? 'active' : ''}" data-k="${k}">${esc(label)}</button>`)
    .join('');
  $('#pills').querySelectorAll('.quick-btn').forEach((el) =>
    el.addEventListener('click', () => {
      state.quick = el.dataset.k;
      state.cat = null;
      renderAll();
    }),
  );
}

function renderGrid() {
  const list = sorted(ITEMS.filter(match));
  $('#grid').innerHTML = list
    .map(
      (it) => `<div class="card ${state.selected === it.key ? 'selected' : ''}" data-key="${esc(it.key)}" role="button" tabindex="0">
        ${iconHTML(it)}
        <h3>${esc(it.zh)}</h3>
        <div class="en">${esc(it.raw.categoryZh ?? '')}</div>
        <p class="desc">${esc(it.desc)}</p>
        <div class="badges">${it.badges.map((b) => `<span class="badge ${b.cls || ''}">${esc(b.text)}</span>`).join('')}</div>
      </div>`,
    )
    .join('');
  $('#grid').querySelectorAll('.card').forEach((el) => {
    const open = () => openDetail(el.dataset.key);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
  $('#count').textContent = t().summary(fmt(list.length), fmt(ITEMS.length), fmt(CATALOG.zhDescriptions));
}

function installHTML() {
  const T = t();
  return `<div class="block">
    <strong>${esc(T.installTitle)}</strong>
    <div class="install">
      <ol>${T.installSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <button class="copybtn" data-copy>/plugin marketplace add ${MARKET_REPO}</button>
      <button class="copybtn" data-copy-url>${esc(MARKET_URL)}</button>
    </div>
  </div>`;
}

function detailHTML(it) {
  const T = t();
  const p = it.raw;
  return `<div style="display:flex;gap:16px;align-items:flex-start">
      ${iconHTML(it, 80)}
      <div style="min-width:0">
        <h2>${esc(p.name)}</h2>
        <div class="detail-en">${esc(p.author ?? '')}${p.author && p.categoryZh ? ' · ' : ''}${esc(p.categoryZh ?? '')}</div>
      </div>
    </div>
    <div class="badges" style="margin-top:12px">${it.badges.map((b) => `<span class="badge ${b.cls || ''}">${esc(b.text)}</span>`).join('')}</div>
    <div class="block"><strong>${esc(T.intro)}</strong><div class="detail-desc">${esc(it.long)}</div>
      ${p.descriptionEn ? `<details><summary style="cursor:pointer;font-size:13px">${esc(T.enOriginal)}</summary><div class="original detail-desc">${esc(p.descriptionEn)}</div></details>` : ''}</div>
    <div class="block"><strong>${esc(T.links)}</strong>
      ${p.homepage ? `<a class="link" href="${esc(p.homepage)}" target="_blank" rel="noopener">${esc(T.website)}</a>` : ''}
      ${p.repo ? `<p><a href="https://github.com/${esc(p.repo)}" target="_blank" rel="noopener">${esc(T.repoLink)}</a></p>` : ''}
      <button class="copybtn" data-copy>/plugin marketplace add ${MARKET_REPO}</button>
      <button class="copybtn" data-copy-url>${esc(MARKET_URL)}</button>
    </div>`;
}

function renderPane() {
  const it = ITEMS.find((x) => state.selected === x.key);
  $('#detailpane').innerHTML = `
    <button class="detail-close" id="dclose">${esc(t().close)}</button>
    ${it ? detailHTML(it) : installHTML()}`;
  bindCopy($('#detailpane'));
}

function openDetail(key) {
  state.selected = key;
  renderGrid();
  renderPane();
  if (!window.matchMedia('(min-width: 1121px)').matches) {
    document.body.classList.add('detail-open');
  }
}

function closeDrawer() {
  document.body.classList.remove('detail-open');
}

function bindCopy(root) {
  root.querySelectorAll('.copybtn').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copyUrl !== undefined ? MARKET_URL : `/plugin marketplace add ${MARKET_REPO}`;
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = t().copied;
      setTimeout(() => (btn.textContent = old), 1600);
    }),
  );
}

function applyI18nStatic() {
  const T = t();
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = T[el.dataset.i18n];
    if (typeof v === 'string') el.textContent = v;
  }
  // Tagline and title state counts, so they are derived from the catalog rather
  // than hard-coded: a sync that brings an untranslated plugin still tells the
  // truth instead of claiming full coverage until the next local translate pass.
  const sub = document.querySelector('[data-i18n="subtitle"]');
  if (sub) sub.textContent = T.subtitle(fmt(CATALOG.total), fmt(CATALOG.zhDescriptions));
  $('#q').placeholder = T.searchPh;
  $('#lang').textContent = state.lang === 'zh' ? 'English' : '中文';
  document.title = state.lang === 'zh'
    ? `Claude Code 官方插件中文市场 · ${fmt(CATALOG.total)} 插件导航`
    : `Claude Code Official Plugins, in Chinese · ${fmt(CATALOG.total)} Plugins`;
  const sort = $('#f-sort');
  sort.options[0].text = T.sortDefault;
}

function renderAll() {
  buildItems();
  applyI18nStatic();
  renderRail();
  renderPills();
  renderGrid();
  renderPane();
}

async function init() {
  CATALOG = await (await fetch('./catalog.json')).json();
  state.theme = localStorage.getItem('cpz-theme') ?? 'light';
  state.lang = localStorage.getItem('cpz-lang') ?? 'zh';
  document.documentElement.dataset.theme = state.theme;
  $('#theme').textContent = state.theme === 'light' ? '🌙' : '☀️';
  $('#meta').textContent = new Date(CATALOG.generatedAt).toLocaleDateString(state.lang === 'zh' ? 'zh-CN' : 'en-US');

  $('#q').addEventListener('input', (e) => { state.q = e.target.value.trim(); renderGrid(); });
  $('#clear').addEventListener('click', () => {
    state.q = ''; state.cat = null; state.sort = 'default'; state.quick = 'all';
    $('#q').value = '';
    renderAll();
  });
  $('#f-cat').addEventListener('change', (e) => { state.cat = e.target.value || null; renderAll(); });
  $('#f-sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
  $('#lang').addEventListener('click', () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('cpz-lang', state.lang);
    renderAll();
  });
  $('#theme').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('cpz-theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    $('#theme').textContent = state.theme === 'light' ? '🌙' : '☀️';
  });
  $('#backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  renderAll();
}
init();
