// Lossless verifier for claude-plugins-zh.
//   .claude-plugin/marketplace.json — owned: name/description free; per entry
//     description/category free, everything else strict vs upstream
//   **/.claude-plugin/plugin.json — description only free, rest strict
//   everything else byte-identical to .upstream
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

for (const rel of union) {
  const p = pub.get(rel);
  const s = src.get(rel);
  if (!p) { divergences.push({ rel, kind: 'missing-in-publish' }); continue; }
  if (!s) { divergences.push({ rel, kind: 'extra-not-in-upstream' }); continue; }
  if (rel === MANIFEST) {
    whitelisted++;
    const ours = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (typeof ours.name !== 'string' || typeof ours.description !== 'string') {
      divergences.push({ rel, kind: 'manifest-missing-zh-identity' });
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
    const stripDesc = (f) => {
      const m = JSON.parse(fs.readFileSync(f, 'utf8'));
      delete m.description;
      return m;
    };
    if (!sameJson(stripDesc(p), stripDesc(s))) divergences.push({ rel, kind: 'changed-outside-whitelist' });
  } else if (fs.readFileSync(p).equals(fs.readFileSync(s))) {
    byteIdentical++;
  } else {
    divergences.push({ rel, kind: 'content-diff' });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  upstreamSha: git(UPSTREAM_DIR, 'rev-parse', 'HEAD'),
  filesChecked: union.length,
  byteIdentical,
  whitelistedChecked: whitelisted,
  divergences,
  status: divergences.length ? 'fail' : 'pass',
};
writeJson(path.join(DATA_DIR, 'quality-report.json'), report);
console.log(
  `[verify] ${report.status.toUpperCase()} — ${union.length} files, ${byteIdentical} byte-identical, ` +
    `${whitelisted} whitelisted, ${divergences.length} divergences`,
);
for (const d of divergences.slice(0, 30)) console.log(`  - ${d.kind}: ${d.rel}${d.extra ? ` (${d.extra})` : ''}`);
if (divergences.length) process.exit(1);
