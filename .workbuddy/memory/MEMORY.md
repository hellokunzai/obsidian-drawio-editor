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

## 锁定 / 显隐 / 容器的正确做法（v0.14.0 查证，踩坑级）
- ⚠️ **`mxGraph.prototype.isCellLocked` 不读样式里的 `locked`**：它的实现只看全局 `this.cellsLocked` 与「relative geometry」。所以 draw.io 那种只写 `locked=1` 的样式**在本构建里不生效**。
- 真正生效的是这五个样式键（`isCellMovable/Resizable/Rotatable/Deletable/Editable` 都读）：`movable` / `resizable` / `rotatable` / `deletable` / `editable`，锁定时写 `"0"`，解锁时写 `null`（`mxUtils.setStyle(str,key,null)` 会删掉该键）。`isCellSelectable` 本构建**不看样式**（只 `isCellsSelectable()` 全局），所以锁定后仍可被选中。
- 隐藏图形用 **`mxGraphModel.prototype.setVisible(cell, bool)`**（存在、可撤销、`mxVisibleChange`），序列化进 XML 是 `<mxCell visible="0">` —— draw.io 原生格式，互通。`mxCell.setVisible` 也直接可用。
- ⚠️ **mxGraph 只在 `window.resize` 时自动重算容器尺寸，没有任何 ResizeObserver**。所以容器自身尺寸变化（面板开关、标尺开关、palette 拖宽）**必须手动** `graph.sizeDidChange()` + `view.validate()`，否则 SVG 画布尺寸不跟着变、右下角画不了东西。
- ⚠️ **`model.setStyle` 不去重**（与 `setVisible` 不同）→ 做「幂等重放」（如打开文件后重放图层锁定）时必须先用 `mxUtils.setStyle()` 拼出目标串、**比较不同才 setStyle**，否则每次打开文件都会产生脏标记并触发自动保存。
- `mxUtils.getBoundingBox(state, rotation)` 返回的就是**容器像素**坐标（把传入 rect 绕中心旋转后取轴对齐外接矩形），与 `mxUtils.intersects(rect, bb)` 同口径。
- ⚠️ **`mxOutline` 在本构建里存在，但不要用它做缩略图**：它平移走的是 `panGraph`（改 `panDx/panDy` + 移 canvas 的 style.left），而本插件全用 `view.scaleAndTranslate`（translate）平移，网格背景层与标尺也都是按 translate 算的 → 用 mxOutline 拖拽后网格/标尺会和内容错位。缩略图自绘 canvas、统一用 `scaleAndTranslate` 平移。

## 工作习惯
- 改完代码必须跑 tsc + 构建，并同步升三处版本号（manifest.json / package.json / versions.json）。

## 视图 DOM 结构（v0.15.0 起）
- `buildUI()` 的层级：`containerEl.children[1]`（view content，类 `drawio-editor-container`，flex column）→ ① `.drawio-toolbar`（**横跨整宽、独占顶部一行**；最左是「视图」按钮）② `.drawio-wrapper`（flex row，`flex:1 1 auto; min-height:0`）→ `.drawio-palette` + `.drawio-palette-resize` + `.drawio-main`（`.drawio-canvas-area` 内含 **`.drawio-canvas-scroll`** → `.drawio-graph-container`，加 `.drawio-pagebar` + `.drawio-ruler-*` + 四个 `.drawio-toolwin`，右侧 **`.drawio-panel-rail`**）。
- ⚠️ **v0.15.0 新增 `.drawio-canvas-scroll` 一层**（`.drawio-graph-container` 的父级、画布区的滚动视口）：页面视图开启时给它加 `.drawio-pageview`（`display:grid; place-content: safe center` + JS 写 `padding:Npx`），容器加 `.drawio-page-block`（`border:1px solid #8a8f98`，`width/height:auto`）。
- ⚠️ **居中必须用 grid 的 `place-content: safe center`，不要用 flex + `margin:auto`**：块比视口大会滚动时，flex 居中会把上/左侧溢出部分推到滚动区之外（滚不到）；`safe` 溢出时退化为起点对齐，四边留白由 padding 兜住。
- ⚠️ 标尺让位规则（`.drawio-ruler-on`）作用于 **`.drawio-canvas-scroll`**（不是 `.drawio-graph-container`），否则页面视图下只推动块本身、滚动条仍压在标尺下面。
- `.drawio-panel-rail`（v0.13.0）固定 300px、`position:relative`，内含 `.drawio-diagram-panel`（「绘图」面板）与 `.drawio-format-panel`（原格式面板）两个 `position:absolute; inset:0` 的兄弟节点，靠 `.drawio-collapsed`（= `display:none`）互斥。⚠️ 旧的 `margin-right:-300px` 滑出方案在轨道内失效；`.drawio-panel-rail > .drawio-collapsed` 必须排在 `.drawio-panel-rail > .drawio-format-panel` **之后**（同 0,2,0 特异性，靠顺序取胜）。
- 页面栏放在 `.drawio-canvas-area` 内，宽度天然等于画布区宽——左起形状面板右缘、右抵格式面板左缘。`.drawio-wrapper` 不能再写 `height:100%`，否则会顶出容器。

