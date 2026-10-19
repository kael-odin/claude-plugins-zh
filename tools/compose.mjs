// Compose the publish tree (repo root) for claude-plugins-zh.
//
// Upstream: anthropics/claude-plugins-official (Apache-2.0) — 315-entry
// marketplace manifest; 53 plugins live in-repo (plugins/ + external_plugins/),
// 262 are remote references (git-subdir / url) kept verbatim.
// Intentional divergence (whitelist):
//   - .claude-plugin/marketplace.json → name/description + entry description/category
//   - **/.claude-plugin/plugin.json    → description only
// Everything else stays byte-identical to upstream (tools/verify.mjs enforces).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ROOT, UPSTREAM_DIR, DATA_DIR, I18N_DIR,
  readJson, writeJson, textKey, git, toPosix,
} from './lib.mjs';

const cfg = readJson(path.join(ROOT, 'config', 'zh-marketplace.json'));
const glossary = readJson(path.join(ROOT, 'config', 'glossary.json'), {});
const diff = readJson(path.join(DATA_DIR, 'diff.json'));
const mapCat = (c) => (c ? glossary[c] ?? c : '其他');
const mapCatAlways = (c) => mapCat(c);

// 1) prune what upstream deleted since last sync
for (const rel of diff.files.removed ?? []) {
  const p = path.join(ROOT, rel);
  if (fs.existsSync(p)) fs.rmSync(p, { force: true });
}
for (const name of diff.plugins.removed ?? []) {
  for (const root of ['plugins', 'external_plugins']) {
    fs.rmSync(path.join(ROOT, root, name), { recursive: true, force: true });
  }
}

// 2) materialize upstream subtrees over the publish tree
execFileSync(
  'bash',
  ['-c', `git -C '${toPosix(UPSTREAM_DIR)}' archive HEAD -- .claude-plugin plugins external_plugins LICENSE | tar -x -C '${toPosix(ROOT)}'`],
);
console.log('[compose] materialized .claude-plugin + plugins + external_plugins + LICENSE');

// 3) zh marketplace manifest (owned file)
const mfPath = path.join(ROOT, '.claude-plugin', 'marketplace.json');
const upMf = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, '.claude-plugin', 'marketplace.json'), 'utf8'));
const topSide = readJson(path.join(I18N_DIR, '_marketplace.json'), {});
const mcfg = cfg.marketplace;
const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
mf.name = mcfg.name;
// Publish our own Chinese-marketplace framing (names the mirror, the plugin
// count and the lossless guarantee) rather than a translation of upstream's
// generic one-liner; the ledger translation stays as the fallback for a config
// that ships no description of its own.
mf.description = mcfg.description ?? topSide[textKey(upMf.description)]?.zh;
let zhDesc = 0;
for (const entry of mf.plugins) {
  const side = readJson(path.join(I18N_DIR, `${entry.name}.json`), null);
  const hit = side?.[textKey(entry.description ?? '')]?.zh;
  if (hit) { entry.description = hit; zhDesc++; }
  entry.category = mapCat(entry.category);
}
writeJson(mfPath, mf);
console.log(`[compose] manifest: ${mf.plugins.length} entries, ${zhDesc} zh descriptions`);

// 4) in-repo plugin manifests — description only (whitelist field)
const PLUGIN_ROOTS = ['plugins', 'external_plugins'];
let applied = 0;
let checked = 0;
for (const root of PLUGIN_ROOTS) {
  const rdir = path.join(ROOT, root);
  if (!fs.existsSync(rdir)) continue;
  for (const name of fs.readdirSync(rdir)) {
    const mf2 = path.join(rdir, name, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(mf2)) continue;
    checked++;
    const side = readJson(path.join(I18N_DIR, `${name}.json`), null);
    if (!side) continue;
    const m = JSON.parse(fs.readFileSync(mf2, 'utf8'));
    if (typeof m.description !== 'string') continue;
    const hit = side[textKey(m.description)]?.zh;
    if (hit) { m.description = hit; applied++; writeJson(mf2, m); }
  }
}
console.log(`[compose] in-repo plugin manifests: ${checked} checked, ${applied} zh descriptions applied`);

// 5) data/catalog.json (site-ready, EN from upstream / zh from ledger)
const ICON_EXTS = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'ico'];
const iconsDir = path.join(ROOT, 'site', 'appicons');
const iconFor = (name) => {
  const hit = ICON_EXTS.map((e) => path.join(iconsDir, `${name}.${e}`)).find(fs.existsSync);
  return hit ? `appicons/${name}${path.extname(hit)}` : null;
};
const catalog = mf.plugins.map((entry) => {
  const src = entry.source;
  const kind = typeof src === 'string' ? 'in-repo' : (src?.source ?? 'remote');
  const upEntry = upMf.plugins.find((x) => x.name === entry.name);
  return {
    name: entry.name,
    category: upEntry?.category ?? null,
    categoryZh: entry.category,
    descriptionZh: entry.description,
    descriptionEn: upEntry?.description ?? null,
    author: entry.author?.name ?? null,
    homepage: entry.homepage ?? null,
    kind,
    repo: typeof src === 'object' ? (src.repo ?? null) : null,
    icon: iconFor(entry.name),
  };
});
writeJson(path.join(DATA_DIR, 'catalog.json'), {
  generatedAt: new Date().toISOString(),
  upstream: { repo: cfg.upstreamRepo, sha: git(UPSTREAM_DIR, 'rev-parse', 'HEAD'), license: cfg.license },
  marketplace: mcfg,
  total: catalog.length,
  zhDescriptions: zhDesc,
  byKind: catalog.reduce((acc, p) => { acc[p.kind] = (acc[p.kind] ?? 0) + 1; return acc; }, {}),
  plugins: catalog,
});
writeJson(path.join(DATA_DIR, 'last-sha.json'), { sha: diff.to, syncedAt: new Date().toISOString() });
console.log(`[compose] catalog: ${catalog.length} plugins -> data/catalog.json`);
