# 项目记忆

> Obsidian 插件 obsidian-drawio-editor（id: `drawio-editor`）。当前 v0.16.1。
> 本文只留「跨会话仍然成立」的事实与踩坑结论；逐次改动过程见 `.workbuddy/memory/YYYY-MM-DD.md`。

## 技术栈与工作流
- TypeScript + esbuild，依赖 mxgraph 4.2.2（`src/mxClient.min.js`，打包进产物）+ pako。
- 改完代码必须：跑 tsc → 跑 esbuild 生产构建 → 同步升**三处**版本号（manifest.json / package.json / versions.json）。
- 用户自己把构建产物（main.js / styles.css / manifest.json）拷进 vault，**不要**去找/扫插件目录；未经明确要求不 `git commit`。

## 本机构建 / 校验（实测有效）
- 用 Bash + 托管 node 绝对路径，不要用 npm/npx（PATH 里没有）：
  - 类型检查：`"C:/Users/hellokunzai/.workbuddy/binaries/node/versions/22.22.2-3/node.exe" node_modules/typescript/bin/tsc -noEmit -skipLibCheck`
  - 构建：`".../node.exe" esbuild.config.mjs --production`（⚠️ 生产开关是 `--production`，不是 `npm run build`；package.json 的 build 脚本已同步）
- Bash 缺 `dirname/head/tail/ls/wc/git` 等命令（会打 `command not found` 噪音，但 node 命令本身仍正常返回 exit code）；PowerShell 工具**不回传 stdout**，只有 exit code → 要看输出就用 node/python 脚本打印。
- 校验中文文案：esbuild minify 把非 ASCII 转成 `\uXXXX`，直接 `includes("中文")` 会误判缺失 → 先 `main.js.replace(/\\u([0-9a-fA-F]{4})/g, …)` 反转义再比对。
- 看截图取证：本机无 PIL/ImageMagick → `python -m venv` + `pip install pillow`，然后**逐像素扫描**定位元素边界/取色（比肉眼估坐标准得多）。建议 venv 建在 `C:\Users\hellokunzai\.workbuddy\binaries\python\envs\default`。
- 想确认 Obsidian 自身的布局行为，可读 `%APPDATA%\obsidian\obsidian-<ver>.asar`（二进制里能直接搜到 CSS 文本）。用户当前是 **1.13.7**。

## CSS 铁律
- **上色不要依赖 `var(--interactive-accent)` / `color-mix`**：本机 Electron 作用域取不到变量、或不认 `color-mix` 时整条声明失效（表现为无边框无背景）。直接用具体 hex / rgba（draw.io 蓝 `#167dff` + `rgba(22,125,255,0.12)`）。
- 覆盖 mxClient 默认类（如 `.mxRubberband`）务必补 `position: absolute`、`pointer-events: none`。
- ⚠️ 不要用 `place-content: safe center`（v0.15.0 踩坑，v0.16.0 换掉）：本机 Electron 不认 `safe` 关键字时整条 `place-content` 被丢弃、回落到 `normal`(=stretch)，会把 `width:100%` 的普通模式画布拉高成整条滚动行程。改用 flex + `margin:auto`（溢出时 margin 折算为 0，行为温和）。
- 覆盖 Obsidian 自带规则时注意**特异性**：`.workspace-leaf-content .view-content` 是 (0,3,0) 前的 (0,2,0)，插件要压过它必须写 ≥(0,3,0)，别指望加载顺序。

## 视图铺满叶子（v0.16.1 踩坑级）
- **症状**：插件四周露出一圈空白，底部最明显（约 32px），看着像「下面有一条死白」。
- **根因**：Obsidian 自带 `.workspace-leaf-content .view-content { padding: 12px 12px 32px; padding-bottom: max(safe-area-inset-bottom, 32px); overflow: auto }`。`.drawio-editor-container` 的 `height:100%` 只拿到它的**内容盒**高度 → 上/左/右各丢 12px、下丢 32px。那 32px 只是给悬浮状态栏留的装饰性缓冲——状态栏其实是 `--status-bar-position: fixed` 的浮层（`.status-bar { position: var(...); width:auto; bottom:0; right:0; border-radius: var(--radius-m) 0 0 0 }`），**并不占布局**。
- **修法**（已在 styles.css）：照 Obsidian 自己对 markdown 视图的做法把内边距清零，选择器保持 (0,3,0)：
  ```css
  .workspace-leaf-content[data-type="drawio-editor-view"] .view-content,
  .workspace-leaf-content .view-content:has(> .drawio-editor-container) { padding: 0; overflow: hidden; }
  ```
