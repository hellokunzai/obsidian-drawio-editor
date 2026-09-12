export type EdgeStyleMode = "orthogonal" | "straight";

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
}

export const DEFAULT_SETTINGS: DrawioSettings = {
  autoSave: true,
  autoSaveDelay: 2000,
  showGrid: true,
  defaultEdgeStyle: "orthogonal",
  paletteWidth: 180,
};

export const MIN_AUTOSAVE_DELAY = 200;
export const MAX_AUTOSAVE_DELAY = 60000;
export const MIN_PALETTE_WIDTH = 140;
export const MAX_PALETTE_WIDTH = 400;
