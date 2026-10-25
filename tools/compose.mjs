// Compose the publish tree (repo root) for claude-plugins-zh.
//
// Upstream: anthropics/claude-plugins-official (Apache-2.0) — 315-entry
// marketplace manifest; 53 plugins live in-repo (plugins/ + external_plugins/),
// 262 are remote references (git-subdir / url) kept verbatim.
// Intentional divergence (whitelist):
//   - .claude-plugin/marketplace.json → name/description + entry description/category
//   - **/.claude-plugin/plugin.json    → description only
// Plus one generated, owned file with no upstream counterpart:
//   - .agents/plugins/marketplace.json → Codex-native marketplace (same catalog)
// Everything else stays byte-identical to upstream (tools/verify.mjs enforces).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ROOT, UPSTREAM_DIR, DATA_DIR, I18N_DIR,
  readJson, writeJson, textKey, git, toPosix, sourceDate,
} from './lib.mjs';

const cfg = readJson(path.join(ROOT, 'config', 'zh-marketplace.json'));
const glossary = readJson(path.join(ROOT, 'config', 'glossary.json'), {});
const diff = readJson(path.join(DATA_DIR, 'diff.json'));
const mapCat = (c) => (c ? glossary[c] ?? c : '其他');

// The Claude/ZCode entry `category` is a machine key rendered by the client,
// not prose: ZCode's plugin store localizes only a fixed enum set
// (developer-tools/productivity/finance/legal/template/utilities/other), and
// everything else falls back to raw display. Emit the enum value where the
// zh category has a natural counterpart; keep the zh label for buckets the
// enum has no answer for (设计创作/数据分析/…), which still renders (raw)
// and stays searchable. The zh label itself lives on in the Codex manifest,
// the in-repo plugin manifests, and data/catalog.json.
const zcodeCategory = cfg.zcodeCategory ?? {};
const mapStoreCat = (zh) => zcodeCategory[zh] ?? zh;

// Marketplace icon URLs. ZCode injects CDN icons only into its own official
// marketplaces; third-party entries get none unless the manifest carries an
// absolute `icon` itself (verified against applyClaudePluginIcons upstream:
// a non-empty entry icon is always kept). site/appicons is committed and
// published by the Pages deploy, so it is a stable base.
const ICON_EXTS = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'ico'];
const iconsDir = path.join(ROOT, 'site', 'appicons');
const iconRel = (name) => {
  const hit = ICON_EXTS.map((e) => path.join(iconsDir, `${name}.${e}`)).find(fs.existsSync);
  return hit ? `appicons/${name}${path.extname(hit)}` : null;
};
const iconUrl = (name) => {
  const rel = iconRel(name);
  return rel ? `${cfg.siteUrl}${rel}` : null;
};

// Codex renders interface.shortDescription as the card subtitle and
// interface.longDescription on the details page, but the ledger holds one zh
// string per plugin. The subtitle is therefore the description's first natural
// clause (Chinese punctuation-aware, ≤56 chars), and the full text stays as the
// long description; never invent text that is not in the translation.
function subtitle(desc) {
  const s = (desc ?? '').trim();
  if (!s) return '';
  let out = '';
  for (const part of s.split(/(?<=[。！？；])|(?<=——)|(?<=，)/)) {
    if (out && out.length + part.length > 56) break;
    out += part;
    if (/[。！？]$/.test(out)) break;
  }
  out = (out || s).replace(/[，、；：—]+$/, '').trim();
  return out.length > 56 ? `${out.slice(0, 54)}…` : out;
}

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
// Upstream's `owner` names Anthropic (support@anthropic.com); this mirror is
// published by this repo, so carrying that field over would misattribute the
// marketplace in Claude Code's UI. Same reasoning as the `name` override above.
if (cfg.owner) mf.owner = cfg.owner;
let zhDesc = 0;
const zhCatByName = new Map();
for (const entry of mf.plugins) {
  const side = readJson(path.join(I18N_DIR, `${entry.name}.json`), null);
  const hit = side?.[textKey(entry.description ?? '')]?.zh;
  if (hit) { entry.description = hit; zhDesc++; }
  zhCatByName.set(entry.name, mapCat(entry.category));
  entry.category = mapStoreCat(zhCatByName.get(entry.name));
  const icon = iconUrl(entry.name);
  if (icon) entry.icon = icon;
}
writeJson(mfPath, mf);
console.log(
  `[compose] manifest: ${mf.plugins.length} entries, ${zhDesc} zh descriptions, ` +
    `${mf.plugins.filter((e) => e.icon).length} icons`,
);