- ⚠️ 不要改回 `height: calc(100% + 32px)` 之类的硬编码补偿：内边距随 Obsidian 版本变，清零才稳。

## mxGraph 坐标语义（v0.11.0 修正，优先级最高）
- **`state.x/y/width/height` 是「容器像素坐标」**：`mxGraphView.updateCellState` 里 `state.x = scale*(translate.x + origin.x)`。
- 因此 `graph.getCellAt(px,py)`、`graph.getCells(...)`、`mxUtils.intersects(rect, state)`、框选矩形，**入参一律是容器像素**，不要再做 `px/scale - translate.x` 反投影。
- 校验链：`mxRubberband.execute` → `graph.selectRegion(rect)` → `graph.getCells(rect...)`，全程原样透传像素。
- 只有需要**图坐标**（给 `insertVertex` 用）时才换算：`graphX = px/scale - translate.x`，等价于 `graph.getPointForEvent(evt)`。
- clientX/clientY → 容器像素用 **`mxUtils.convertPoint(container, clientX, clientY)`**（不要在 CSS 里手写 `clientX - rect.left`，会漏滚动/offset）。
- ⚠️ 历史教训：v0.8.1~v0.8.4 记过「getCells 要图坐标」，**是错的**；默认 `translate=(0,0)`、`scale=1` 时反投影恰好是恒等变换才没暴露。

## 其他 mxGraph 事实（实测）
- `graph.popupMenuHandler.setEnabled(false)` 能真正关掉自带右键菜单（`mouseDown` 首行就是 `if (isEnabled())`）。
- 本版 `mxKeyHandler` 构造函数**默认不绑定任何按键**（`normalKeys` 为空）→ 删除键要在插件里自己接。
- 复制/副本/粘贴用 `graph.moveCells(cells, dx, dy, true, parent)`（clone=true 一步完成「克隆+平移+加入」，正确保留连线终点引用/组合子节点/边控制点）。
- `mxGeometry.prototype.translate` 是**原地修改**（同时平移 x/y、sourcePoint、targetPoint、points）。
- `graph.resizeContainer` **默认为 false** → `sizeDidChange()` 里的 `doResizeContainer` 不执行，插件手写的 `container.style.width/height` 安全、不会被抹掉。**不要**为了「防覆盖」去动这个开关，那会把 off 状态的既有行为改坏。
- **mxGraph 只在 `window.resize` 时自动重算容器尺寸，没有任何 ResizeObserver** → 容器自身尺寸变化（面板开关、标尺开关、palette 拖宽）**必须手动** `graph.sizeDidChange()` + `view.validate()`，否则 SVG 画布尺寸不跟着变、右下角画不了东西。

## 锁定 / 显隐 / 容器
- ⚠️ **`isCellLocked` 不读样式里的 `locked`**：只看全局 `this.cellsLocked` 与 relative geometry → draw.io 那种只写 `locked=1` 的样式**在本构建里不生效**。
- 真正生效的是这五个样式键（`isCellMovable/Resizable/Rotatable/Deletable/Editable` 都读）：`movable` / `resizable` / `rotatable` / `deletable` / `editable`，锁定时写 `"0"`，解锁写 `null`（`mxUtils.setStyle(str,key,null)` 会删键）。`isCellSelectable` 本构建**不看样式**，锁定后仍可被选中。
- 隐藏用 **`mxGraphModel.prototype.setVisible(cell,bool)`**（可撤销、`mxVisibleChange`），序列化成 `<mxCell visible="0">` —— draw.io 原生格式，互通。
- ⚠️ **`model.setStyle` 不去重**（与 `setVisible` 不同）→ 幂等重放（如打开文件后重放图层锁定）必须先用 `mxUtils.setStyle()` 拼目标串、**比较不同才 setStyle**，否则每次打开文件都产生脏标记并触发自动保存。
- `mxUtils.getBoundingBox(state, rotation)` 返回的就是**容器像素**坐标（绕中心旋转后取轴对齐外接矩形），与 `mxUtils.intersects(rect, bb)` 同口径。
- ⚠️ **`mxOutline` 存在但不要用来做缩略图**：它平移走 `panGraph`（改 `panDx/panDy` + 移 canvas 的 style.left），而本插件全用 `view.scaleAndTranslate`（translate）平移，网格背景层与标尺也按 translate 算 → 用 mxOutline 拖拽后网格/标尺会和内容错位。缩略图自绘 canvas、统一 `scaleAndTranslate`。

