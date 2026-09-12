# Draw.io Flowchart Editor

在 Obsidian 中直接编辑和查看 draw.io 图表，无需任何外部依赖或网络请求。

## 功能特性

- 在 Obsidian 内打开 `.drawio` / `.drawio.svg` / `.xml` 文件为可编辑的流程图视图
- 内置形状面板：基础图形、连线、容器、流程图、UML、网络图、图标等分类
- 形状分类支持折叠 / 展开，点击分类标题即可收起或展开
- 工具栏：撤销 / 重做、缩放、适应视图、删除、清空画布、导出 SVG、保存
- 拖拽形状到画布，或双击画布空白处快速创建
- 自动保存，随文件实时写入
- 适配 Obsidian 亮色 / 暗色主题

## 安装

1. 下载最新 Release 中的 `main.js`、`manifest.json`、`styles.css` 三个文件
2. 放入 `<vault>/.obsidian/plugins/drawio-editor/` 目录
3. 在 Obsidian 设置 → 社区插件中启用 **Draw.io Flowchart Editor**

## 使用

- 点击左侧边栏的图表图标，或运行命令 **Create new diagram** 新建图表
- 从右侧形状面板拖拽形状到画布
- 点击工具栏图标进行缩放、导出、保存等操作

## 技术说明

- 基于打包进插件的 mxGraph 渲染引擎（draw.io 的底层库），因此 **无需联网**
- mxGraph 内部使用 `eval` 解析样式表达式，这是库自身行为，非插件代码引入；Obsidian 社区对基于 mxGraph 的插件普遍接受
- `isDesktopOnly: true`，仅在桌面端可用

## 许可证

[MIT](./LICENSE) © hellokunzai
