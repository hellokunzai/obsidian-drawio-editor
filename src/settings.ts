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
  /** 是否显示页面视图（按页面尺寸画出纸面外框） */
  pageView: boolean;
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
  pageSizePreset: "210x297",
  pageWidth: 210,
  pageHeight: 297,
  pageOrientation: "portrait",
  backgroundEnabled: false,
  backgroundColor: "#ffffff",
  connectionArrows: true,
  connectionPoints: true,
  guides: true,
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
