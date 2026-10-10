// Translation ledger manager for claude-plugins-zh.
// Sidecars: i18n/zh/<plugin>.json (manifest entry description + in-repo
// plugin.json description share the plugin's file — identical text dedupes
// by hash), i18n/zh/_marketplace.json (top-level description).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UPSTREAM_DIR, I18N_DIR, readJson, writeJson, textKey, hasCJK } from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

function collect() {
  const entries = [];
  const mf = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, '.claude-plugin', 'marketplace.json'), 'utf8'));
  entries.push({ name: '_marketplace', field: 'description', text: mf.description ?? '' });
  for (const entry of mf.plugins) {
    if (typeof entry.description === 'string' && entry.description.trim()) {
      entries.push({ name: entry.name, field: 'description', text: entry.description });
    }
  }
  for (const root of ['plugins', 'external_plugins']) {
    const rdir = path.join(UPSTREAM_DIR, root);
    if (!fs.existsSync(rdir)) continue;
    for (const name of fs.readdirSync(rdir)) {
      const mf2 = path.join(rdir, name, '.claude-plugin', 'plugin.json');
      if (!fs.existsSync(mf2)) continue;
      try {
        const m = JSON.parse(fs.readFileSync(mf2, 'utf8'));
        if (typeof m.description === 'string' && m.description.trim()) {
          entries.push({ name, field: 'pluginDescription', text: m.description });
        }
      } catch {}
    }
  }
  return entries.filter((e) => e.text);
}

const sidePath = (name) => path.join(I18N_DIR, `${name}.json`);
const loadSide = (name) => readJson(sidePath(name), {});
const saveSide = (name, side) => writeJson(sidePath(name), side);

const entries = collect();
let have = 0;
for (const e of entries) if (loadSide(e.name)[textKey(e.text)]?.zh) have++;
console.log(`[translate] strings: ${entries.length}, translated: ${have}, pending: ${entries.length - have}`);

const seedDir = opt('--seed');
if (seedDir) {
  console.log('[translate] --seed not used for this repo yet');
}

if (flag('--execute')) {
  const key = process.env.GLM_API_KEY;
  if (!key) { console.error('[translate] GLM_API_KEY not set'); process.exit(1); }
  const base = (process.env.GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '');
  const model = process.env.GLM_MODEL ?? 'glm-4.5-flash';
  const batch = Number(process.env.GLM_BATCH ?? 8);
  const pending = entries.filter((e) => !loadSide(e.name)[textKey(e.text)]?.zh);
  console.log(`[translate] API pending: ${pending.length} (model ${model}, batch ${batch})`);
  const SYS =
    '你是 Claude Code 插件市场的本地化译者。把用户给出的 JSON 字符串数组里的每一条英文译成简体中文，' +
    '返回一个等长的 JSON 字符串数组。规则：插件名、品牌名、产品名、命令、路径、URL、代码片段保留英文原文；' +
    '技术术语用中文社区通用译法（如 MCP、skill、hook 保留英文）；语气简洁专业，像官方文档；不要解释，只输出 JSON 数组。';
  for (let i = 0; i < pending.length; i += batch) {
    const chunk = pending.slice(i, i + batch);
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              { role: 'system', content: SYS },
              { role: 'user', content: JSON.stringify(chunk.map((b) => b.text)) },
            ],
          }),
        });
        if (!res.ok) {
          console.error(`[translate] API ${res.status}, attempt ${attempt}`);
        } else {
          const data = await res.json();
          let out = data.choices?.[0]?.message?.content ?? '[]';
          out = out.replace(/```(?:json)?/g, '').trim();
          const arrStart = out.indexOf('[');
          const arrEnd = out.lastIndexOf(']');
          let arr = [];
          if (arrStart >= 0 && arrEnd > arrStart) {
            try { arr = JSON.parse(out.slice(arrStart, arrEnd + 1)); } catch { arr = []; }
          }
          chunk.forEach((b, j) => {
            const zh = arr[j];
            if (typeof zh !== 'string' || !hasCJK(zh)) return;
            const side = loadSide(b.name);
            side[textKey(b.text)] = { zh, field: b.field, source: 'api', verified: true, model };
            saveSide(b.name, side);
          });
          ok = true;
        }
      } catch (e) {
        console.error(`[translate] attempt ${attempt} failed: ${e.message}`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    if (!ok) console.error(`[translate] batch ${Math.floor(i / batch) + 1} skipped after retries`);
    else console.log(`  batch ${Math.floor(i / batch) + 1}/${Math.ceil(pending.length / batch)} done`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!flag('--execute')) {
  console.log('[translate] dry-run only. Use --execute to fill the ledger.');
}
