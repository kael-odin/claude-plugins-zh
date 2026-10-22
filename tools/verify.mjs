// Lossless verifier for claude-plugins-zh.
//   .claude-plugin/marketplace.json — owned: name/description/owner free; per
//     entry description/category free, everything else strict vs upstream
//   **/.claude-plugin/plugin.json — description + interface display fields
//     free, rest strict
//   everything else byte-identical to .upstream
//   .agents/plugins/marketplace.json — generated owned file, checked against
//     the Claude manifest for drift (it has no upstream counterpart)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UPSTREAM_DIR, DATA_DIR, readJson, writeJson, walkFiles, git } from './lib.mjs';

const MANIFEST = '.claude-plugin/marketplace.json';

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = stable(v[k]);
    return o;
  }
  return v;
}
const sameJson = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

const pub = new Map();
const src = new Map();
for (const sub of ['.claude-plugin', 'plugins', 'external_plugins']) {
  for (const rel of walkFiles(path.join(ROOT, sub), sub)) pub.set(rel, path.join(ROOT, rel));
  for (const rel of walkFiles(path.join(UPSTREAM_DIR, sub), sub)) src.set(rel, path.join(UPSTREAM_DIR, rel));
}
if (fs.existsSync(path.join(ROOT, 'LICENSE'))) pub.set('LICENSE', path.join(ROOT, 'LICENSE'));
if (fs.existsSync(path.join(UPSTREAM_DIR, 'LICENSE'))) src.set('LICENSE', path.join(UPSTREAM_DIR, 'LICENSE'));

const union = [...new Set([...pub.keys(), ...src.keys()])].sort();
const divergences = [];
let byteIdentical = 0;
let whitelisted = 0;

const upEntries = new Map(
  JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, MANIFEST), 'utf8')).plugins.map((x) => [x.name, x]),
);
const stripFree = (e) => {
  const c = { ...e };
  delete c.description;
  delete c.category;
  return c;
};

// Published manifest (zh) — the generated Codex manifest is drift-checked
// against it, so read it once here.
const pubMf = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8'));
const pubEntries = (pubMf.plugins ?? []).map((x) => x.name);

for (const rel of union) {
  const p = pub.get(rel);
  const s = src.get(rel);
  if (!p) { divergences.push({ rel, kind: 'missing-in-publish' }); continue; }
  if (!s) { divergences.push({ rel, kind: 'extra-not-in-upstream' }); continue; }
  if (rel === MANIFEST) {
    whitelisted++;
    const ours = pubMf;
    if (typeof ours.name !== 'string' || typeof ours.description !== 'string') {
      divergences.push({ rel, kind: 'manifest-missing-zh-identity' });
    }
    // `owner` is ours too (upstream names Anthropic; this mirror is not theirs)
    if (typeof ours.owner?.name !== 'string') {
      divergences.push({ rel, kind: 'manifest-missing-owner' });
    }
    for (const entry of ours.plugins ?? []) {
      const up = upEntries.get(entry.name);
      if (!up) { divergences.push({ rel, kind: 'manifest-unknown-entry', extra: entry.name }); continue; }
      if (!sameJson(stripFree(entry), stripFree(up))) {
        divergences.push({ rel, kind: 'manifest-entry-changed-outside-whitelist', extra: entry.name });
      }
    }
    for (const name of upEntries.keys()) {
      if (!(ours.plugins ?? []).some((x) => x.name === name)) {
        divergences.push({ rel, kind: 'manifest-entry-dropped', extra: name });
      }
    }
  } else if (rel.endsWith('/.claude-plugin/plugin.json')) {
    whitelisted++;
    // Free fields: `description` (zh) plus the Codex-facing `interface` display
    // fields we write (Claude Code ignores that key at load time). Everything
    // else, including any upstream interface keys we preserved, stays strict.
    const FREE_IFACE = ['shortDescription', 'longDescription', 'category'];
    const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
    const strip = (f) => {
      const m = load(f);
      delete m.description;
      if (m.interface) {
        for (const k of FREE_IFACE) delete m.interface[k];
        if (!Object.keys(m.interface).length) delete m.interface;
      }
      return m;
    };
    if (!sameJson(strip(p), strip(s))) divergences.push({ rel, kind: 'changed-outside-whitelist' });
    const ours = load(p);
    if (ours.interface) {
      const short = ours.interface.shortDescription ?? '';
      const long = ours.interface.longDescription ?? '';
      if (long !== ours.description) {
        divergences.push({ rel, kind: 'interface-long-description-drift' });
      } else if (!short || !(long.startsWith(short) || short.endsWith('…')) || short.length > 56) {
        divergences.push({ rel, kind: 'interface-short-description-drift' });
      }
    } else if (
      typeof ours.description === 'string' &&
      ours.description.trim() &&
      (pubEntries ?? []).includes(rel.split('/')[1])
    ) {
      divergences.push({ rel, kind: 'interface-missing' });
    }
  } else if (fs.readFileSync(p).equals(fs.readFileSync(s))) {
    byteIdentical++;
  } else {
    divergences.push({ rel, kind: 'content-diff' });
  }
}

