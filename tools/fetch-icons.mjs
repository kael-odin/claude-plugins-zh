// Prefetch icons for the claude catalog into site/appicons/ (committed).
//
// Sources, in order — first hit wins:
//   1. GitHub owner avatar — https://github.com/<owner>.png, taken from the
//      entry's homepage or source URL.
//      NOT avatars.githubusercontent.com/<login>?size=128: that endpoint serves
//      GitHub's default grey Octocat for EVERY login, so the old code "found" an
//      icon for all 240 plugins that had any GitHub URL and never fell through.
//   2. Homepage favicon — Google s2 (sz=128), then DuckDuckGo.
//   3. Brand mark — simple-icons (MIT) for plugins that ship no homepage/URL of
//      their own (the in-repo LSP servers and messaging bridges), drawn on a
//      white tile so the glyph stays visible in either theme.
//
// A placeholder result counts as a miss: the next source is tried, and a stale
// placeholder file on disk is deleted rather than kept. Whatever still misses
// falls back to the site's coloured monogram tile.
//   node tools/fetch-icons.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, UPSTREAM_DIR, DATA_DIR, readJson } from './lib.mjs';

const force = process.argv.includes('--force');
const outDir = path.join(ROOT, 'site', 'appicons');
fs.mkdirSync(outDir, { recursive: true });

const EXTS = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'ico'];

// GitHub's default avatar. Anything matching this is treated as "no icon".
const PLACEHOLDERS = new Set(['e36eb9f6a1474a99c1b2e259fa6cb2538d86f2b8']);
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

// Brand marks for the plugins with no remote homepage/URL to pull from:
// simple-icons slug (MIT) + that brand's own colour.
const BRAND = {
  'clangd-lsp': ['cplusplus', '00599C'],
  'csharp-lsp': ['csharp', '512BD4'],
  'gopls-lsp': ['go', '00ADD8'],
  'jdtls-lsp': ['java', '007396'],
  'kotlin-lsp': ['kotlin', '7F52FF'],
  'lua-lsp': ['lua', '2C2D72'],
  'php-lsp': ['php', '777BB4'],
  'pyright-lsp': ['python', '3776AB'],
  'ruby-lsp': ['ruby', 'CC342D'],
  'rust-analyzer-lsp': ['rust', '000000'],
  'swift-lsp': ['swift', 'F05138'],
  'typescript-lsp': ['typescript', '3178C6'],
  discord: ['discord', '5865F2'],
  telegram: ['telegram', '26A5E4'],
  imessage: ['imessage', '34DA50'],
};

const mf = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, '.claude-plugin', 'marketplace.json'), 'utf8'));

function hostOf(u) {
  try { return new URL(u).host.replace(/^www\./, ''); } catch { return null; }
}
function ghOwner(u) {
  const m = String(u ?? '').match(/github\.com\/([^/]+)/i);
  return m ? m[1] : null;
}
// In-repo plugins (source "./plugins/…" / "./external_plugins/…") belong to the
// upstream repo, so its owner is the honest mark for one that names no homepage
// of its own — the bundled LSP servers and bridges all carry it.
const upstreamOwner = ghOwner(readJson(path.join(ROOT, 'config', 'zh-marketplace.json'))?.upstreamRepo);
function existingFor(name) {
  const hit = EXTS.map((e) => path.join(outDir, `${name}.${e}`)).find(fs.existsSync);
  return hit ?? null;
}
function clearIcons(name, keep) {
  for (const e of EXTS) {
    const p = path.join(outDir, `${name}.${e}`);
    if (p !== keep && fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
}

async function fetchBin(url, timeoutMs = 15000, minBytes = 200) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'claude-plugins-zh-icon-fetcher' },
  });
  if (!res.ok) throw new Error(String(res.status));
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) throw new Error('too small');
  return buf;
}

const domainCache = new Map(); // host -> Buffer|null
async function faviconFor(host) {
  if (domainCache.has(host)) return domainCache.get(host);
  let buf = null;
  try {
    buf = await fetchBin(`https://www.google.com/s2/favicons?sz=128&domain=${host}`);
  } catch {
    try {
      buf = await fetchBin(`https://icons.duckduckgo.com/ip3/${host}.ico`);
    } catch { buf = null; }
  }
  if (buf && PLACEHOLDERS.has(sha1(buf))) buf = null;
  domainCache.set(host, buf);
  return buf;
}