## 视图 DOM 结构（v0.16.0 起）
- `buildUI()` 层级：`containerEl.children[1]`（view content，类 `drawio-editor-container`，flex column）→ ① `.drawio-toolbar`（**横跨整宽、独占顶部一行**；最左是「视图」按钮）② `.drawio-wrapper`（flex row，`flex:1 1 auto; min-height:0`）→ `.drawio-palette` + `.drawio-palette-resize` + `.drawio-main`（`.drawio-canvas-area` 内含 **`.drawio-canvas-scroll`** → `.drawio-graph-container`，加 `.drawio-pagebar` + `.drawio-ruler-*` + 四个 `.drawio-toolwin`，右侧 **`.drawio-panel-rail`**）。
- `.drawio-canvas-scroll` = 画布区滚动视口（`.drawio-graph-container` 的父级），**常态 `display:flex; flex-direction:column` + 子项 `margin:auto`**：
  - 页面视图关闭时容器 `width/height:100%`，块正好铺满视口，无需滚动。
  - 页面视图开启时容器加 `.drawio-page-block`（`flex:0 0 auto; margin:auto; border:1px solid #8a8f98`），宽高由 JS 写死成「页面单位 × 缩放」。
- ⚠️ 页面视图下 mxGraph 的 svg 根元素要写 `overflow: visible`（`syncCanvasTranslateScope`），否则贴着纸面边缘的图形平移出块边界会被裁掉。
- ⚠️ 标尺让位规则（`.drawio-ruler-on`）作用于 **`.drawio-canvas-scroll`**（不是 `.drawio-graph-container`），否则页面视图下只推动块本身、滚动条仍压在标尺下面。
- `.drawio-panel-rail`（v0.13.0）固定 300px、`position:relative`，内含 `.drawio-diagram-panel`（「绘图」）与 `.drawio-format-panel`（格式）两个 `position:absolute; inset:0` 的兄弟节点，靠 `.drawio-collapsed`（`display:none`）互斥。⚠️ 旧的 `margin-right:-300px` 滑出方案在轨道内失效；`.drawio-panel-rail > .drawio-collapsed` 必须排在 `.drawio-panel-rail > .drawio-format-panel` **之后**（同 0,2,0，靠顺序取胜）。
- 页面栏放在 `.drawio-canvas-area` 内，宽度天然等于画布区宽（左起形状面板右缘、右抵格式面板左缘）。`.drawio-wrapper` 不能再写 `height:100%`，否则顶出容器。

## 页面视图 = 页面尺寸 1:1 预览（v0.16.0，语义修正）
- **语义**：不是「留白开关」，而是**按页面尺寸 1:1 渲染纸面**（所见即所得）。100% 缩放时 A4 竖向 = 827×1169 px（96dpi 真实像素，= draw.io 纸面）。纸面通常比视口大，**靠滚动查看**。
- 用户明确否决了 v0.15.0 的「四周留白」可调滑块（伪需求）。⚠️ 教训：不要为「看起来像」的视觉现象发明可调参数，先问清这个现象的**语义**（它代表什么真实量）。
- 实现要点：
  - `applyPageViewLayout()`：`container.style.width/height = round(页面单位 × view.scale)` px（开）/ `100%`（关）。
  - 静态常量 `PAGE_MARGIN = 40`：滚动视口 padding，纯视觉留白 + 可平移缓冲，**不给用户调**。
  - `syncCanvasTranslateScope(on)`：写视口 padding + svg `overflow:visible`。
  - `lastPagesCfg`（`纸型|宽x高|朝向`）在 `applySettings()` 里比对，变化时 `requestAnimationFrame(() => scrollCanvasToOrigin())` 滚到纸面左上角（滚 `PAGE_MARGIN`，越界自动夹到最大滚动量）。放 `applySettings` 而非 `applyPageViewLayout`，是为了同时覆盖「自定义宽高的步进按钮」这类纸型不变但尺寸变了的场景。
  - mxGraph 自有纸面层**始终关闭**（`graph.pageVisible = false`，容器即纸面）；`pageFormat` 仍按纸型维护；`pageScale` 必须是 1（默认 1.5 是打印预留）。

