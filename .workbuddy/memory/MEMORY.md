# 项目记忆

> Obsidian 插件 obsidian-drawio-editor（id: `drawio-editor`）。当前 v0.16.7。
> 跨会话成立的事实与踩坑结论；逐次改动见 `.workbuddy/memory/YYYY-MM-DD.md`。

## 技术栈与工作流
- TypeScript + esbuild，依赖 mxgraph 4.2.2（`src/mxClient.min.js`，打包进产物）+ pako。
- 改完代码必须：跑 tsc → 跑 esbuild 生产构建 → 同步升三处版本号（manifest.json / package.json / versions.json）。
- 用户自行把构建产物（main.js / styles.css / manifest.json）拷进 vault；未经明确要求不 `git commit`。

## 本机构建 / 校验
- 用 Bash + 托管 node 绝对路径，PATH 里没有 npm/npx：
  - 类型检查：`"C:/Users/hellokunzai/.workbuddy/binaries/node/versions/22.22.2-3/node.exe" node_modules/typescript/bin/tsc -noEmit -skipLibCheck`
  - 构建：`".../node.exe" esbuild.config.mjs --production`
- Bash 缺 `dirname/head/tail/ls/wc/git` 等命令，但 node/python 本身正常返回 exit code。
- 校验中文文案：esbuild minify 把非 ASCII 转成 `\uXXXX`，先用 `main.js.replace(/\\u([0-9a-fA-F]{4})/g, …)` 反转义再 `includes()`。
- 看截图取证：无 PIL，用 `python -m venv` + `pip install pillow` 逐像素扫描。

## CSS 铁律
- 上色用具体 hex / rgba（draw.io 蓝 `#167dff` + `rgba(22,125,255,0.12)`），不要依赖 `var(--interactive-accent)` / `color-mix`（Electron 作用域可能失效）。
- 覆盖 mxClient 默认类（如 `.mxRubberband`）务必补 `position: absolute`、`pointer-events: none`。
- 覆盖 Obsidian 自带规则注意特异性，别指望加载顺序。
- **给插件自绘 `<button>` 定样式时，单个类名 (0,1,0) 一定不够。** Obsidian app.css 里有
  `button:not(.clickable-icon) { color: var(--text-color); background-color: var(--interactive-normal); box-shadow: var(--input-shadow); }`
  ＝ (0,1,1)，会整条盖掉你的「透明底」。表现就是按钮变成「主题灰底 + 1px 内描边实心方块」。
  双保险：① 选择器提权到 (0,2,0)——祖先层级稳定的用父级前缀（`.drawio-pagebar .drawio-pagebar-menu`），
  挂 body 且可拖动的浮动面板用**重复类名**（`.drawio-layers-btn.drawio-layers-btn`）；
  ② 给按钮挂 Obsidian 自己的 `clickable-icon` 类，让那条规则直接不匹配（顺带白拿 ribbon 的 `--icon-color` + `--icon-opacity` 观感）。
  `<div>` 造的「按钮」没有这个问题，只有真 `<button>` 会。
- **这个坑永远是一片不是一个：改完必须跑全量扫描。** 点对点修已被证伪三次（先漏工具栏 12 个，
  再漏全仓 11 个类，又漏掉右侧面板整个 `drawio-fmt-*` 家族 7 个类）。
  现成脚本（通用，项目根跑，退出码 0 = 通过）：
  `node C:/Users/hellokunzai/.workbuddy/skills/obsidian-plugin-dev/scripts/scan-button-specificity.js`
- **扫描必须覆盖项目里所有建按钮的写法，只扫 `createEl("button")` 必漏。** 本仓有两套：
  Obsidian 封装 `createEl("button", {cls})`（DrawioView / PageBar / 各浮动面板）和
  本地 helper `h("button", "cls", text)`（`DrawPanel.ts` / `FormatPanel.ts`，内部是 `document.createElement`）。
  新增 UI 文件时先确认它属于哪一套。
