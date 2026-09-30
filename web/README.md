# LX TV Web — Vue 3 UI 实现

基于 Calicat 设计稿 (file_id: 2027295427009261568) 实现的 Vue 3 单页应用 UI。

## 设计稿来源

| 页面 | 图层 ID | 内容 |
|---|---|---|
| 设置面板 | `baf7e90b-6085-46aa-8e14-9a92388681d1` | 玻璃态设置卡、开关、画面模式、录制/截图路径、快捷键说明 |
| 频道列表 | `2b389304-fdee-4f8c-981d-730472fc73f7` | 侧栏、当前频道卡、筛选页签(全部/收藏)、分组频道列表 |
| 节目单 | `24c863e6-2687-4005-b1b8-12dd79e0561d` | 侧栏、日期页签(今天/明天/周六/周日/预约)、节目列表、当前节目高亮 |

## 文件结构

```
web/
├── index.html          # 入口
├── vite.config.js      # Vite 配置
├── package.json
├── src/
│   ├── main.js         # Vue 挂载
│   └── App.vue         # 全部 UI 组件 (单文件)
└── dist/               # 构建产物 (npm run build)
```

## 运行

```bash
cd web
npm install
npm run dev       # 开发模式 (localhost:5173)
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物
```

## 技术栈

- **Vue 3** (Composition API, `<script setup>`)
- **RemixIcon** (图标库)
- **Vite 6** (构建工具)
- CSS Scoped + 毛玻璃 (backdrop-filter) 效果

## 与路线 A 代理集成

`dist/` 目录可直接由 `proxy/server.py` 的静态文件服务提供：

```python
# 在 server.py 的 build_app() 中修改
app.router.add_static("/", STATIC_DIR / "web" / "dist", name="static")
```

或将 `dist/` 整体复制到 `static/` 目录替换现有前端。
