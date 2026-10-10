// Prefetch icons for the claude catalog into site/appicons/ (committed).
// Priority: GitHub org avatar (source/homepage repo) → homepage favicon
// (Google s2). Failures leave the plugin on the monogram fallback.
//   node tools/fetch-icons.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UPSTREAM_DIR, DATA_DIR } from './lib.mjs';

const force = process.argv.includes('--force');
const outDir = path.join(ROOT, 'site', 'appicons');
fs.mkdirSync(outDir, { recursive: true });

const mf = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, '.claude-plugin', 'marketplace.json'), 'utf8'));

function hostOf(u) {
  try { return new URL(u).host.replace(/^www\./, ''); } catch { return null; }
}
function ghOwner(u) {
  const m = String(u ?? '').match(/github\.com\/([^/]+)/i);
  return m ? m[1] : null;
}

async function fetchBin(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'claude-plugins-zh-icon-fetcher' },
  });
  if (!res.ok) throw new Error(String(res.status));
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error('too small');
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
  domainCache.set(host, buf);
  return buf;
}

const sources = {};
let ok = 0;
let miss = 0;
const queue = [...mf.plugins];
const workers = Array.from({ length: 10 }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    const name = entry.name;
    const existing = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'ico'].map((e) => path.join(outDir, `${name}.${e}`)).find(fs.existsSync);
    if (existing && !force) { ok++; continue; }

    let buf = null;
    let ext = 'png';
    let via = null;
    const owner = ghOwner(entry.homepage) ?? ghOwner(entry.source?.url);
    if (owner) {
      try { buf = await fetchBin(`https://avatars.githubusercontent.com/${owner}?size=128`); via = `gh:${owner}`; } catch {}
    }
    if (!buf) {
      const host = hostOf(entry.homepage ?? '') ?? hostOf(entry.source?.url ?? '');
      if (host) {
        const f = await faviconFor(host);
        if (f) { buf = f; via = `favicon:${host}`; }
      }
    }
    if (buf) {
      if (buf.subarray(0, 4).toString('hex') === '89504e47') ext = 'png';
      else if (buf.subarray(0, 3).toString() === '<sv') ext = 'svg';
      else if (buf.subarray(0, 2).toString() === 'II' || buf.subarray(0, 2).toString() === 'MM') ext = 'ico';
      else if (buf.subarray(0, 3).toString() === 'GIF') ext = 'gif';
      fs.writeFileSync(path.join(outDir, `${name}.${ext}`), buf);
      sources[name] = { via, bytes: buf.length };
      ok++;
    } else {
      sources[name] = { via: null };
      miss++;
    }
  }
});
await Promise.all(workers);

writeJson: {
  const p = path.join(DATA_DIR, 'icon-sources.json');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(sources, null, 0) + '\n', 'utf8');
}
console.log(`[fetch-icons] ok: ${ok}, miss: ${miss} -> site/appicons/`);
