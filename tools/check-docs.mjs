// Verify the hand-typed numbers in the docs against the data they describe.
//
// Every count in README.md sits next to a machine-generated dataset, and
// nothing else stops the two from drifting apart: a sync that brings 316
// plugins leaves the docs still promising 315. Each check pins one documented
// number — matched by the words around it, not by position — to a value read
// out of data/. A phrase that no longer matches is a FAILURE as well: rewording
// the docs must not be allowed to quietly retire a check.
//
// Deliberately NOT checked (facts that live in the sister repository, not in
// this one's data/): the "189 插件 + 1,505 应用" line describing codex-plugins-zh.
//
// Run tools/verify.mjs first: data/quality-report.json is what it writes.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, readJson } from './lib.mjs';

const catalog = readJson(path.join(DATA_DIR, 'catalog.json'));
const report = readJson(path.join(DATA_DIR, 'quality-report.json'));
const claudeMarket = readJson(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
const codexMarket = readJson(path.join(ROOT, '.agents', 'plugins', 'marketplace.json'));

// In-repo plugins are the entries whose source is a path into this repo; the
// docs split them by which root they were mirrored into.
const sources = claudeMarket.plugins.map((e) => e.source);
const underRoot = (root) => sources.filter((s) => typeof s === 'string' && s.startsWith(`${root}/`)).length;

const facts = {
  entries: claudeMarket.plugins.length,
  codexEntries: codexMarket.plugins.length,
  zhDescriptions: catalog.zhDescriptions,
  inRepo: catalog.byKind['in-repo'] ?? 0,
  pluginsDir: underRoot('./plugins'),
  externalPluginsDir: underRoot('./external_plugins'),
  gitSubdir: catalog.byKind['git-subdir'] ?? 0,
  url: catalog.byKind.url ?? 0,
  command: catalog.byKind.command ?? 0,
  files: report.filesChecked,
  byteIdentical: report.byteIdentical,
  whitelisted: report.whitelistedChecked,
  owned: report.ownedChecked,
  divergences: report.divergences.length,
};
facts.remote = facts.gitSubdir + facts.url;

// The doc pairs two of its numbers with an addition ("53（39 + 14）",
// "262（98 + 164）"), so the printed parts must add up to the printed total,
// not just each match its own dataset.
const identity = [
  ['entries = in-repo + remote + command', facts.entries, facts.inRepo + facts.remote + facts.command],
  ['in-repo = plugins/ + external_plugins/', facts.inRepo, facts.pluginsDir + facts.externalPluginsDir],
  ['remote = git-subdir + url', facts.remote, facts.gitSubdir + facts.url],
  ['codex manifest mirrors the claude one', facts.codexEntries, facts.entries],
  ['files = byte-identical + whitelisted + divergences', facts.files, facts.byteIdentical + facts.whitelisted + facts.divergences],
];
const failures = [];
for (const [what, got, want] of identity) {
  if (got !== want) failures.push(`data: ${what} — ${got} vs ${want}`);
}

// Upstream invents source shapes (2026-11 added the first `command` entry: a
// local shell command that resolves the plugin path). A kind missing from the
// identity above would only surface as an off-by-N sum, so name it instead.
const KNOWN_KINDS = new Set(['in-repo', 'git-subdir', 'url', 'command']);
const unknownKinds = Object.keys(catalog.byKind).filter((k) => !KNOWN_KINDS.has(k));
if (unknownKinds.length) {
  failures.push(`data: unrecognized source kind(s) ${unknownKinds.join(', ')} — add them to the README table and this file`);
}

// Translation lag is expected, not a broken build: when upstream rewords a
// description its hash key stops matching and the entry falls back to English
// until the next local `translate.mjs --execute` (the API key is IP-whitelisted,
// so CI cannot fill it). The README states coverage as zh/entries, so the only
// hard invariant here is that the ledger never claims more than it has.
const pendingTranslations = facts.entries - facts.zhDescriptions;
if (pendingTranslations < 0) {
  failures.push(`data: more translated descriptions than entries — ${facts.zhDescriptions} vs ${facts.entries}`);
}

// A doc that says one number where the data says another is the bug this file
// exists for; a doc whose phrase vanished is the bug that hides the first one.
const DOCS = [
  ['README.md', [
    [/\*\*([\d,]+) 个插件\*\*，Apache-2\.0/, [facts.entries]],
    [/插件介绍与分类已汉化（中文介绍 \*\*([\d,]+)\/([\d,]+)\*\*/, [facts.zhDescriptions, facts.entries]],
    [/([\d,]+) 个插件的介绍与分类为中文（中文介绍 \*\*([\d,]+)\/([\d,]+)\*\*）/, [facts.zhDescriptions, facts.zhDescriptions, facts.entries]],
    [/([\d,]+) 个条目的副标题与详情页为中文（中文介绍 \*\*([\d,]+)\/([\d,]+)\*\*）/, [facts.zhDescriptions, facts.zhDescriptions, facts.entries]],
    [/\| 插件清单 \| \*\*([\d,]+)\*\* \|/, [facts.entries]],
    [/\| 仓内插件 \| ([\d,]+)（`plugins\/` ([\d,]+) \+ `external_plugins\/` ([\d,]+)） \|/,
      [facts.inRepo, facts.pluginsDir, facts.externalPluginsDir]],
    [/\| 远程引用 \| ([\d,]+)（git-subdir ([\d,]+) · url ([\d,]+)） \|/, [facts.remote, facts.gitSubdir, facts.url]],
    [/\| 本机命令 \| ([\d,]+)（command） \|/, [facts.command]],
    [/([\d,]+) 个文件中，除白名单/, [facts.files]],
    [/\*\*([\d,]+) 个文件与上游逐字节一致\*\*/, [facts.byteIdentical]],
    [/（余下 ([\d,]+) 个即白名单字段所在文件）/, [facts.whitelisted]],
    [/单独按「([\d,]+) 个自有文件」核对/, [facts.owned]],
    [/条目的 `interface`（([\d,]+) 条远程引用）\+ 仓内 plugin\.json 的 `interface`（([\d,]+) 条仓内插件）/,
      [facts.remote, facts.inRepo]],
  ]],
];

const num = (s) => Number(String(s).replace(/,/g, ''));
const fmt = (v) => (v >= 1000 ? v.toLocaleString('en-US') : String(v));

function collectDocFailures() {
  const out = [];
  let ok = 0;
  for (const [file, checks] of DOCS) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [re, want] of checks) {
      const g = new RegExp(re.source, [...new Set(re.flags + 'dg')].join(''));
      const found = [...text.matchAll(g)];
      if (!found.length) {
        out.push(`${file}: no line matches ${re} — the sentence was reworded; update the pattern, don't drop the check`);
        continue;
      }
      for (const m of found) {
        const got = m.slice(1).map((v) => (v == null ? NaN : num(v)));
        if (got.length !== want.length || got.some((v, i) => v !== want[i])) {
          out.push(`${file}: "${m[0].trim()}" says ${got.join('+')}, data says ${want.join('+')}`);
        } else ok++;
      }
    }
  }
  return { failures: out, checked: ok };
}

