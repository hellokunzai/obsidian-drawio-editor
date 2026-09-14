import { FloatingPanel, FloatingPanelHost } from "./FloatingPanel";
import { t } from "./i18n";

export type MinimapHost = FloatingPanelHost;

/** 小地图内容四周留白（像素） */
const PADDING = 6;

/**
 * 缩略图（小地图）。
 *
 * 坐标口径：所有几何都取「容器像素」——即 mxCellState 的 x/y/width/height，
 * 满足 px = view.scale * (模型坐标 + view.translate)。这样内容、纸面、
 * 视口矩形都在同一个坐标系里，缩放 / 平移后不用做任何反投影就能对齐。
 * 交互时再换算回模型坐标：模型坐标 = px / scale - translate。
 */
export class MinimapPanel {
  private panel: FloatingPanel;
  private canvasEl!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private graph: any = null;

  /** 上次绘制用的映射参数，供点击时把屏幕坐标换算回容器像素 */
  private map = { scale: 1, offX: 0, offY: 0 };
  private rafId = 0;
  private dragging = false;
  private dragHandler: ((e: PointerEvent) => void) | null = null;
  private upHandler: (() => void) | null = null;

  constructor(parent: HTMLElement, host: MinimapHost, onClose: () => void) {
    this.panel = new FloatingPanel(
      parent,
      {
        id: "minimap",
        title: t("minimap.title"),
        width: 200,
        height: 150,
        defaultX: "right",
        defaultY: "bottom",
        onClose,
      },
      host
    );
    this.build();
  }