// simple-icons ships a bare 24x24 glyph; put it on a white rounded tile and
// inset it slightly so it reads as an app icon in both light and dark themes.
// (The glyphs are tiny — Kotlin's is 130 bytes — so the size floor is lowered.)
async function brandFor(name) {
  const spec = BRAND[name];
  if (!spec) return null;
  const [slug, hex] = spec;
  const svg = (await fetchBin(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`, 20000, 60)).toString('utf8');
  const d = svg.match(/\sd="([^"]+)"/)?.[1];
  if (!d) return null;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${slug}">` +
      `<rect width="24" height="24" rx="5" fill="#fff"/>` +
      `<g transform="translate(3.2 3.2) scale(0.7333)"><path d="${d}" fill="#${hex}"/></g></svg>`,
    'utf8',
  );
}

function extOf(buf) {
  if (buf.subarray(0, 4).toString('hex') === '89504e47') return 'png';
  if (buf.subarray(0, 3).toString() === '<sv') return 'svg';
  if (buf.subarray(0, 2).toString() === 'II' || buf.subarray(0, 2).toString() === 'MM') return 'ico';
  if (buf.subarray(0, 3).toString() === 'GIF') return 'gif';
  return 'png';
}

const sources = {};
let ok = 0;
let miss = 0;
let reused = 0;
const queue = [...mf.plugins];
const workers = Array.from({ length: 10 }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    const name = entry.name;
    const existing = existingFor(name);
    if (existing && !force) {
      // A committed placeholder is not a result — retry it even without --force.
      if (!PLACEHOLDERS.has(sha1(fs.readFileSync(existing)))) {
        ok++;
        reused++;
        sources[name] = { via: 'cached', bytes: fs.statSync(existing).size };
        continue;
      }
    }

    let buf = null;
    let via = null;
    const inRepo = typeof entry.source === 'string';
    const owner = ghOwner(entry.homepage) ?? ghOwner(entry.source?.url) ?? (inRepo ? upstreamOwner : null);
    if (owner) {
      try {
        const b = await fetchBin(`https://github.com/${encodeURIComponent(owner)}.png?size=128`);
        if (!PLACEHOLDERS.has(sha1(b))) { buf = b; via = `gh:${owner}`; }
      } catch {}
    }
    if (!buf) {
      const host = hostOf(entry.homepage ?? '') ?? hostOf(entry.source?.url ?? '');
      if (host) {
        const f = await faviconFor(host);
        if (f) { buf = f; via = `favicon:${host}`; }
      }
    }
    if (!buf) {
      try {
        const b = await brandFor(name);
        if (b) { buf = b; via = `brand:${BRAND[name][0]}`; }
      } catch {}
    }

    if (buf) {
      const ext = via.startsWith('brand:') ? 'svg' : extOf(buf);
      const dest = path.join(outDir, `${name}.${ext}`);
      clearIcons(name, dest);
      fs.writeFileSync(dest, buf);
      sources[name] = { via, bytes: buf.length };
      ok++;
    } else {
      clearIcons(name); // drop a stale placeholder so the monogram takes over
      sources[name] = { via: null };
      miss++;
    }
  }
});
await Promise.all(workers);

// Upstream renames (marketplace.renames) leave the old name's icon on disk under
// a name no plugin has any more. Carry it over when the new name has nothing,
// otherwise drop the leftover — a rename should not cost a plugin its icon.
const renames = mf.renames ?? {};
let carried = 0;
for (const [oldName, newName] of Object.entries(renames)) {
  const src = existingFor(oldName);
  if (!src) continue;
  if (!existingFor(newName)) {
    const dest = path.join(outDir, `${newName}${path.extname(src)}`);
    fs.renameSync(src, dest);
    sources[newName] = { via: `renamed:${oldName}`, bytes: fs.statSync(dest).size };
    carried++;
  } else {
    fs.rmSync(src, { force: true });
  }
}

const byVia = {};
for (const v of Object.values(sources)) {
  const k = v.via ? v.via.split(':')[0] : 'miss';
  byVia[k] = (byVia[k] ?? 0) + 1;
}
fs.writeFileSync(path.join(DATA_DIR, 'icon-sources.json'), JSON.stringify(sources, null, 0) + '\n', 'utf8');
console.log(`[fetch-icons] ok: ${ok} (${reused} already on disk), miss: ${miss} -> site/appicons/`);
console.log(`[fetch-icons] by source: ${JSON.stringify(byVia)}`);
