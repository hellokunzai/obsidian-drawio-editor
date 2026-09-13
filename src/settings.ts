export type EdgeStyleMode = "orthogonal" | "straight";

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
}

export const DEFAULT_SETTINGS: DrawioSettings = {
  autoSave: true,
  autoSaveDelay: 2000,
  showGrid: true,
  defaultEdgeStyle: "orthogonal",
  paletteWidth: 180,
  scratchpad: [],
};

export const MIN_AUTOSAVE_DELAY = 200;
export const MAX_AUTOSAVE_DELAY = 60000;
export const MIN_PALETTE_WIDTH = 140;
export const MAX_PALETTE_WIDTH = 400;
