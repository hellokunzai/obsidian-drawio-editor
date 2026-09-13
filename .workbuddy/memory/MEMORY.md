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

## mxGraph 坐标语义（v0.11.0 修正，优先级最高）
- **`state.x/y/width/height` 是「容器像素坐标」**：`mxGraphView.updateCellState` 里 `state.x = scale*(translate.x + origin.x)`。
- 因此 `graph.getCellAt(px, py)`、`graph.getCells(...)`、`mxUtils.intersects(rect, state)`、`setSelectionCells` 的框选矩形，**入参一律是容器像素**，不要再做 `px/scale - translate.x` 反投影。
- 校验链：`mxRubberband.execute` → `graph.selectRegion(rect)` → `graph.getCells(rect.x, rect.y, rect.w, rect.h)`，全程原样透传像素。
- 需要**图坐标**（模型坐标，给 `insertVertex`/`getPointForEvent` 用）时才换算：`graphX = px/scale - translate.x`，等价于 `graph.getPointForEvent(evt)`。
- clientX/clientY → 容器像素用 **`mxUtils.convertPoint(container, clientX, clientY)`**（mxGraph 内部统一这么转），不要手写 `clientX - rect.left`（漏掉容器滚动/offset）。
- ⚠️ 历史教训：v0.8.1~v0.8.4 记录过「getCells 要图坐标」，**是错的**。默认 `translate=(0,0)`、`scale=1` 时反投影恰好是恒等变换才没暴露；一旦点「适应画布」或缩放平移，框选/右键命中就会整体错位。v0.11.0 已修正框选并新增右键命中。

## 其他 mxGraph 事实（实测）
- `graph.popupMenuHandler.setEnabled(false)` 能真正关掉自带右键菜单：`mxPopupMenuHandler.mouseDown` 首行就是 `this.isEnabled() && ...`，禁用后 `popupTrigger` 不会置位。
- 本版 `mxKeyHandler` 构造函数**默认不绑定任何按键**（`normalKeys` 为空）→ 删除键要在插件里自己接。
- 复制/创建副本/粘贴用 `graph.moveCells(cells, dx, dy, true, parent)`（clone=true 一步完成「克隆+平移+加入」，正确保留连线终点引用/组合子节点/边控制点）。
- `mxGeometry.prototype.translate` 是**原地修改**（同时平移 x/y、sourcePoint、targetPoint、points）。

## 工作习惯
- 改完代码必须跑 tsc + 构建，并同步升三处版本号（manifest.json / package.json / versions.json）。

## 视图 DOM 结构（v0.12.0 起）
- `buildUI()` 的层级：`containerEl.children[1]`（view content，类 `drawio-editor-container`，flex column）→ ① `.drawio-toolbar`（**横跨整宽、独占顶部一行**，v0.11.1 从画布区提上来的）② `.drawio-wrapper`（flex row，`flex:1 1 auto; min-height:0`）→ `.drawio-palette` + `.drawio-palette-resize` + `.drawio-main`（`.drawio-canvas-area` 内含 `.drawio-graph-container` + **`.drawio-pagebar`**，右侧 `.drawio-format-panel`）。
- 页面栏放在 `.drawio-canvas-area` 内（不是 wrapper 下），所以其宽度天然等于画布区宽——左起形状面板右缘、右抵格式面板左缘，与 draw.io 一致。改成整宽的话要把它挪到 `.drawio-wrapper` 之后。
- 改布局时注意：`.drawio-wrapper` 不能再写 `height:100%`，否则会顶出容器。