## 多页 / 页面栏（v0.12.0）
- 存储：一个 `.drawio` = 一个 `<mxfile>`，每页一个 `<diagram name id>`，页内容是**未压缩**的 `<mxGraphModel>` 文本（draw.io 双端可读，无需 deflate 回写）。
- 视图状态：`pages: {id,name,xml}[]` + `activePage`；非活动页的模型只以字符串躺在 `pages[i].xml`。
- 切页三步：`captureActivePage()` → `loadPageIntoGraph(i)` → `pageBar.render()`。
- `loadPageIntoGraph` 必做：`model.clear()` 重建干净模型（否则上一页 cell id 残留冲突）→ `codec.decode(node, model)` → `graph.clearSelection()` → `undoManager.clear()`（撤销栈跨页会串味）。全程 `suppressDirty=true` 包住，否则切页触发自动保存。
- ⚠️ 关键 API：`mxGraphModel.prototype.clear = function(){ this.setRoot(this.createRoot()); }`；mxGraph 自带 `mxGraphModel` 专用 codec，其 `decodeRoot` 结尾会 `setRoot(rootCell)`，所以 decode 是替换 root 而非挂到旧 root 上。
- 解析三种写法（`extractModelXml`）：① mxGraphModel 是 `<diagram>` 子元素（此时 `diagramNode.textContent` 是**空串**，不能只看 textContent）；② 未压缩但被转义成文本（textContent 含 `<`）；③ 压缩格式（不含 `<` → `decompressDrawio`）。
- ⚠️ 排序坑：拖拽重排算插入位时，候选矩形本就排除了被拖页签，`slot` 已等价于「splice 掉源元素后要插入的下标」，**不能再做 `if (slot > from) slot--` 补偿**（会让「拖到最右却没动」）。
- 数据安全：`loadError` 标志。解析失败时给空白页但**禁止自动保存**（`markDirty` 提前 return、`cleanup` 加 `!loadError` 守卫），否则会把用户原文件覆盖成空 mxfile；手动保存不受限。
- 删除页后的 activePage 修正：删前面的页只 `-1`（画布不重载）；删当前页 `min(index, len-1)` + 重载；删后面的页不动。

## 右侧两个面板
- **格式面板（FormatPanel）**：v0.11.2 起**没有头部**（`.drawio-fmt-tabs`（样式/文本/排列）就是第一行，i18n 的 `format.title/collapse/close` 已删除，别再加）。显隐由 `selectionModel` CHANGE 驱动：有选中 → `show(cells)`，空选中 → `hide()`；同一监听还负责两面板互斥（`diagramPanelEl.classList.toggle("drawio-collapsed", hasSelection)`）。底部 `.drawio-fmt-bottom` 只在「样式」Tab 显示。
- **绘图面板（DrawPanel，v0.13.0）**：与 FormatPanel 同构（原生 DOM + `h()` helper，复用 `.drawio-fmt-*` 类名）。新增类：`.drawio-panel-rail` / `.drawio-diagram-panel` / `.drawio-fmt-group-title` / `.drawio-fmt-group-body` / `.drawio-fmt-grow` / `.drawio-fmt-btn(.active)` / `.drawio-fmt-help` / `.drawio-fmt-radios(.radio)` / `.drawio-fmt-colorbox` / `.drawio-fmt-colorswatch` / `.drawio-fmt-pencil` / `.drawio-fmt-spin(-btn)` / `.drawio-fmt-hidden-color`。
- 分组标题（查看 / 选项 / 页面尺寸）**不可折叠、无箭头**，用 `border-top` 分隔（`:first-child` 去掉）；与可折叠的 `.drawio-fmt-section` 是两套东西。
- 面板经 `DrawPanelHost` 回调视图：`getSettings / patchSettings / editPageData / clearDefaultStyle / applyStyleToPage / getPageStyle`。样式类操作用 `model.filterDescendants(c => model.isVertex(c))` 取当前页所有顶点。
- 12 个设置项全在**全局 `plugin.settings`**：`gridSize / gridColor / pageView / pageSizePreset / pageWidth / pageHeight / pageOrientation / backgroundEnabled / backgroundColor / connectionArrows / connectionPoints / guides`；`main.ts` 的 `loadSettings` 逐项兜底 + 钳制。

