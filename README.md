# LPTV — 懒猫电视

<p align="center">
  <strong>自托管 · 频道聚合 · 流媒体代理 · GitHub Actions 自动更新</strong>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20-339931?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10-3776AB?logo=python&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow">
</p>

## 软件说明

懒猫电视（LPTV）是一款面向 NAS / 私有部署场景的自托管 IPTV 播放应用，通过 GitHub Actions 定时爬取多个开源节目源，自动测速排序、下载台标，生成本地 M3U 播放清单。前端基于 React + HLS.js，后端 Node.js 提供流媒体代理与台标缓存，支持 LPK 打包部署至懒猫云盒子。

## 代码架构

```
LPTV/
├── .github/workflows/
│   ├── lptv.yml                # GitHub Actions：定时爬源、测速、生成 m3u8
│   └── lptv/lptv.py            # 爬虫脚本：多源聚合、分组、台标下载
├── scripts/
│   ├── proxy-server.cjs        # Node.js 后端：M3U 解析 / 流代理 / 台标缓存 / 连通性检测
│   └── fetch-logos.cjs         # 台标批量下载工具
├── src/                        # React + TypeScript 前端
│   ├── pages/                  # 频道列表、收藏、设置、TV 模式
│   ├── components/Player/      # HLS.js 播放器
│   └── utils/channelFilter.ts  # 分组过滤逻辑
├── channels/                   # 生成的播放清单（gitignore）
├── logos/                      # 下载的台标图片（gitignore）
└── lzc/                        # LPK 打包目录
    ├── build.sh                # 构建脚本（前端 + 后端 + 资源打包）
    ├── lzc-manifest.yml        # 应用路由与环境配置
    └── package.yml             # 应用元数据（name / runtime / locales）
```

## 部署说明

### 本地开发

```bash
npm install
npm run dev
# 前端 http://localhost:5173  后端 http://localhost:3000
```

手动同步台标：

```bash
npm run fetch-logos          # 智能模式（只下载缺失的）
npm run fetch-logos:force    # 强制重新下载所有
```

### lzc-cli 部署

将应用部署到懒猫云盒子，需先在本机安装 `lzc-cli`：

```bash
npm install -g @lazycatcloud/lzc-cli
```

1. 登录盒子

```bash
lzc-cli box add-by-ssh <用户名> <盒子IP>
lzc-cli box switch <盒子名>
```

2. 构建并部署

```bash
cd lzc && bash package.sh          # 先本地打包生成 .lpk
lzc-cli lpk install cloud.lazycat.app.lptv-<版本>.lpk
```

3. 访问应用

```
https://<子域名>.<域名>
```

### LPK 生成

```bash
cd lzc && bash package.sh
```

脚本执行流程：

1. 读取版本号（优先 `LPK_VERSION` 环境变量，其次 git tag）
2. 编译前端静态产物（`npm run build`）
3. 复制 Node.js 后端脚本、M3U 播放清单、台标图片至 LPK 内容目录
4. 调用 `lzc-cli project release` 生成 LPK

指定版本打包：

```bash
LPK_VERSION=1.0.0 bash package.sh
```

CI 自动打包（push git tag `v*` 触发）：

```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ['v*']
```

## 软件声明

仅限个人学习研究场景使用，支持网络协议分析、爬虫开发、自动化脚本调试等技术实验，严禁投入盈利项目、商业场景以及一切违规活动。

项目不生成、不储存、不编辑任何音视频素材，所有可用节目源均为互联网对外开放地址。

禁止公开分享、二次转发项目文件与播放清单；各频道知识产权归版权方所有，使用行为需满足当地法律规范。

## License

[MIT](./LICENSE)

<p align="center">Powered by LightOS · Made for LCMD</p>