  private build(): void {
    // 小地图要铺满窗体，去掉内容区的内边距
    this.panel.body.addClass("drawio-toolwin-body-flush");
    this.canvasEl = this.panel.body.createEl("canvas", {
      cls: "drawio-minimap-canvas",
    });
    this.ctx = this.canvasEl.getContext("2d");

    this.canvasEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      this.dragging = true;
      this.panTo(e);

      this.dragHandler = (ev: PointerEvent) => {
        if (this.dragging) this.panTo(ev);
      };
      this.upHandler = () => {
        this.dragging = false;
        if (this.dragHandler) {
          document.removeEventListener("pointermove", this.dragHandler);
          this.dragHandler = null;
        }
        if (this.upHandler) {
          document.removeEventListener("pointerup", this.upHandler);
          document.removeEventListener("pointercancel", this.upHandler);
          this.upHandler = null;
        }
      };
      document.addEventListener("pointermove", this.dragHandler);
      document.addEventListener("pointerup", this.upHandler);
      document.addEventListener("pointercancel", this.upHandler);
    });

    // 面板被拖动缩放过，画布尺寸可能变了
    this.panel.body.addEventListener("pointerup", () => this.scheduleRender());
  }

  // ------------------------------------------------------------ 对外接口

  setGraph(graph: any): void {
    this.graph = graph;
    if (this.panel.isOpen()) this.scheduleRender();
  }

  open(): void {
    this.panel.show();
    this.scheduleRender();
  }

  close(): void {
    this.panel.hide();
  }

  isOpen(): boolean {
    return this.panel.isOpen();
  }

  toggle(): void {
    if (this.panel.isOpen()) this.close();
    else this.open();
  }

  /** 视图 / 模型变化后请求重绘（合并到下一帧，避免拖拽时每帧多次重算） */
  scheduleRender(): void {
    if (!this.panel.isOpen()) return;
    if (this.rafId) return;
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = 0;
      this.render();
    });
  }

  destroy(): void {
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.upHandler?.();
    this.panel.destroy();
  }

  // ------------------------------------------------------------ 绘制

  /** 按设备像素比调整画布分辨率，避免高 dpi 下发虚 */
  private syncCanvasSize(): { w: number; h: number } {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvasEl.clientWidth;
    const h = this.canvasEl.clientHeight;
    if (this.canvasEl.width !== Math.round(w * dpr)) {
      this.canvasEl.width = Math.round(w * dpr);
    }
    if (this.canvasEl.height !== Math.round(h * dpr)) {
      this.canvasEl.height = Math.round(h * dpr);
    }
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  }

  private render(): void {
    if (!this.graph || !this.ctx) return;
    const { w, h } = this.syncCanvasSize();
    const ctx = this.ctx;
    if (w <= 0 || h <= 0) return;

    ctx.clearRect(0, 0, w, h);

    const container = this.graph.container as HTMLElement | null;
    if (!container) return;
    const view = this.graph.getView();
    const viewScale = view.scale || 1;
    const tx = view.translate.x || 0;
    const ty = view.translate.y || 0;
    const vw = container.clientWidth;
    const vh = container.clientHeight;

    // ---- 收集内容边界（容器像素），并把当前视口矩形一并纳入
    let minX = 0;
    let minY = 0;
    let maxX = vw;
    let maxY = vh;

    const cells = this.collectCells();
    for (const cell of cells) {
      const state = view.getState(cell);
      if (!state || !(state.width > 0 || state.height > 0)) continue;
      minX = Math.min(minX, state.x);
      minY = Math.min(minY, state.y);
      maxX = Math.max(maxX, state.x + state.width);
      maxY = Math.max(maxY, state.y + state.height);
    }

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scale = Math.min(
      (w - PADDING * 2) / contentW,
      (h - PADDING * 2) / contentH
    );
    const offX = (w - contentW * scale) / 2 - minX * scale;
    const offY = (h - contentH * scale) / 2 - minY * scale;
    this.map = { scale, offX, offY };

    const toX = (px: number) => px * scale + offX;
    const toY = (px: number) => px * scale + offY;

    // ---- 纸面（容器像素：纸面从 translate 处开始）
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fillRect(toX(tx * viewScale), toY(ty * viewScale), w, h);

    const pageFormat = this.graph.pageFormat;
    if (this.graph.pageVisible && pageFormat) {
      const pageScale = this.graph.pageScale || 1;
      const pw = pageFormat.width * viewScale * pageScale;
      const ph = pageFormat.height * viewScale * pageScale;
      ctx.fillStyle = "rgba(120, 140, 180, 0.14)";
      ctx.fillRect(toX(tx * viewScale), toY(ty * viewScale), pw * scale, ph * scale);
    }

    // ---- 连线（用两端中心点画直线，小地图上精确到控制点没有意义）
    const model = this.graph.getModel();
    ctx.strokeStyle = "rgba(90, 100, 120, 0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const cell of cells) {
      if (!model.isEdge(cell)) continue;
      const state = view.getState(cell);
      if (!state) continue;
      const srcState = view.getState(model.getTerminal(cell, true));
      const tgtState = view.getState(model.getTerminal(cell, false));
      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;
      if (srcState && tgtState) {
        x1 = srcState.x + srcState.width / 2;
        y1 = srcState.y + srcState.height / 2;
        x2 = tgtState.x + tgtState.width / 2;
        y2 = tgtState.y + tgtState.height / 2;
      } else {
        x1 = state.x;
        y1 = state.y;
        x2 = state.x + state.width;
        y2 = state.y + state.height;
      }
      ctx.moveTo(toX(x1), toY(y1));
      ctx.lineTo(toX(x2), toY(y2));
    }
    ctx.stroke();

    // ---- 图形
    const selected = new Set(this.graph.getSelectionCells() || []);
    for (const cell of cells) {
      if (!model.isVertex(cell)) continue;
      const state = view.getState(cell);
      if (!state) continue;

      const style = this.graph.getCellStyle(cell) || {};
      const fill =
        typeof style.fillColor === "string" ? style.fillColor : "#ffffff";
      const stroke =
        typeof style.strokeColor === "string" ? style.strokeColor : "#333333";

      const x = toX(state.x);
      const y = toY(state.y);
      const rw = Math.max(1, state.width * scale);
      const rh = Math.max(1, state.height * scale);

      ctx.fillStyle = fill === "none" ? "#ffffff" : fill;
      ctx.fillRect(x, y, rw, rh);
      ctx.strokeStyle = selected.has(cell) ? "#167dff" : stroke;
      ctx.lineWidth = selected.has(cell) ? 1.4 : 0.8;
      ctx.strokeRect(x, y, rw, rh);
    }

    // ---- 视口矩形
    ctx.strokeStyle = "#167dff";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(toX(0), toY(0), vw * scale, vh * scale);
    ctx.fillStyle = "rgba(22, 125, 255, 0.08)";
    ctx.fillRect(toX(0), toY(0), vw * scale, vh * scale);
  }

  /** 当前页所有可见的图形与连线 */
  private collectCells(): any[] {
    const model = this.graph.getModel();
    const root = model.getRoot();
    const out: any[] = [];
    const visit = (cell: any) => {
      const count = model.getChildCount(cell);
      for (let i = 0; i < count; i++) {
        const child = model.getChildAt(cell, i);
        if (this.graph.isCellVisible(child)) out.push(child);
        visit(child);
      }
    };
    if (root) visit(root);
    return out;
  }

  /**
   * 把点击位置对应的内容点移到视口中心。
   * 容器像素 px = viewScale * (模型坐标 + translate) ⇒ 模型坐标 = px / viewScale - translate；
   * 要让模型坐标 mc 落在视口中心：translate = 视口尺寸 / 2 / viewScale - mc。
   */
  private panTo(e: PointerEvent): void {
    if (!this.graph) return;
    const container = this.graph.container as HTMLElement | null;
    if (!container) return;

    const rect = this.canvasEl.getBoundingClientRect();
    const mapX = e.clientX - rect.left;
    const mapY = e.clientY - rect.top;

    const px = (mapX - this.map.offX) / this.map.scale;
    const py = (mapY - this.map.offY) / this.map.scale;

    const view = this.graph.getView();
    const viewScale = view.scale || 1;
    const modelX = px / viewScale - view.translate.x;
    const modelY = py / viewScale - view.translate.y;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    view.scaleAndTranslate(
      viewScale,
      cw / 2 / viewScale - modelX,
      ch / 2 / viewScale - modelY
    );
    this.scheduleRender();
  }
}