## 视图菜单与浮动工具窗（v0.14.0）
- 工具栏**最左**是「视图」按钮（`.drawio-toolbar-btn.drawio-toolbar-viewbtn`）。菜单自绘 DOM（`src/ViewMenu.ts`，挂 `document.body`、`position: fixed`，module 级 `activeMenu` 保证同时只开一个；勾选后**不关菜单**，原地重渲染）。7 项全实现：形状 / 格式 / 标尺 / 查找替换 / 图层 / 标签 / 缩略图。**菜单里不显示任何快捷键**（用户明确要求，也没绑定）。
- 勾选状态 = `plugin.settings` 的 7 个布尔：`viewShapesPalette / viewPanelRail / viewRuler / viewFind / viewLayers / viewTags / viewMinimap`（默认前三 true、后四 false）。
- `DrawioView.applyViewSettings()` 是唯一落点（幂等）：形状/格式给 `.drawio-palette` + `.drawio-palette-resize` / `.drawio-panel-rail` 加**已有的** `.drawio-hidden`（`display:none !important`，别重复定义）；标尺走 `ruler.setVisible()`；四个工具窗走 `syncToolPanel(panel, want)`。最后统一 `resizeGraphToContainer()`。
- `src/FloatingPanel.ts` 是**可复用浮动工具窗基类**（查找替换/图层/标签/缩略图共用）：标题栏拖动 + 右下 `.drawio-toolwin-grip` 缩放 + `ResizeObserver` 钳位（拖动时至少留 48px 可见）+ 几何写 `settings.panelGeometry[id] = {x,y,w,h}`。宿主接口只有 `getGeometry/setGeometry`。⚠️ 未拖动过的面板不落盘几何，每次按 `defaultX/defaultY`（可为 `"right"`/`"bottom"`）重算 → 有意为之。
- 标尺：绝对定位覆盖在 `.drawio-canvas-area`（该类为此加了 `position:relative`）上，打开时给画布容器加 `margin:20px 0 0 20px`、给 `.drawio-pagebar` 加 `margin-left:20px`。竖标尺 `bottom:34px`（= `--drawio-pagebar-h`）。刻度自适应：候选 `[1,2,5,10,20,25,50,100,200,250,500,1000,2000,5000]` 取第一个 `step*scale>=60px`，次刻度 = step/5（屏幕 <6px 不画）。
- 图层：定义存 `settings.layers`（**默认层不在数组里**，id 为 `""`），cell 归属靠**样式键 `drawioLayer=<id>`**（跟着文件走）。显隐用 `model.setVisible`，锁定用五个样式键。面板**顶层在上**（倒序遍历），上移/下移改完数组要按「从后往前依次插到下标 0」重排子节点（`reorderCells`），顺序没变就不动模型。删除**两步确认**（3 秒内再点一次），连带删除层内图形。新建图形自动打上「当前图层」（`addShape` 里 `assignLayer` + `applyLayerState`）。
- 标签：样式键 `drawioTags`，多标签用 `|` 分隔。⚠️ 写入前必须 sanitize 掉 `;` `,`（会破坏样式串解析）与 `|`（分隔符本身）。
- 查找替换：命中后要**自己算 translate** 把目标移到视口中心（容器 `overflow:hidden` 没有滚动条，`scrollCellToVisible` 无效）。
- 缩略图：自绘 canvas，内容/纸面/视口矩形**全在「容器像素」坐标系**里算（`px = scale*(模型坐标+translate)`），点/拖时换算回模型坐标再 `view.scaleAndTranslate`。
- `applySettings()` 会调 `applyViewSettings()`，所以任何设置变更都会重算一次视图（含 `sizeDidChange()`）——开销可接受，但要知道。

