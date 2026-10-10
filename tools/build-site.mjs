// Build the static site into dist/ (site assets + data/catalog.json).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR } from './lib.mjs';

const dist = path.join(ROOT, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), '', 'utf8');
fs.writeFileSync(path.join(dist, '404.html'), '<!doctype html><meta charset="utf-8"><title>404</title><script>location.replace("./")</' + 'script>', 'utf8');
fs.writeFileSync(path.join(dist, 'robots.txt'), ['User-agent: *', 'Allow: /', ''].join(String.fromCharCode(10)), 'utf8');
for (const f of ['index.html', 'style.css', 'app.js']) {
  fs.copyFileSync(path.join(ROOT, 'site', f), path.join(dist, f));
}
fs.copyFileSync(path.join(DATA_DIR, 'catalog.json'), path.join(dist, 'catalog.json'));
if (fs.existsSync(path.join(ROOT, 'site', 'appicons'))) {
  fs.cpSync(path.join(ROOT, 'site', 'appicons'), path.join(dist, 'appicons'), { recursive: true });
}
console.log('[build-site] dist/ ready —', JSON.parse(fs.readFileSync(path.join(dist, 'catalog.json'), 'utf8')).total, 'plugins');