## 多页 / 页面栏（v0.12.0）
- 存储格式：一个 `.drawio` = 一个 `<mxfile>`，每页一个 `<diagram name="…" id="…">`，页内容是**未压缩**的 `<mxGraphModel>…</mxGraphModel>` 文本（draw.io 双端可读，无需 deflate 回写）。
- 视图状态：`pages: {id,name,xml}[]` + `activePage`。非活动页的模型只以字符串形式躺在 `pages[i].xml` 里。
- 切页三步：`captureActivePage()`（`encoder.encode(graph.getModel())` 存回当前页）→ `loadPageIntoGraph(i)` → `pageBar.render()`。
- `loadPageIntoGraph` 必做：`model.clear()` 重建干净模型（否则上一页的 cell id 会残留、与新页冲突）→ `codec.decode(node, model)` → `graph.clearSelection()` → `undoManager.clear()`（撤销栈跨页会串味）。全程 `suppressDirty=true` 包住，否则切页会触发自动保存。
- ⚠️ 关键 API：`mxGraphModel.prototype.clear = function(){ this.setRoot(this.createRoot()); }` —— 切页重置模型就用它。mxGraph 自带 `mxGraphModel` 专用 codec，其 `decodeRoot` 结尾会 `model.setRoot(rootCell)`，所以 decode 是替换 root 而不是往旧 root 上挂。
- 解析三种写法（`extractModelXml`）：① mxGraphModel 是 `<diagram>` 的子元素（`getElementsByTagName` 直接找到，注意此时 `diagramNode.textContent` 是**空串**，不能只看 textContent）；② 未压缩但被转义成文本（textContent 含 `<`）；③ 压缩格式（textContent 不含 `<` → `decompressDrawio`）。
- ⚠️ 排序坑：拖拽重排计算插入位时，因为候选矩形本就排除了被拖页签，`slot` 的坐标系已经等价于「splice 掉源元素后要插入的下标」，**不能再做 `if (slot > from) slot--` 补偿**（原型里有这个 bug，会让「拖到最右却没动」）。
- 数据安全：`loadError` 标志。文件解析失败时给一个空白页但**禁止自动保存**（`markDirty` 提前 return、`cleanup` 加 `!loadError` 守卫），否则会把用户原文件覆盖成空 mxfile；手动保存不受限。
- 删除页后的 activePage 修正：删前面的页只 `-1`（画布不重载）；删当前页 `min(index, len-1)` + 重载；删后面的页不动。

## 格式面板（FormatPanel）结构要点
- v0.11.2 起**没有头部**：不再有 `.drawio-fmt-header`（「格式」标题 + 折叠/关闭图标按钮），`.drawio-fmt-tabs`（样式/文本/排列）就是面板第一行。i18n 的 `format.title/collapse/close` 已删除，别再加回来。
- 面板显隐由 `DrawioView` 里 `selectionModel` 的 CHANGE 监听驱动：有选中 → `show(cells)`，空选中 → `hide()`；「排列」Tab 的删除按钮也调 `hide()`。
- 底部按钮组 `.drawio-fmt-bottom` 只在「样式」Tab 显示（切 Tab 时 `display` 在 flex/none 间切换）。