// Generated file with no upstream counterpart (Codex-native marketplace). It is
// derived from the Claude manifest, so it must not drift from it: same entries,
// same sources, same zh categories, and the Codex long description must be the
// Claude entry's description verbatim.
const CODEX_MANIFEST = '.agents/plugins/marketplace.json';
let ownedChecked = 0;
const codexPath = path.join(ROOT, CODEX_MANIFEST);
if (!fs.existsSync(codexPath)) {
  divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-file-missing' });
} else {
  ownedChecked++;
  const cx = JSON.parse(fs.readFileSync(codexPath, 'utf8'));
  const cxEntries = new Map((cx.plugins ?? []).map((e) => [e.name, e]));
  if (cx.name !== pubMf.name) divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-name-mismatch' });
  if (!cx.interface?.displayName) divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-missing-display-name' });
  for (const entry of pubMf.plugins ?? []) {
    const c = cxEntries.get(entry.name);
    if (!c) { divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-entry-dropped', extra: entry.name }); continue; }
    if (!sameJson(c.source, entry.source)) divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-source-drift', extra: entry.name });
    if (c.category !== entry.category) divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-category-drift', extra: entry.name });
    if (c.interface?.longDescription !== entry.description) {
      divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-long-description-drift', extra: entry.name });
    }
    const short = c.interface?.shortDescription ?? '';
    if (!short || !(entry.description.startsWith(short) || short.endsWith('…'))) {
      divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-short-description-drift', extra: entry.name });
    } else if (short.length > 56) {
      divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-short-description-too-long', extra: entry.name });
    }
  }
  for (const name of cxEntries.keys()) {
    if (!(pubMf.plugins ?? []).some((x) => x.name === name)) {
      divergences.push({ rel: CODEX_MANIFEST, kind: 'owned-unknown-entry', extra: name });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  upstreamSha: git(UPSTREAM_DIR, 'rev-parse', 'HEAD'),
  filesChecked: union.length,
  byteIdentical,
  whitelistedChecked: whitelisted,
  ownedChecked,
  divergences,
  status: divergences.length ? 'fail' : 'pass',
};
writeJson(path.join(DATA_DIR, 'quality-report.json'), report);
console.log(
  `[verify] ${report.status.toUpperCase()} — ${union.length} files, ${byteIdentical} byte-identical, ` +
    `${whitelisted} whitelisted, ${ownedChecked} owned, ${divergences.length} divergences`,
);
for (const d of divergences.slice(0, 30)) console.log(`  - ${d.kind}: ${d.rel}${d.extra ? ` (${d.extra})` : ''}`);
if (divergences.length) process.exit(1);
