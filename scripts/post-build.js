#!/usr/bin/env node
/**
 * post-build: 将 web/dist 同步到根 dist/
 * Vue 版本为主入口，不再复制静态 layer.js 覆盖 Vue index.html
 */
const fs = require('fs');
const path = require('path');

const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');
const ROOT_DIST = path.join(__dirname, '..', 'dist');
const STATIC_SRC = path.join(__dirname, '..', 'static');

// 清空并复制 web/dist
if (fs.existsSync(ROOT_DIST)) {
  fs.rmSync(ROOT_DIST, { recursive: true, force: true });
}
fs.cpSync(WEB_DIST, ROOT_DIST, { recursive: true });
console.log('[post-build] web/dist → dist/ done');

// 复制静态文件到 dist/
const staticFiles = ['layer.js', 'patch.js', 'ui.css', 'api.js', 'state.js',
                     'manifest.json', 'icon.png'];
staticFiles.forEach(f => {
  const src = path.join(STATIC_SRC, f);
  const dst = path.join(ROOT_DIST, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`[post-build] ${f} → dist/ done`);
  } else {
    console.log(`[post-build] ${f} not found in static/`);
  }
});

// proxy-server.cjs 在 scripts/ 目录下
const srcProxy = path.join(__dirname, '..', 'scripts', 'proxy-server.cjs');
const dstProxy = path.join(ROOT_DIST, 'proxy-server.cjs');
if (fs.existsSync(srcProxy)) {
  fs.copyFileSync(srcProxy, dstProxy);
  console.log('[post-build] proxy-server.cjs → dist/ done');
} else {
  console.log('[post-build] proxy-server.cjs not found in scripts/');
}