## 近期变更
- v0.12.0（底部页面栏 / 多页 sheet）：新增 `src/PageBar.ts`（页签渲染与切换、+ 新建、双击行内重命名、⋮ / 活动页签 ^ / 右键页签 / 右侧空白右键共用一个菜单，含重命名·插入·复制·左移·右移·删除，拖拽重排带蓝线指示，仅一页时删除置灰，横向滚动并自动滚到活动页）；`DrawioView` 改为「页列表 + 活动页」模型，存取 `mxfile` 下多个 `<diagram>`；新增 `loadError` 禁止解析失败时自动覆盖原文件。详见上文「多页 / 页面栏」。
- v0.11.2（格式面板去掉头部）：「格式」标题与折叠/关闭两个图标按钮整行删除，Tab 行成为面板首行；同时清理 3 个 i18n key 与 3 条 CSS 规则。
- v0.11.1（布局：工具栏提到顶部整宽）：工具栏从 `.drawio-canvas-area` 提到视图根容器下（横跨整宽、独占顶部一行），形状面板下移到工具栏之下——用户反馈「形状栏不要覆盖顶部菜单栏」；`.drawio-wrapper` 由 `height:100%` 改 `flex:1 1 auto; min-height:0`。
- v0.11.0（右键上下文菜单 + 便签本 + 框选坐标修正）：画布图形/连线右键出 draw.io 风格自绘 DOM 菜单（挂 body，`position:fixed`，视口内钳制），12 项动作：删除/剪切/复制/创建副本/粘贴/锁定解锁/设为默认样式/移至最前|最后|上移|下移一层/编辑样式|数据|链接|连接点/添加到便签本；菜单项操作对象是 **当前选中集**（`getSelectionCells`），仅编辑类动作用右键命中的单个 cell。新增 `src/TextEditModal.ts`（可复用弹窗）与 `setupCanvasShortcuts`（Ctrl+C/X/V/D + Del/Backspace，`container.matches(":hover")` 守卫）。便签本存 `settings.scratchpad`，面板底部新增分组（仅非空时显示，`filterPalette` 跳过 `data-category-key="__scratch"`），每项悬停出「×」。**删除了原型里未实现的 Ctrl+E/Ctrl+M 快捷键文案**（Ctrl+E 会撞 Obsidian 编辑/阅读模式切换）。⚠️ 关键坑：`getCellAt` 要的是容器像素，见上文「mxGraph 坐标语义」。
- v0.8.4（真修·isActive 致命 bug）：**`mouseUp` 先调 `isActive()` 再决定是否调 `execute()`**——覆写 `isActive` 时如果返回 false 会直接阻断选择！这是 v0.8.0~v0.8.3 三版"框选不选中"的统一根因。修法：`isActive` 始终返回 true（淡出判定结果存 `this._shouldFade`），`reset` 覆写里临时设 `this.fadeOut=_shouldFade` 再调原始 reset。⚠️ **覆写 mxRubberband 的 isActive 时绝对不能返回 false**，否则 execute 永远不被调用。
- v0.8.3（相交即选中）：框选判定由"严格包含"改为"相交即选中"（用户反馈离形状近/只框到一半时不选中）。`execute`/`repaint` 改用自实现 `collectIntersecting(rect)`：遍历默认父节点子树，对每个可见 cell 取 state（旋转用 `mxUtils.getBoundingBox` 修正），`mxUtils.intersects(rect, bb)` 判定相交即选中（形状+连线都覆盖），`isCellSelectable` 过滤后 `setSelectionCells`。⚠️ 该 mxClient 版本**无** `getCellsWithinArea`，其 `getCells` 第 7 参数虽是相交矩形但**只处理顶点(形状)**、不含连线，故自实现。详见 2026-09-12 日志。
- v0.8.2（CSS 修复）：框选矩形无边框/背景色 → `color-mix`/`var(--interactive-accent)` 在该作用域不可用 + 缺 `position:absolute`。详见 2026-09-12 日志。
- v0.8.1：左键框选对齐 draw.io。⚠️ 该版记录的「`getCells` 要图坐标、必须 `px/scale - translate.x` 反投影」**是错的**，v0.11.0 已修正——见上文「mxGraph 坐标语义」。`mxRubberband` 无 `region` 字段（别引用）。
- v0.6.0：形状面板三功能——顶部 sticky 搜索框（跨分组过滤 i18n 名/英文名/id，含匹配分组强制展开不破坏用户折叠态）、形状间距 gap 4→2px、右缘 6px 把手拖拽调宽（140~400，写 `settings.paletteWidth` 持久化，grid `auto-fill` 列数自适应）（详见 2026-09-11 日志）。
- v0.5.x：画布导航交互——Ctrl+滚轮以鼠标为锚点缩放（普通滚轮不做任何事）；平移手势：**Ctrl+左键（仅空白处，保住 Ctrl 点图形多选）**、空格+左键、中键、Ctrl+Shift 拖拽（详见 2026-09-11 日志）。⚠️ v0.11.0 起**右键拖拽平移已移除**，右键改出上下文菜单。关键点：mxGraph 构造默认禁用 panning（`setPanning(true)` 启用）；中键/Ctrl+左键平移需 wrap `isPanningTrigger`；wheel 监听必须 `{passive:false}`（否则 Ctrl+滚轮缩放整个 Obsidian 界面）；锚点缩放用 `view.scaleAndTranslate` 一次事务；⚠️ main.js 里 grep `setTranslate` 会命中 mxClient 库字符串，精确校验须查 `src/DrawioView.ts` 源文件。
- v0.4.9 教训（长期有效）：形状面板拖拽**弃用原生 HTML5 DnD**，改 pointer 事件自建拖拽——**原生拖拽位图（默认截图 / setDragImage / canvas）在本 Electron 构建全部不可靠**（v0.4.4~0.4.8 五轮均失败），不要再走这条路；自建拖拽时切勿 setPointerCapture（会让 pointerup 派生 click 误触发"点击添加"）。
