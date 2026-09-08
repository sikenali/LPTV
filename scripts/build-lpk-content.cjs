const fs = require('fs');
const path = require('path');
const root = 'D:/UGit/LPTV';
const lzc = path.join(root, 'lzc');
const out = path.join(lzc, '_lpk_content');

['frontend', 'scripts', 'channels', 'logos'].forEach(function(d) {
  fs.mkdirSync(path.join(out, d), { recursive: true });
});

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.readdirSync(src, { recursive: true }).forEach(function(f) {
    var s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) fs.mkdirSync(d, { recursive: true });
    else fs.copyFileSync(s, d);
  });
}
function copyFile(src, dst) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

copyDir(path.join(root, 'dist'), path.join(out, 'frontend'));
copyFile(path.join(root, 'scripts/proxy-server.cjs'), path.join(out, 'scripts/proxy-server.cjs'));
copyFile(path.join(lzc, 'backend-package.json'), path.join(out, 'package.json'));
copyFile(path.join(lzc, 'icon.png'), path.join(out, 'icon.png'));

fs.readdirSync(path.join(root, 'channels')).filter(function(f) { return f.endsWith('.m3u'); }).forEach(function(f) {
  copyFile(path.join(root, 'channels', f), path.join(out, 'channels', f));
});
fs.readdirSync(path.join(root, 'logos')).filter(function(f) { return f.endsWith('.png'); }).forEach(function(f) {
  copyFile(path.join(root, 'logos', f), path.join(out, 'logos', f));
});

var sh = [
  '#!/bin/sh',
  'BUNDLED_DEPS="/lzcapp/pkg/content/node_modules"',
  'FALLBACK_NM="/tmp/lptv-node-modules"',
  '',
  'if [ -d "$BUNDLED_DEPS" ]; then',
  '  export NODE_PATH="$BUNDLED_DEPS"',
  'else',
  '  echo "[start] no bundled node_modules, installing..."',
  '  if [ ! -d "$FALLBACK_NM" ]; then',
  '    npm install --prefix "$FALLBACK_NM" express cors m3u-parser-generator --production --loglevel=error 2>&1 || { echo "[start] FAILED to install deps"; exit 1; }',
  '  fi',
  '  export NODE_PATH="$FALLBACK_NM/node_modules"',
  'fi',
  'exec node /lzcapp/pkg/content/scripts/proxy-server.cjs',
].join('\n') + '\n';
fs.writeFileSync(path.join(out, 'scripts/start-backend.sh'), sh);

console.log('Done. Channels:', fs.readdirSync(path.join(out, 'channels')).filter(function(f) { return f.endsWith('.m3u'); }).join(', '));