## mxGraph 4.2.2 能力边界（查证结论）
- **不存在**：`mxGraphModel` 上的 `grid / pageWidth / pageHeight / guides / shadow` 属性（原型上只有树结构方法）→ `<mxGraphModel pageWidth=...>` 这类 XML 属性在 `captureActivePage` 重新 encode 时本来就会丢，画布级设置只能放插件 settings，**没有按页持久化的落点**。同理不存在 `setPageVisible / setPageFormat / connectionArrowsEnabled / connectionPointsEnabled / pageBreaksVisible / setCellsStyles / resetDefaultVertexStyle`。
- 存在：`graph.pageVisible` / `pageFormat`（默认 `PAGE_FORMAT_A4_PORTRAIT`）/ `pageScale`（**默认 1.5**）/ `guidesEnabled` / `gridSize` / `gridEnabled` / `mxGraphHandler.prototype.guidesEnabled`（默认 false）/ `mxConstraintHandler.prototype.enabled`。
- 页面渲染链：`pageVisible=true` + `pageFormat` → `view.validateBackground()` → `validateBackgroundPage()` 用 `getBackgroundPageBounds()`（`pageFormat.width * scale * pageScale`）建 `mxRectangleShape`。
- ⚠️ 默认纸面 `new mxRectangleShape(bounds,"white","black")` 且 `isShadow=!0`，白色会盖住容器 CSS 网格。修法：在 view **实例**上覆写 `createBackgroundPageShape = b => new mxRectangleShape(b,"none","#8a8f98")`（实例属性遮蔽原型、不影响别的 view），`validateBackground()` 之后再 `view.backgroundPageShape.isShadow = false` + `redraw()`（父函数在 create 之后才赋 isShadow，必须事后改）。填充 `none` 不影响框选：鼠标手势监听挂在 **container** 上，事件冒泡即可。
- 「连接箭头 / 连接点 / 参考线」的真实落点：连接点 → `graph.connectionHandler.constraintHandler.enabled`；参考线 → `graph.graphHandler.guidesEnabled`；连接箭头 → `getStylesheet().getDefaultEdgeStyle()` 的 `endArrow`（`ARROW_CLASSIC` / delete），即作用于新建连线。
- 轮廓面板 `mxOutline` 存在但不要用（见「锁定/显隐/容器」）。
- 毫米 → 页面单位：`Math.round(mm / 25.4 * 100)`（draw.io「1 英寸 = 100 单位」，A4 210×297mm → 827×1169）。
- 形状面板拖拽**弃用原生 HTML5 DnD**（原生拖拽位图在本 Electron 构建五轮均失败），改 pointer 事件自建；自建拖拽**切勿 `setPointerCapture`**（会让 pointerup 派生的 click 误触发「点击添加」）。
- 画布导航：Ctrl+滚轮以鼠标为锚点缩放（普通滚轮不动）；平移 = Ctrl+左键(仅空白) / 空格+左键 / 中键 / Ctrl+Shift 拖拽（v0.11.0 起右键拖拽已移除，让给上下文菜单）。关键：构造默认禁用 panning（`setPanning(true)` 启用）、wrap `isPanningTrigger`、wheel 必须 `{passive:false}`（否则 Ctrl+滚轮会缩放整个 Obsidian 界面）、锚点缩放用 `view.scaleAndTranslate` 一次事务。
- ⚠️ 覆写 `mxRubberband.isActive` **绝对不能返回 false** —— `mouseUp` 先调 `isActive()` 再决定是否 `execute()`，返回 false 会直接阻断选择（v0.8.0~0.8.3「框选不选中」的统一根因）。修法：`isActive` 始终 return true，淡出判定另存字段、在 `reset` 覆写里生效。
- 框选是「相交即选中」，自实现 `collectIntersecting(rect)` —— 该 mxClient **无** `getCellsWithinArea`；`getCells` 第 7 参数虽说是相交矩形但**只处理顶点、不含连线**。
