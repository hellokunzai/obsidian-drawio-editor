export type EdgeStyleMode = "orthogonal" | "straight";

/** 页面朝向（对齐 draw.io 的竖向 / 横向） */
export type PageOrientation = "portrait" | "landscape";

/** 便签本中保存的图形：把选中图形的样式与内容暂存，可随时拖回画布复用 */
export interface ScratchShape {
  /** 完整 mxGraph 样式字符串 */
  style: string;
  /** 图形内容（标签 / 数据），通常为字符串 */
  value: string;
  /** 图形宽度（像素，图坐标） */
  width: number;
  /** 图形高度（像素，图坐标） */
  height: number;
  /** 面板图标（SVG path d 字符串） */
  icon: string;
  /** 是否为连线（决定落回画布时的插入方式） */
  isEdge: boolean;
}

/** 浮动工具窗（查找替换 / 图层 / 标签 / 缩略图）的位置与尺寸 */
export interface PanelGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 图层定义。图层本身不写进 `.drawio` 文件（本版 mxGraphModel 没有图层概念），
 * 存在插件设置里；cell 的归属靠样式键 `drawioLayer=<id>` 标记，
 * 该键会被原样保留在文件里，所以「哪几个图形属于哪一层」是可跨会话还原的。
 */
export interface LayerDef {
  id: string;
  name: string;
  /** 该层是否显示（落到每个 cell 的 `visible` 属性上） */
  visible: boolean;
  /** 该层是否锁定（落到每个 cell 的 movable/resizable/… 样式键上） */
  locked: boolean;
}

/** cell 归属图层的样式键（空 = 默认图层） */
export const DRAWIO_LAYER_STYLE_KEY = "drawioLayer";
/** cell 携带标签的样式键，多个标签用 | 分隔（不能含 ; , =） */
export const DRAWIO_TAGS_STYLE_KEY = "drawioTags";
export const DRAWIO_TAG_SEP = "|";

export interface DrawioSettings {
  /** 停止编辑后自动把改动写回文件 */
  autoSave: boolean;
  /** 自动保存防抖延迟（毫秒） */
  autoSaveDelay: number;
  /** 画布是否绘制背景网格 */
  showGrid: boolean;
  /** 新建连线时的默认走线方式 */
  defaultEdgeStyle: EdgeStyleMode;
  /** 形状面板宽度（像素），拖拽右缘调整并持久化 */
  paletteWidth: number;
  /** 便签本：从右键菜单「添加到便签本」收集的图形，持久化在插件数据中 */
  scratchpad: ScratchShape[];

  // ---- 绘图面板（右侧「绘图」Tab）----
  /** 网格大小（图坐标单位，mxGraph 用它做吸附） */
  gridSize: number;
  /** 网格线颜色（#rrggbb）；空字符串表示跟随明暗主题 */
  gridColor: string;
  /** 是否显示页面视图（按页面尺寸画出纸面，画布收缩并四周留白） */
  pageView: boolean;
  /** 页面视图开启时，画布块四周的留白宽度（像素，四边等距） */
  pagePadding: number;
  /** 页面尺寸预设："210x297" / "148x210" / "297x420" / "216x279" / "custom" */
  pageSizePreset: string;
  /** 页面宽度（毫米），pageSizePreset 为 custom 时由用户直接编辑 */
  pageWidth: number;
  /** 页面高度（毫米） */
  pageHeight: number;
  /** 页面朝向 */
  pageOrientation: PageOrientation;
  /** 画布背景色是否启用（关闭时跟随明暗主题） */
  backgroundEnabled: boolean;
  /** 画布背景色（#rrggbb） */
  backgroundColor: string;
  /** 新建连线是否带箭头 */
  connectionArrows: boolean;
  /** 悬停 / 拖拽时是否显示图形上的连接点 */
  connectionPoints: boolean;
  /** 拖拽时是否显示对齐参考线 */
  guides: boolean;

  // ---- 视图菜单（工具栏最左侧的「视图」按钮）----
  /** 显示左侧形状面板 */
  viewShapesPalette: boolean;
  /** 显示右侧面板轨道（绘图 / 格式） */
  viewPanelRail: boolean;
  /** 显示画布标尺 */
  viewRuler: boolean;
  /** 显示查找/替换工具窗 */
  viewFind: boolean;
  /** 显示图层工具窗 */
  viewLayers: boolean;
  /** 显示标签工具窗 */
  viewTags: boolean;
  /** 显示缩略图工具窗 */
  viewMinimap: boolean;
  /** 各浮动工具窗的位置与尺寸，键为面板 id */
  panelGeometry: Record<string, PanelGeometry>;
  /** 用户自建图层（默认图层不在此列，始终存在于最底层） */
  layers: LayerDef[];
}

export const DEFAULT_SETTINGS: DrawioSettings = {
  autoSave: true,
  autoSaveDelay: 2000,
  showGrid: true,
  defaultEdgeStyle: "orthogonal",
  paletteWidth: 180,
  scratchpad: [],

  gridSize: 10,
  gridColor: "",
  pageView: true,
  pagePadding: 40,
  pageSizePreset: "210x297",
  pageWidth: 210,
  pageHeight: 297,
  pageOrientation: "portrait",
  backgroundEnabled: false,
  backgroundColor: "#ffffff",
  connectionArrows: true,
  connectionPoints: true,
  guides: true,

  viewShapesPalette: true,
  viewPanelRail: true,
  viewRuler: false,
  viewFind: false,
  viewLayers: false,
  viewTags: false,
  viewMinimap: false,
  panelGeometry: {},
  layers: [],
};

export const MIN_AUTOSAVE_DELAY = 200;
export const MAX_AUTOSAVE_DELAY = 60000;
export const MIN_PALETTE_WIDTH = 140;
export const MAX_PALETTE_WIDTH = 400;
/** 网格大小取值范围 */
export const MIN_GRID_SIZE = 1;
export const MAX_GRID_SIZE = 200;
/** 页面尺寸取值范围（毫米） */
export const MIN_PAGE_MM = 10;
export const MAX_PAGE_MM = 5000;
/** 页面视图下画布四周留白的取值范围（像素） */
export const MIN_PAGE_PADDING = 0;
export const MAX_PAGE_PADDING = 240;
/** 浮动工具窗的最小尺寸（像素） */
export const MIN_PANEL_W = 160;
export const MIN_PANEL_H = 90;