// Rewrite every captured number that drifted from its dataset. Only the
// numbers move: the sentence around them must still match, so a reworded
// claim is still reported instead of silently retired.
function fixDocNumbers() {
  let fixed = 0;
  for (const [file, checks] of DOCS) {
    const p = path.join(ROOT, file);
    const before = fs.readFileSync(p, 'utf8');
    let text = before;
    for (const [re, want] of checks) {
      const g = new RegExp(re.source, [...new Set(re.flags + 'dg')].join(''));
      const found = [...text.matchAll(g)];
      for (let i = found.length - 1; i >= 0; i--) {
        const m = found[i];
        if (m.length - 1 !== want.length) continue;
        const got = m.slice(1).map((v) => (v == null ? NaN : num(v)));
        if (got.every((v, j) => v === want[j])) continue;
        let rebuilt = '';
        let cursor = m.index;
        for (let gi = 1; gi < m.length; gi++) {
          const [gs, ge] = m.indices[gi];
          rebuilt += text.slice(cursor, gs) + fmt(want[gi - 1]);
          cursor = ge;
        }
        rebuilt += text.slice(cursor, m.index + m[0].length);
        text = text.slice(0, m.index) + rebuilt + text.slice(m.index + m[0].length);
        fixed++;
      }
    }
    if (text !== before) fs.writeFileSync(p, text);
  }
  return fixed;
}

if (process.argv.includes('--fix')) {
  const fixed = fixDocNumbers();
  if (fixed) console.log(`[check-docs] --fix rewrote ${fixed} documented number(s)`);
}

const docResult = collectDocFailures();
failures.push(...docResult.failures);
const checked = docResult.checked;

// The site never hand-types a count: dist/index.html substitutes {{TOTAL}},
// {{ZH_COVERAGE}} and {{VERIFY_NOTE}} (tools/build-site.mjs) and app.js reads
// the datasets. A count written as a literal in either source file is a number
// nothing keeps true, and the checks above cannot see it — they read the README
// only.
//
// Two-digit numbers are exempt on purpose (the pattern needs three digits): the
// counts that matter here are catalog and file sizes, while a two-digit count
// in prose is an external fact that no dataset in this repo can confirm. The
// list below is for phrases that look like a count but say something else.
const EXEMPT = [/个自有文件/];
for (const file of ['site/index.html', 'site/app.js']) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of text.matchAll(/([\d][\d,]{2,}) (个|条|项目|插件|应用|图标|文件|分歧)/g)) {
    if (EXEMPT.some((re) => re.test(m[0]))) continue;
    failures.push(`${file}: hand-typed "${m[0]}" — counts come from {{TOKEN}} (build-site) or the loaded datasets, never from a literal`);
  }
}

if (pendingTranslations > 0) {
  console.log(
    `[check-docs] note: ${pendingTranslations} description(s) awaiting translation ` +
      `(${facts.zhDescriptions}/${facts.entries}) — upstream reworded them; run ` +
      `\`node tools/translate.mjs --execute\` locally to refill`,
  );
}

if (failures.length) {
  console.error(`[check-docs] FAIL — ${failures.length} stale claim(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `[check-docs] PASS — ${checked} documented numbers match the data ` +
    `(${facts.entries} entries, ${facts.files} verified files, 0 divergences)`,
);
