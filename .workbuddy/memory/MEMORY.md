# 项目记忆

## 技术栈
- Obsidian 插件，TypeScript + esbuild，依赖 mxgraph、pako。

## 构建 / 校验（本机实测有效）
- 用 Bash 工具 + 托管 node 绝对路径执行，不要用 npm/npx（PATH 里没有）：
  - 类型检查：`"C:/Users/hellokunzai/.workbuddy/binaries/node/versions/22.22.2-3/node.exe" node_modules/typescript/bin/tsc -noEmit -skipLibCheck`
  - 构建：`"C:/Users/hellokunzai/.workbuddy/binaries/node/versions/22.22.2-3/node.exe" esbuild.config.mjs --production`（注意本项目的生产开关是 `--production`，不是 `npm run build`）
- Bash 环境缺 `dirname`/`head`/`git` 等命令（会打出 `command not found` 噪音，但 node 命令本身正常返回 exit code）；PowerShell 工具在本机**不回传 stdout**，只有 exit code 可读 → 需要看输出时用 node 脚本打印，别依赖 PowerShell 输出。
- 校验中文文案：esbuild minify 会把非 ASCII 转成 `\uXXXX`，直接 `includes("中文")` 会误判缺失 → 先 `main.js.replace(/\\u([0-9a-fA-F]{4})/g, ...)` 反转义再比对。
- **CSS 着色铁律（v0.8.2 踩坑）**：给 mxGraph 元素（如 `.mxRubberband`）上色**不要依赖 `var(--interactive-accent)` 与 `color-mix`**——本机 Electron 作用域取不到变量或老版本不支持 color-mix 时整条声明失效，导致无边框无背景。直接用具体 hex / rgba（draw.io 蓝 `#167dff` + `rgba(22,125,255,0.12)`）。覆盖 mxClient 默认类时务必补 `position: absolute`、`pointer-events: none`。

## 工作习惯
- 改完代码必须跑 tsc + 构建，并同步升三处版本号（manifest.json / package.json / versions.json）。

## 近期变更
- v0.8.4（真修·isActive 致命 bug）：**`mouseUp` 先调 `isActive()` 再决定是否调 `execute()`**——覆写 `isActive` 时如果返回 false 会直接阻断选择！这是 v0.8.0~v0.8.3 三版"框选不选中"的统一根因。修法：`isActive` 始终返回 true（淡出判定结果存 `this._shouldFade`），`reset` 覆写里临时设 `this.fadeOut=_shouldFade` 再调原始 reset。⚠️ **覆写 mxRubberband 的 isActive 时绝对不能返回 false**，否则 execute 永远不被调用。
- v0.8.3（相交即选中）：框选判定由"严格包含"改为"相交即选中"（用户反馈离形状近/只框到一半时不选中）。`execute`/`repaint` 改用自实现 `collectIntersecting(rect)`：遍历默认父节点子树，对每个可见 cell 取 state（旋转用 `mxUtils.getBoundingBox` 修正），`mxUtils.intersects(rect, bb)` 判定相交即选中（形状+连线都覆盖），`isCellSelectable` 过滤后 `setSelectionCells`。⚠️ 该 mxClient 版本**无** `getCellsWithinArea`，其 `getCells` 第 7 参数虽是相交矩形但**只处理顶点(形状)**、不含连线，故自实现。详见 2026-09-12 日志。
- v0.8.2（CSS 修复）：框选矩形无边框/背景色 → `color-mix`/`var(--interactive-accent)` 在该作用域不可用 + 缺 `position:absolute`。详见 2026-09-12 日志。
- v0.8.1（真修）：左键框选对齐 draw.io。⚠️**坐标语义（关键）**：`mxRubberband` 的 `this.x/y/width/height` 是**容器本地像素坐标**（repaint 里 `div.style.left=this.x` 直接用它，已扣容器滚动与 `panDx`，但**未除 scale**），**不是** clientX 页面坐标；`selectRegion→getCells` 要的是**图坐标**。所以 `execute`/`repaint` 里必须 `graphX = px/scale - view.translate.x`（this.x 已是容器像素，不要再减 origin）。`mxRubberband` 无 `region` 字段（别引用）。详见 2026-09-12 日志。
- v0.6.0：形状面板三功能——顶部 sticky 搜索框（跨分组过滤 i18n 名/英文名/id，含匹配分组强制展开不破坏用户折叠态）、形状间距 gap 4→2px、右缘 6px 把手拖拽调宽（140~400，写 `settings.paletteWidth` 持久化，grid `auto-fill` 列数自适应）（详见 2026-09-11 日志）。
- v0.5.x：画布导航交互——Ctrl+滚轮以鼠标为锚点缩放（普通滚轮不做任何事）；平移手势：**Ctrl+左键（仅空白处，保住 Ctrl 点图形多选）**、空格+左键、中键、右键、Ctrl+Shift 拖拽（详见 2026-09-11 日志）。关键点：mxGraph 构造默认禁用 panning（`setPanning(true)` 启用）；中键/Ctrl+左键平移需 wrap `isPanningTrigger`；wheel 监听必须 `{passive:false}`（否则 Ctrl+滚轮缩放整个 Obsidian 界面）；锚点缩放用 `view.scaleAndTranslate` 一次事务；⚠️ main.js 里 grep `setTranslate` 会命中 mxClient 库字符串，精确校验须查 `src/DrawioView.ts` 源文件。
- v0.4.9 教训（长期有效）：形状面板拖拽**弃用原生 HTML5 DnD**，改 pointer 事件自建拖拽——**原生拖拽位图（默认截图 / setDragImage / canvas）在本 Electron 构建全部不可靠**（v0.4.4~0.4.8 五轮均失败），不要再走这条路；自建拖拽时切勿 setPointerCapture（会让 pointerup 派生 click 误触发"点击添加"）。
