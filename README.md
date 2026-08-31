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

懒猫微视（LPTV）是一款面向懒猫云盒子的自托管 IPTV 播放应用，前端 React、后端 Node.js。播放采用「整页导航」方案：点击频道后整页导航到央视官网（tv.cctv.com/live）或央视频（yangshipin.cn）官方直播页，由官网自带播放器播放，绕开 HLS 拉流的防盗链/跨域限制。支持 LPK 打包部署至懒猫云盒子，并在懒猫容器内调用 SDK 进入沉浸全屏。

**核心功能**

| 功能 | 说明 |
|------|------|
| 央视官网直播 | CCTV 1~17 整页导航到 tv.cctv.com 官方直播页，官网自播 |
| 央视频卫视 | 32 路卫视通过央视频 pid 播放页整页导航 |
| 台标缓存 | 本地 logos/ 批量台标，/api/proxy/logo 代理并 SVG 兜底 |
| 频道聚合 | 约 50 个可播官网频道（任意映射为 tid/id/category） |
| TV 模式 | 大屏沉浸式频道启动器，键盘/遥控器切换，Enter 整页播放 |
| 懒猫 SDK 沉浸 | 容器内探测 lzc_window/lzc_tab，SetFullScreen + 隐藏控制栏 |
| LPK 打包 | 支持懒猫云盒子一键部署，后端 Node 运行时 |

## 代码架构

```
LPTV/
├── scripts/
│   └── proxy-server.cjs        # Node.js 后端：频道列表 / 台标代理(SVG兜底) / 健康检查
├── src/                        # React + TypeScript 前端
│   ├── pages/                  # 频道列表、收藏、设置、TV 模式（播放 = 整页导航）
│   ├── data/iptvChannels.ts    # 频道数据：含 url(官网播放页) + source(cctv/ysp)
│   ├── utils/openChannel.ts    # 播放入口：懒猫SDK沉浸全屏 + 整页导航
│   └── utils/logoMap.ts        # 频道 -> 台标名映射
├── lptv/                       # TV 专用网页界面（遥控器导航，选台整页跳官网）
├── logos/                      # 台标图片（与 channel 一致，多余已清理）
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