## 视图菜单与浮动工具窗（v0.14.0）
- 工具栏**最左侧**是「视图」按钮（`.drawio-toolbar-btn.drawio-toolbar-viewbtn`，图标=左栏矩形 + 下拉箭头），点开自绘 DOM 菜单（`src/ViewMenu.ts`，挂 `document.body`、`position: fixed`，module 级 `activeMenu` 保证同时只开一个；勾选后**不关菜单**，原地重渲染）。7 项全部实现：形状 / 格式 / 标尺 / 查找替换 / 图层 / 标签 / 缩略图。**菜单里不显示任何快捷键**（用户明确要求，也没有绑定）。
- 菜单项勾选状态 = `plugin.settings` 的 7 个布尔：`viewShapesPalette / viewPanelRail / viewRuler / viewFind / viewLayers / viewTags / viewMinimap`（默认前三项 true、后四项 false）。
- `DrawioView.applyViewSettings()` 是唯一落点（幂等）：前两项给 `.drawio-palette` + `.drawio-palette-resize` / `.drawio-panel-rail` 加**已有的** `.drawio-hidden`（文件第 88 行就有，`display:none !important`，别重复定义）；标尺走 `ruler.setVisible()`；四个工具窗走 `syncToolPanel(panel, want)`（开/关与设置对齐）。最后统一 `resizeGraphToContainer()`。
- `src/FloatingPanel.ts` 是**可复用的浮动工具窗基类**（查找替换/图层/标签/缩略图共用）：自绘标题栏拖动 + 右下 `.drawio-toolwin-grip` 缩放 + `ResizeObserver` 钳位（拖动时至少留 48px 可见）+ 几何写 `settings.panelGeometry[id] = {x,y,w,h}`。宿主接口只有 `getGeometry/setGeometry`。⚠️ 未拖动过的面板不落盘几何，每次按 `defaultX/defaultY`（可为 `"right"`/`"bottom"`）重算 → 设计上是有意的。
- 标尺：绝对定位覆盖在 `.drawio-canvas-area` 上（该类为此加了 `position:relative`），打开时给 `.drawio-graph-container` 加 `margin:20px 0 0 20px`、给 `.drawio-pagebar` 加 `margin-left:20px`。竖标尺 `bottom:34px`（= `--drawio-pagebar-h`），否则盖住页面栏。刻度自适应：候选 `[1,2,5,10,20,25,50,100,200,250,500,1000,2000,5000]` 取第一个 `step*scale>=60px`，次刻度 = step/5（屏幕 <6px 不画）。
- 图层：定义存 `settings.layers`（**默认层不在数组里**，id 为 `""`），cell 归属靠**样式键 `drawioLayer=<id>`**（跟着文件走）。显隐用 `model.setVisible`，锁定用五个样式键（见上）。面板**顶层在上**（倒序遍历），上移/下移改完数组要按「从后往前依次插到下标 0」重排子节点（`reorderCells`），顺序没变就不动模型。删除是**两步确认**（3 秒内再点一次），连带删除层内图形。新建图形自动打上「当前图层」标记（`addShape` 里 `assignLayer` + `applyLayerState`）。
- 标签：样式键 `drawioTags`，多标签用 `|` 分隔。⚠️ 写入前必须 sanitize 掉 `;` `,`（会破坏样式串解析）与 `|`（分隔符本身）。
- 缩略图：自绘 canvas。内容 / 纸面 / 视口矩形**全在「容器像素」坐标系**里算（`px = scale*(模型坐标+translate)`），点/拖小地图时换算回模型坐标再 `view.scaleAndTranslate` 平移。⚠️ 不要改用 `mxOutline`（原因见上）。
- `applySettings()` 会调 `applyViewSettings()`，所以任何设置变更都会重算一次视图（含 `graph.sizeDidChange()`）——开销可接受，但要知道。

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
- 面板显隐由 `DrawioView` 里 `selectionModel` 的 CHANGE 监听驱动：有选中 → `show(cells)`，空选中 → `hide()`；「排列」Tab 的删除按钮也调 `hide()`。**v0.13.0 起同一个监听还负责两面板互斥**：`diagramPanelEl.classList.toggle("drawio-collapsed", hasSelection)`。
- 底部按钮组 `.drawio-fmt-bottom` 只在「样式」Tab 显示（切 Tab 时 `display` 在 flex/none 间切换）。

