/* 把纯前端文件收集到 www/，供 Capacitor 打包成 APK */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');

const KEEP = ['index.html', 'manifest.webmanifest', 'sw.js', 'assets', 'icons'];
// 打 APK 时传 --no-sw：离线由原生壳保证，留着 SW 反而可能缓存旧页面
const noSw = process.argv.includes('--no-sw');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === 'node_modules' || name === '.DS_Store') continue;
      copy(path.join(src, name), path.join(dst, name));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

for (const name of KEEP) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) copy(src, path.join(www, name));
}

if (noSw) {
  const sw = path.join(www, 'sw.js');
  if (fs.existsSync(sw)) fs.rmSync(sw);
}

// GitHub Pages 默认会用 Jekyll 处理，可能吞掉部分文件
fs.writeFileSync(path.join(www, '.nojekyll'), '');

console.log('www/ 已生成:');
for (const name of fs.readdirSync(www)) console.log('  - ' + name);