- 注意 Obsidian 的默认规则**只设 `background-color / color / box-shadow`，不设 `border`**。
  所以插件自己写的 `border: 1px solid …` 是会生效的 → 渲染成「主题灰底 + 一圈硬边框 + 内描边」三重 chrome。
  改用原生按钮皮时（面板类按钮）要显式补 `border: none; box-shadow: none; appearance: none;`，
  底色用 `--interactive-normal` → hover `--interactive-hover` → 按下 `--background-modifier-active-hover`。
  纯图标按钮走另一套：`--icon-color` / `--icon-opacity` / `--background-modifier-hover`。
- 判断该「提权保留原设计」还是「改成原生按钮皮」：看原始规则**有没有显式写 `background` / `border`**。
  写了 = 有设计意图，提权保留（查找/图层/标签/弹窗按钮）；没写 = 本想透明/无框，提权后要显式补透明。
- `clickable-icon` 只给**纯图标按钮**挂；文字按钮不要挂（那是图标专用类，会带来 `padding` 与 `--icon-color`）。
- 提权后**基础类会压过自己的组合类**（`.btn` 提到 (0,2,0) 后 `.btn-text` 的 (0,1,0) 失效），
  组合类要一起提权；`:hover` / `.is-active` 本身算 (0,2,0)，与提权后的基础规则同分，**必须写在后面**。
- 提权是「把控制权还给按钮自己」，不是「统一刷成透明」：有边框有底色的按钮（查找、图层、标签、弹窗）
  提权后应保持各自的 `--background-primary` + 1px 边框。
- 排查手法：`%APPDATA%\obsidian\obsidian-<版本>.asar` 可以直接当 latin1 字符串读，
  正则 `/([^{}\n]{0,200}button[^{}\n]{0,120})\{([^{}]{0,500}interactive-normal[^{}]{0,300})\}/g` 能捞出原文，
  比猜主题快得多（asar 头部就是 JSON，app.css 明文在里面）。
- 主题取色可从截图反推：本项目用户用 **Catppuccin（Latte/Mocha）** —— base `#eff1f5` / mantle `#e6e9ef` /
  surface0 `#ccd0da` / text `#4c4f69` / overlay 系 `#6c6f85`。截图里出现这几个值基本就能确定主题。
- 无 PIL 时看截图：纯 `python -c` + `zlib` 手写 PNG 解码（filter type 0~4 逐行还原），
  做「按色距离分类的 ASCII 图」+ 逐像素扫描，足够判断按钮有没有底色/描边、边界落在哪个 x。
- 写「修复前 / 修复后」对照原型（`prototypes/*.html`）的两个硬要求：
  ① 必须把 `button:not(.clickable-icon)` 那条规则**抄进原型的 `<style>`**，否则左侧看起来是好的；
  ② 用 `.before :where(.my-btn) { 原始声明 }` 给左侧**还原真实特异性 (0,1,0)** ——
  直接写 `.before .my-btn` 会抬到 (0,2,0) 反而压过 Obsidian 规则，左侧就坏不掉了。
  组合类要写成 `:where(.my-btn).active`（`:where()` 会把参数内全部特异性归零）。

## 视图铺满叶子
- Obsidian `.workspace-leaf-content .view-content` 默认有 padding（尤其下 32px），插件容器 `height:100%` 只拿到内容盒高度 → 四周露白。
- 修法（已在 styles.css）：`(0,3,0)` 选择器把内边距清零、overflow 改 hidden。

## mxGraph 坐标语义
- `state.x/y/width/height` 是**容器像素坐标**：`state.x = scale*(translate.x + origin.x)`。
- `getCellAt` / `getCells` / `mxUtils.intersects(rect, state)` / 框选矩形，入参一律是容器像素。
- 只有需要图坐标（给 `insertVertex` 用）才换算：`graphX = px/scale - translate.x`，等价 `graph.getPointForEvent(evt)`。
- clientX/clientY → 容器像素用 `mxUtils.convertPoint(container, clientX, clientY)`。

## 图形分组
- v0.16.2 起形状面板分组统一为：便笺本（Scratchpad）、通用（General）、杂项（Misc）、高级（Advanced）。
- 分组定义在 `src/shapes.ts#getAllShapeCategories()`；标题翻译在 `src/i18n/index.ts`。
- 便笺本内容为动态收藏，渲染逻辑在 `src/DrawioView.ts`。
