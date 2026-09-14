/**
 * mxGraph Engine Loader
 *
 * Loads mxGraph (the open-source graph library that draw.io is built on)
 * into the Obsidian plugin context. mxGraph is NOT draw.io — it's the
 * standalone rendering engine (Apache 2.0). We bundle it directly,
 * with zero dependency on the draw.io application/service.
 */

// The mxClient.min.js source is imported as a raw string via esbuild
import mxClientSource from "./mxClient.min.js";

declare global {
  interface Window {
    mxClient: any;
    mxGraph: any;
    mxGraphModel: any;
    mxGraphView: any;
    mxEditor: any;
    mxUtils: any;
    mxEvent: any;
    mxCodec: any;
    mxConstants: any;
    mxEdgeHandler: any;
    mxVertexHandler: any;
    mxGraphHandler: any;
    mxConnectionHandler: any;
    mxToolbar: any;
    mxStencilRegistry: any;
    mxStencil: any;
    mxStylesheetCodec: any;
    mxDefaultToolbarCodec: any;
    mxShape: any;
    mxConnectionConstraint: any;
    mxPoint: any;
    mxRectangle: any;
    mxCellRenderer: any;
    mxDefaultPopupMenu: any;
    mxDefaultToolbar: any;
    mxGraphSelectionModel: any;
    mxRubberband: any;
    mxGuide: any;
    mxStackLayout: any;
    mxHierarchicalLayout: any;
    mxCompactTreeLayout: any;
    mxOutline: any;
    mxPanningHandler: any;
    mxMultiplicity: any;
    mxDragSource: any;
    mxUndoManager: any;
    mxUndoableEdit: any;
    mxConstraintHandler: any;
    mxCellHighlight: any;
    mxCellState: any;
    mxMouseEvent: any;
    mxSvgCanvas2D: any;
    mxXmlRequest: any;
    mxResources: any;
    mxKeyHandler: any;
    mxWindow: any;
    mxImage: any;
    mxEffects: any;
    mxSwimlaneManager: any;
    mxLayoutManager: any;
    mxPrintPreview: any;
  }
}

let initialized = false;

/**
 * Initialize mxGraph by injecting the mxClient source into the global scope.
 * Safe to call multiple times — only initializes once.
 */
export function initMxGraph(): void {
  if (initialized) return;

  // mxGraph expects to run in a browser context with window/document.
  // Obsidian runs in Electron's renderer, so window/document exist.
  // We execute the source in the global scope.
  document.head.createEl("script", {
    attr: { type: "text/javascript" },
    text: mxClientSource,
  });

  // Set mxBasePath to empty — we bundle everything inline
  if (window.mxClient) {
    window.mxClient.basePath = "";
    // Prevent mxGraph from trying to load resources from a server
    window.mxClient.imageBasePath = "";
  }

  // mxGraph 出厂默认给这两个 codec 打开了 allowEval（mxStencil / mxGraphView /
  // mxObjectCodec 出厂就是 false，只剩它们俩）。它们会在解析 XML 时走到
  // mxUtils.eval —— 也就是说一个手工构造过的 .drawio 文件可以借
  // <mxStylesheet> / <mxDefaultToolbar> 里的 <add as="..."> 执行 JS。
  // 本插件从不使用这两个 codec 的表达式能力，直接关掉，零功能影响。
  if (window.mxStylesheetCodec) window.mxStylesheetCodec.allowEval = false;
  if (window.mxDefaultToolbarCodec) window.mxDefaultToolbarCodec.allowEval = false;

  initialized = true;
}

/**
 * Check if mxGraph has been loaded.
 */
export function isMxGraphReady(): boolean {
  return initialized && typeof window.mxGraph === "function";
}

/**
 * Get a reference to an mxGraph global by name.
 */
export function mx<T = any>(name: string): T {
  if (!initialized) {
    throw new Error("mxGraph not initialized. Call initMxGraph() first.");
  }
  return (window as any)[name] as T;
}

// Convenience exports
export const mxGraph = () => window.mxGraph;
export const mxGraphModel = () => window.mxGraphModel;
export const mxUtils = () => window.mxUtils;
export const mxCodec = () => window.mxCodec;
export const mxEvent = () => window.mxEvent;
export const mxConstants = () => window.mxConstants;
export const mxToolbar = () => window.mxToolbar;
export const mxStencilRegistry = () => window.mxStencilRegistry;
export const mxStencil = () => window.mxStencil;
export const mxGraphHandler = () => window.mxGraphHandler;
export const mxConnectionHandler = () => window.mxConnectionHandler;
export const mxRubberband = () => window.mxRubberband;
export const mxKeyHandler = () => window.mxKeyHandler;
export const mxUndoManager = () => window.mxUndoManager;
export const mxPoint = () => window.mxPoint;
export const mxRectangle = () => window.mxRectangle;
export const mxDragSource = () => window.mxDragSource;
export const mxImage = () => window.mxImage;
export const mxConnectionConstraint = () => window.mxConnectionConstraint;
export const mxConstraintHandler = () => window.mxConstraintHandler;
export const mxCellHighlight = () => window.mxCellHighlight;
export const mxGraphView = () => window.mxGraphView;
export const mxCellState = () => window.mxCellState;
export const mxMouseEvent = () => window.mxMouseEvent;
