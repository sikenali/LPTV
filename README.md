# 懒猫微视（LPTV）

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

懒猫微视（LPTV）是一款面向 NAS / 私有部署场景的自托管 IPTV 播放应用，通过 GitHub Actions 定时爬取多个开源节目源，自动测速排序、下载台标，生成本地 M3U 播放清单。前端基于 React + HLS.js，后端 Node.js 提供流媒体代理与台标缓存，支持 LPK 打包部署至懒猫云盒子。

**核心功能**

| 功能 | 说明 |
|------|------|
| 多源聚合 | 聚合 15+ 公开源，去重后生成稳定播放清单 |
| 质量测速 | HEAD + GET 混合探测，综合评分排序（延迟/码率/类型） |
| 分辨率提取 | 解析 HLS manifest 中的 RESOLUTION/BANDWIDTH，输出质量标签 |
| IPv4/IPv6 分离 | 自动生成 lptv.ipv4.m3u / lptv.ipv6.m3u 独立清单 |
| 流媒体代理 | Node.js 反向代理，支持 Referer 伪装、m3u8 URL 重写 |
| 台标缓存 | 批量下载 fanmingming CDN 台标，本地缓存加速 |
| TV 模式 | 全屏沉浸式观看，键盘方向键切台，Escape 退出 |
| LPK 打包 | 支持懒猫云盒子一键部署，免网络离线可用 |

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
│   ├── components/Player/      # HLS.js 播放器（HlsPlayer / IptvWebPlayer）
│   └── utils/channelFilter.ts  # 分组过滤逻辑
├── channels/                   # 生成的播放清单（gitignore）
├── logos/                      # 下载的台标图片（gitignore）
└── lzc/                        # LPK 打包目录
    ├── build.sh                # 构建脚本（前端 + 后端 + 资源打包）
    ├── package.sh              # LPK 生成入口（调用 build.sh + lzc-cli）
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

### LPK 部署（懒猫云盒子）

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
cd lzc && bash package.sh          # 本地打包生成 .lpk
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
LPK_VERSION=1.0.2 bash package.sh
```

CI 自动打包（push git tag `v*` 触发）：

```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ['v*']
```

## 软件声明

### 重要声明

1. **仅限个人学习研究**
   本项目仅供网络协议分析、爬虫开发、自动化脚本调试等技术实验使用，严禁投入盈利项目、商业场景以及一切违反当地法律法规的活动。

2. **无官方隶属关系**
   本项目与 CCTV、央视、各地方电视台及任何 IPTV 运营商不存在官方合作、授权或从属关系。所有节目源均来自互联网公开地址，项目不生成、不储存、不编辑任何音视频素材。

3. **知识产权与免责声明**
   各频道内容版权归版权方所有，使用行为需满足当地法律规范。项目不保证服务的持续性、稳定性与适配性，对于使用本项目产生的一切直接、间接损失不承担任何责任。

### 商标声明

**懒猫微视™** 为未注册商标，**懒猫微服™** 为企业注册商标，两者之间没有关联关系。本开源项目仅用于个人学习与交流，非懒猫微服官方发布的电视应用。

## License

[MIT](./LICENSE)

<p align="center">Powered by LightOS · Made for LCMD</p>