## 绘图面板（DrawPanel，v0.13.0）
- 新增 `src/DrawPanel.ts`，与 `FormatPanel` 同构（原生 DOM + `h()` helper，不依赖 Obsidian HTMLElement 扩展），复用 `.drawio-fmt-*` 类名；新增的类：`.drawio-panel-rail` / `.drawio-diagram-panel` / `.drawio-fmt-group-title` / `.drawio-fmt-group-body` / `.drawio-fmt-grow` / `.drawio-fmt-btn(.active)` / `.drawio-fmt-help` / `.drawio-fmt-radios` / `.drawio-fmt-radio` / `.drawio-fmt-colorbox` / `.drawio-fmt-colorswatch` / `.drawio-fmt-pencil` / `.drawio-fmt-spin(-btn)` / `.drawio-fmt-hidden-color`。
- 分组标题（查看 / 选项 / 页面尺寸）**不可折叠、无箭头**，用 `border-top` 分隔（`:first-child` 去掉）；与可折叠的 `.drawio-fmt-section` 是两套东西。
- 面板通过 `DrawPanelHost` 回调视图：`getSettings / patchSettings / editPageData / clearDefaultStyle / applyStyleToPage / getPageStyle`。样式类操作用 `model.filterDescendants(c => model.isVertex(c))` 取当前页所有顶点。
- 12 个新设置项全部在**全局 `plugin.settings`**（`gridSize/gridColor/pageView/pageSizePreset/pageWidth/pageHeight/pageOrientation/backgroundEnabled/backgroundColor/connectionArrows/connectionPoints/guides`），`main.ts` 的 `loadSettings` 逐项兜底 + 钳制。

## mxGraph 该构建（mxClient 4.2.2）的能力边界（v0.13.0 实测）
- ⚠️ **`mxGraph.prototype.resizeContainer` 默认为 `false`**（v0.15.0 查证）→ `sizeDidChange()` 里的 `this.resizeContainer && this.doResizeContainer(c,b)` **不执行**，不会把容器宽高改写成图形包围盒。所以插件手写的 `container.style.width/height` 安全、不会被抹掉。**不要**为了「防覆盖」去设 `graph.resizeContainer=true/false`，那会把 off 状态的既有行为改坏。
- ⚠️ **`mxGraphModel` 没有 `grid / pageWidth / pageHeight / guides / shadow` 这些属性**（原型上只有树结构相关方法）→ `<mxGraphModel pageWidth=...>` 这类 XML 属性在 `captureActivePage` 重新 encode 时本来就会丢，画布级设置只能放插件 settings，**没有按页持久化的落点**。
- 存在：`mxGraph.prototype.pageVisible` / `pageFormat`（默认 `mxConstants.PAGE_FORMAT_A4_PORTRAIT`）/ `pageScale`（**默认 1.5**，为打印预留；必须显式改回 1，A4 才渲染成 draw.io 的 827×1169）/ `guidesEnabled`（属性）/ `gridSize` / `gridEnabled` / `mxGraphHandler.prototype.guidesEnabled`（默认 false）/ `mxConstraintHandler.prototype.enabled`。
- **不存在**：`setPageVisible` / `setPageFormat` / `connectionArrowsEnabled` / `connectionPointsEnabled` / `setCellsStyles` / `resetDefaultVertexStyle`（改用 `mxStylesheet` 的 `putDefault*/createDefault*`）。
- 页面渲染链：设 `graph.pageVisible = true` + `graph.pageFormat = new mxRectangle(0,0,w,h)` → `graph.getView().validateBackground()` → `validateBackgroundPage()` 用 `getBackgroundPageBounds()`（`pageFormat.width * scale * pageScale`）建 `mxRectangleShape`。
- ⚠️ **纸面默认 `new mxRectangleShape(bounds,"white","black")` 且 `isShadow=!0`，白色会把容器上的 CSS 网格整个盖住**（A4 ≈ 827px 宽，基本铺满视口）。修法：在 view **实例**上覆写 `createBackgroundPageShape = b => new mxRectangleShape(b,"none","#8a8f98")`（实例属性遮蔽原型、不影响其它 view），`validateBackground()` 之后再 `view.backgroundPageShape.isShadow = false` + `redraw()`（父函数在 create 之后才赋 isShadow，必须事后改）。填充 `none` 不影响框选：视图的鼠标手势监听挂在 **container** 上，事件冒泡即可。
- 「连接箭头 / 连接点 / 参考线」的真实落点：连接点 → `graph.connectionHandler.constraintHandler.enabled`；参考线 → `graph.graphHandler.guidesEnabled`；连接箭头 → `getStylesheet().getDefaultEdgeStyle()` 的 `endArrow`（`ARROW_CLASSIC` / delete），即作用于新建连线。
- 毫米 → 页面单位：`Math.round(mm / 25.4 * 100)`（draw.io「1 英寸 = 100 单位」，A4 210×297mm → 827×1169，与 mxGraph 默认 pageFormat 一致）。

