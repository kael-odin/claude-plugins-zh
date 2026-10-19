// Build the static site into dist/ (site assets + data/catalog.json).
//
// Also emits the SEO surface: JSON-LD structured data injected into the shell
// (the catalog is JS-rendered, so the ItemList is what makes the 315 entries
// machine-readable), plus sitemap.xml and a robots.txt that points at it.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR } from './lib.mjs';

const SITE_URL = 'https://kael-odin.github.io/claude-plugins-zh/';
const UPSTREAM_URL = 'https://github.com/anthropics/claude-plugins-official';

const dist = path.join(ROOT, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), '', 'utf8');
fs.writeFileSync(path.join(dist, '404.html'), '<!doctype html><meta charset="utf-8"><title>404</title><script>location.replace("./")</' + 'script>', 'utf8');

const catalog = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'catalog.json'), 'utf8'));
const lastmod = String(catalog.generatedAt ?? '').slice(0, 10);
const total = catalog.total;

const cut = (s, n = 200) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// A plugin's own page, when it has one — anchoring into a JS-rendered SPA is
// not a URL a crawler can dereference, so an in-page fragment is the fallback.
const itemUrl = (p) => p.homepage ?? (p.repo ? `https://github.com/${p.repo}` : `${SITE_URL}#${p.name}`);

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'Claude Code 官方插件中文版',
      alternateName: 'kael-odin-plugins-zh',
      description:
        `Claude Code 官方插件目录（anthropics/claude-plugins-official）的中文版：${total} 个插件的介绍与分类已汉化，插件源码与官方逐字节一致。`,
      inLanguage: 'zh-CN',
      isBasedOn: UPSTREAM_URL,
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
    },
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}#catalog`,
      url: SITE_URL,
      name: `Claude Code 官方插件中文版 · ${total} 个插件`,
      description:
        '可搜索的中文插件导航：分类侧栏、真实图标、中英双语详情，数据每日自动跟随上游更新。',
      inLanguage: 'zh-CN',
      isPartOf: { '@id': `${SITE_URL}#website` },
      dateModified: catalog.generatedAt,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: total,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: catalog.plugins.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.name,
          description: cut(p.descriptionZh || p.descriptionEn),
          url: itemUrl(p),
        })),
      },
    },
  ],
};

// The shell states counts in crawlable prose (title, meta, the about block).
// Substitute them at build time so the static text stays true after a sync
// instead of drifting from the catalog the JS renders next to it.
const reportPath = path.join(DATA_DIR, 'quality-report.json');
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
const verifyNote =
  report?.status === 'pass'
    ? `（${report.filesChecked} 个文件中 ${report.byteIdentical} 个逐字节相同，余下 ${report.whitelistedChecked} 个仅白名单字段为中文）`
    : '（逐文件机器对账，除白名单字段外全部逐字节相同）';

const shell = fs
  .readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8')
  .replaceAll('{{TOTAL}}', String(total))
  .replaceAll('{{VERIFY_NOTE}}', verifyNote)
  .replace('<!--JSONLD-->', `<script type="application/ld+json">${JSON.stringify(jsonld)}<\/script>`);
if (/\{\{[A-Z_]+\}\}/.test(shell)) {
  throw new Error(`[build-site] unsubstituted placeholder: ${shell.match(/\{\{[A-Z_]+\}\}/)[0]}`);
}
fs.writeFileSync(path.join(dist, 'index.html'), shell, 'utf8');

for (const f of ['style.css', 'app.js', 'og.png']) {
  fs.copyFileSync(path.join(ROOT, 'site', f), path.join(dist, f));
}
fs.copyFileSync(path.join(DATA_DIR, 'catalog.json'), path.join(dist, 'catalog.json'));

fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <url><loc>${SITE_URL}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n` +
    '</urlset>\n',
  'utf8',
);
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_URL}sitemap.xml`, ''].join('\n'),
  'utf8',
);

if (fs.existsSync(path.join(ROOT, 'site', 'appicons'))) {
  fs.cpSync(path.join(ROOT, 'site', 'appicons'), path.join(dist, 'appicons'), { recursive: true });
}
console.log('[build-site] dist/ ready —', total, 'plugins,', jsonld['@graph'][1].mainEntity.itemListElement.length, 'in JSON-LD');