// 4) in-repo plugin manifests — description only (whitelist field)
const PLUGIN_ROOTS = ['plugins', 'external_plugins'];
let applied = 0;
let checked = 0;
let ifaces = 0;
const entryByName = new Map(mf.plugins.map((e) => [e.name, e]));
for (const root of PLUGIN_ROOTS) {
  const rdir = path.join(ROOT, root);
  if (!fs.existsSync(rdir)) continue;
  for (const name of fs.readdirSync(rdir)) {
    const mf2 = path.join(rdir, name, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(mf2)) continue;
    checked++;
    const side = readJson(path.join(I18N_DIR, `${name}.json`), null);
    const m = JSON.parse(fs.readFileSync(mf2, 'utf8'));
    if (typeof m.description !== 'string') continue;
    const hit = side?.[textKey(m.description)]?.zh;
    if (hit) { m.description = hit; applied++; }
    // Codex renders interface.shortDescription (card subtitle) and
    // interface.longDescription (details page) from the plugin manifest, and
    // reads interface.category; Claude Code ignores the key at load time
    // ("Unknown field 'interface'" is a validation warning only). Same zh text
    // as the marketplace entry, so tools/verify.mjs can drift-check the files
    // against each other. Upstream interface keys, if any, are preserved.
    if (m.description.trim() && entryByName.has(name)) {
      const cat = zhCatByName.get(name);
      m.interface = {
        ...(m.interface ?? {}),
        shortDescription: subtitle(m.description),
        longDescription: m.description,
        ...(cat ? { category: cat } : {}),
      };
      ifaces++;
    }
    if (hit || m.interface) writeJson(mf2, m);
  }
}
console.log(
  `[compose] in-repo plugin manifests: ${checked} checked, ${applied} zh descriptions applied, ` +
    `${ifaces} codex interfaces written`,
);

// 4b) Codex-native marketplace (generated, owned — no upstream counterpart).
//
// Claude Code reads .claude-plugin/marketplace.json; Codex only reads that file
// as a compatibility fallback, and there the per-entry `description` is not a
// field it models (its entry schema is name/source/policy/category + an
// `interface` block — see core-plugins/src/marketplace.rs upstream). So the
// Chinese text has to be repeated in the shape Codex renders, in a file only
// Codex reads, leaving the Claude manifest untouched.
const codex = {
  name: mcfg.name,
  interface: { displayName: cfg.codex?.displayName ?? mcfg.name },
  plugins: mf.plugins.map((e) => ({
    name: e.name,
    source: e.source,
    policy: cfg.codex?.policy ?? { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: zhCatByName.get(e.name),
    interface: {
      shortDescription: subtitle(e.description),
      longDescription: e.description,
      category: zhCatByName.get(e.name),
    },
  })),
};
writeJson(path.join(ROOT, '.agents', 'plugins', 'marketplace.json'), codex);
console.log(`[compose] codex manifest: ${codex.plugins.length} entries -> .agents/plugins/marketplace.json`);

// 5) data/catalog.json (site-ready, EN from upstream / zh from ledger)
const catalog = mf.plugins.map((entry) => {
  const src = entry.source;
  const kind = typeof src === 'string' ? 'in-repo' : (src?.source ?? 'remote');
  const upEntry = upMf.plugins.find((x) => x.name === entry.name);
  return {
    name: entry.name,
    category: upEntry?.category ?? null,
    categoryZh: zhCatByName.get(entry.name),
    descriptionZh: entry.description,
    descriptionEn: upEntry?.description ?? null,
    author: entry.author?.name ?? null,
    homepage: entry.homepage ?? null,
    kind,
    repo: typeof src === 'object' ? (src.repo ?? null) : null,
    icon: iconRel(entry.name),
  };
});
writeJson(path.join(DATA_DIR, 'catalog.json'), {
  generatedAt: sourceDate(UPSTREAM_DIR),
  upstream: { repo: cfg.upstreamRepo, sha: git(UPSTREAM_DIR, 'rev-parse', 'HEAD'), license: cfg.license },
  marketplace: mcfg,
  total: catalog.length,
  zhDescriptions: zhDesc,
  byKind: catalog.reduce((acc, p) => { acc[p.kind] = (acc[p.kind] ?? 0) + 1; return acc; }, {}),
  plugins: catalog,
});
// syncedAt stays put while the upstream sha is unchanged, so a no-op sync
// rewrites this file byte-identically and the CI step commits nothing.
const prevSha = readJson(path.join(DATA_DIR, 'last-sha.json'), null);
writeJson(path.join(DATA_DIR, 'last-sha.json'), {
  sha: diff.to,
  syncedAt: prevSha?.sha === diff.to && prevSha.syncedAt ? prevSha.syncedAt : sourceDate(UPSTREAM_DIR),
});
console.log(`[compose] catalog: ${catalog.length} plugins -> data/catalog.json`);