## 版本索引（详情见对应主题章节）
- **v0.15.0** 页面视图 = 画布收缩居中 + 上下左右留白（`.drawio-canvas-scroll` / `.drawio-page-block` / `pagePadding`）→ 「视图 DOM 结构」
- **v0.14.0** 工具栏「视图」菜单 + 7 项功能（形状/格式/标尺/查找替换/图层/标签/缩略图，不标不绑快捷键）→ 「视图菜单与浮动工具窗」「锁定 / 显隐 / 容器」
- **v0.13.0** 右侧新增「绘图」面板（300px 轨道装两个互斥面板）+ 12 个全局设置项 → 「绘图面板」「mxGraph 能力边界」
- **v0.12.0** 底部页面栏 / 多页 sheet（`mxfile` 多 `<diagram>` + `loadError` 护栏）→ 「多页 / 页面栏」
- **v0.11.x** 右键菜单 + 便签本 + 框选坐标修正 / 工具栏提到顶部整宽 / 格式面板去头部 → 「历史要点」
- **v0.4–v0.10** 形状面板、画布导航、框选、格式面板各 section → 「历史要点」

## 历史要点（v0.4–v0.11，细节见对应日期日志）
- v0.11.2：格式面板去掉头部（「格式」标题 + 折叠/关闭按钮），Tab 行成为首行。
- v0.11.1：工具栏从画布区提到视图根容器下（横跨整宽、独占顶部一行）；`.drawio-wrapper` 由 `height:100%` 改 `flex:1 1 auto; min-height:0`。
- v0.11.0：画布右键上下文菜单（自绘 DOM，挂 body，12 项动作，作用于当前选中集）+ 便签本（`settings.scratchpad`）+ 框选坐标修正。⚠️ 关键坑：`getCellAt` 要容器像素，见「mxGraph 坐标语义」。
- v0.8.4（踩坑级）：覆写 `mxRubberband.isActive` **绝对不能返回 false** —— `mouseUp` 先调 `isActive()` 再决定是否 `execute()`，返回 false 会直接阻断选择（v0.8.0~0.8.3「框选不选中」的统一根因）。修法：`isActive` 始终 return true，淡出判定另存字段、在 `reset` 覆写里生效。
- v0.8.3：框选由「严格包含」改「相交即选中」，自实现 `collectIntersecting(rect)`——该 mxClient **无** `getCellsWithinArea`，`getCells` 第 7 参数虽是相交矩形但**只处理顶点、不含连线**。
- v0.8.2（CSS 铁律）：mxGraph 元素上色不要依赖 `var(--interactive-accent)` / `color-mix`，直接用 hex；覆盖 mxClient 默认类要补 `position:absolute` / `pointer-events:none`。
- v0.6.0：形状面板 sticky 搜索框、间距 gap 2px、右缘把手拖宽（`settings.paletteWidth`，140~400）。
- v0.5.x：画布导航——Ctrl+滚轮以鼠标为锚点缩放（普通滚轮不动）；平移 = Ctrl+左键(仅空白) / 空格+左键 / 中键 / Ctrl+Shift 拖拽。⚠️ v0.11.0 起右键拖拽平移已移除。关键：构造默认禁用 panning（`setPanning(true)` 启用）、wrap `isPanningTrigger`、wheel 必须 `{passive:false}`（否则 Ctrl+滚轮会缩放整个 Obsidian 界面）、锚点缩放用 `view.scaleAndTranslate` 一次事务。
- v0.4.9（长期有效）：形状面板拖拽**弃用原生 HTML5 DnD**（原生拖拽位图在本 Electron 构建全部不可靠，五轮均失败），改 pointer 事件自建；自建拖拽**切勿 `setPointerCapture`**（会让 pointerup 派生的 click 误触发「点击添加」）。
- v0.9.x：格式面板渐变（复选框 + 方向下拉 + 颜色选择器）、线条类型可视下拉（SVG 实时预览，fixed 定位避免被裁剪）、效果区四复选框（圆角/草图/玻璃/阴影）。

