import { FileView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import DrawioPlugin from "./main";
import {
  initMxGraph,
  mxGraph,
  mxUtils,
  mxCodec,
  mxEvent,
  mxConstants,
  mxRubberband,
  mxRectangle,
  mxKeyHandler,
  mxUndoManager,
  mxImage,
  mxConnectionConstraint,
  mxPoint,
} from "./mxgraph-setup";
import { getAllShapeCategories, getShapeLabel, ShapeDef } from "./shapes";
import { loadAllStencils } from "./stencil-loader";
import { MIN_PALETTE_WIDTH, MAX_PALETTE_WIDTH } from "./settings";
import { inflate } from "pako";
import { t, tOr } from "./i18n";

export const VIEW_TYPE_DRAWIO = "drawio-editor-view";
/** 自绘流程图图标 id，在 main.ts 的 onload 里通过 addIcon 注册 */
export const DRAWIO_ICON_ID = "drawio-diagram";

export class DrawioView extends FileView {
  plugin: DrawioPlugin;
  private graph: any = null;
  private undoManager: any = null;
  private paletteEl: HTMLElement | null = null;
  private graphContainer: HTMLElement | null = null;
  private isDirty = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private dragGhost: HTMLElement | null = null;
  private paletteDrag: {
    shape: ShapeDef;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null = null;
  private paletteDragMove: ((e: PointerEvent) => void) | null = null;
  private paletteDragUp: ((e: PointerEvent) => void) | null = null;
  private paletteDragCancel: (() => void) | null = null;
  private suppressPaletteClick = false;

  constructor(leaf: WorkspaceLeaf, plugin: DrawioPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DRAWIO;
  }

  getDisplayText(): string {
    return this.file?.basename ?? t("view.displayText");
  }

  getIcon(): string {
    return DRAWIO_ICON_ID;
  }

  async onLoadFile(file: TFile): Promise<void> {
    initMxGraph();
    loadAllStencils();
    this.buildUI();
    this.initGraphEditor();
    await this.loadDiagram(file);
  }

  async onUnloadFile(): Promise<void> {
    this.cleanup();
  }

  async onClose(): Promise<void> {
    this.cleanup();
  }

  private buildUI(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("drawio-editor-container");

    const wrapper = container.createDiv({ cls: "drawio-wrapper" });

    // Palette sidebar（宽度读取设置，可用右缘把手拖拽调整）
    this.paletteEl = wrapper.createDiv({ cls: "drawio-palette" });
    this.paletteEl.style.width = `${this.plugin.settings.paletteWidth}px`;
    this.buildPalette(this.paletteEl);

    // 面板右缘拖拽把手
    const resizeHandle = wrapper.createDiv({ cls: "drawio-palette-resize" });
    this.makePaletteResizable(resizeHandle);

    // Main area
    const mainArea = wrapper.createDiv({ cls: "drawio-main" });
    this.buildToolbar(mainArea);
    this.graphContainer = mainArea.createDiv({ cls: "drawio-graph-container" });
  }

  /**
   * 面板右缘拖拽调整宽度：pointer 事件自建拖拽（与项目拖拽风格一致），
   * 拖动结束时把宽度写回设置持久化；grid 用 auto-fill，列数随宽度自适应。
   */
  private makePaletteResizable(handle: HTMLElement): void {
    handle.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      const palette = this.paletteEl;
      if (!palette) return;

      const startX = e.clientX;
      const startWidth = palette.getBoundingClientRect().width;
      // 拖拽中禁止页面文本选中，并把光标钉在 col-resize 上
      document.body.addClass("drawio-palette-resizing");

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        const w = Math.min(
          MAX_PALETTE_WIDTH,
          Math.max(MIN_PALETTE_WIDTH, startWidth + ev.clientX - startX)
        );
        palette.style.width = `${Math.round(w)}px`;
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        document.body.removeClass("drawio-palette-resizing");
        if (this.paletteEl) {
          this.plugin.settings.paletteWidth = Math.round(
            this.paletteEl.getBoundingClientRect().width
          );
          void this.plugin.saveSettings();
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    });
  }

  private buildPalette(parent: HTMLElement): void {
    const categories = getAllShapeCategories();

    // 搜索框：跨分组过滤形状（sticky 吸顶，不随列表滚动）
    const searchWrap = parent.createDiv({ cls: "drawio-palette-search" });
    const searchInput = searchWrap.createEl("input", {
      cls: "drawio-palette-search-input",
      attr: { type: "text", placeholder: t("palette.searchPlaceholder") },
    });

    const resetSearch = () => {
      searchInput.value = "";
      this.filterPalette("");
    };
    searchInput.addEventListener("input", () => this.filterPalette(searchInput.value));
    searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
      // 输入框里的 Escape 只清搜索，不冒泡给 Obsidian（避免误关面板）
      if (e.key === "Escape" && searchInput.value !== "") {
        e.stopPropagation();
        resetSearch();
      }
    });

    // 无匹配时的提示，filterPalette 控制显隐
    parent.createDiv({ cls: "drawio-palette-no-results drawio-hidden", text: t("palette.noResults") });

    for (const category of categories) {
      const section = parent.createDiv({ cls: "drawio-palette-section" });
      const header = section.createEl("button", { cls: "drawio-palette-header", attr: { type: "button" } });
      header.createEl("span", {
        cls: "drawio-palette-arrow",
        text: "▾",
      });
      header.createEl("span", { cls: "drawio-palette-title", text: tOr(`shapeCategory.${category.key}`, category.title) });

      const grid = section.createDiv({ cls: "drawio-palette-grid" });

      header.addEventListener("click", () => {
        const isCollapsed = section.hasClass("drawio-palette-section-collapsed");
        if (isCollapsed) {
          section.removeClass("drawio-palette-section-collapsed");
        } else {
          section.addClass("drawio-palette-section-collapsed");
        }
      });

      for (const shape of category.shapes) {
        const item = grid.createDiv({ cls: "drawio-palette-item" });
        item.setAttribute("data-shape-id", shape.id);
        item.setAttribute("title", getShapeLabel(shape));

        // SVG icon via innerHTML
        item.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${shape.icon}"/></svg>`;

        this.makeShapeDraggable(item, shape);

        item.addEventListener("click", () => {
          // 拖拽落点恰好在面板项上时会接着触发 click，吞掉一次避免误添加
          if (this.suppressPaletteClick) {
            this.suppressPaletteClick = false;
            return;
          }
          this.addShapeAtCenter(shape);
        });
      }
    }
  }

  /**
   * 按关键字过滤形状面板：匹配 i18n 名称 / 英文名 / 形状 id（不区分大小写）。
   * 搜索时隐藏无匹配的分组，含匹配项的分组强制展开（加 filtered 类，不破坏
   * 用户原有的折叠状态）；清空后全部恢复。
   */
  private filterPalette(query: string): void {
    if (!this.paletteEl) return;
    const q = query.trim().toLowerCase();
    const categories = getAllShapeCategories();
    const sections = Array.from(
      this.paletteEl.querySelectorAll<HTMLElement>(".drawio-palette-section")
    );
    let anyMatch = false;

    sections.forEach((section, i) => {
      const category = categories[i];
      if (!category) return;
      let sectionHasMatch = false;

      for (const item of Array.from(
        section.querySelectorAll<HTMLElement>(".drawio-palette-item")
      )) {
        const shapeId = item.getAttribute("data-shape-id") ?? "";
        const shape = category.shapes.find((s) => s.id === shapeId);
        const hit =
          q === "" ||
          shapeId.toLowerCase().includes(q) ||
          (shape !== undefined &&
            (getShapeLabel(shape).toLowerCase().includes(q) ||
              shape.name.toLowerCase().includes(q)));
        item.toggleClass("drawio-hidden", !hit);
        if (hit) sectionHasMatch = true;
      }

      section.toggleClass("drawio-hidden", q !== "" && !sectionHasMatch);
      section.toggleClass("drawio-palette-section-filtered", q !== "" && sectionHasMatch);
      if (sectionHasMatch) anyMatch = true;
    });

    const noResults = this.paletteEl.querySelector<HTMLElement>(".drawio-palette-no-results");
    noResults?.toggleClass("drawio-hidden", q === "" || anyMatch);
  }

  /**
   * 面板图形拖拽：不用浏览器原生 HTML5 DnD——其拖拽位图在 Obsidian/Electron 里
   * 会退回为「面板项截图」（带圆角灰底），setDragImage 无法可靠覆盖。
   * 改为 pointer 事件自建拖拽：跟随光标的只有一个透明底的 SVG 轮廓，
   * 且天然兼容移动端触摸。
   */
  private makeShapeDraggable(el: HTMLElement, shape: ShapeDef): void {
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this.beginPaletteDrag(e, shape);
    });
  }

  private beginPaletteDrag(e: PointerEvent, shape: ShapeDef): void {
    this.endPaletteDrag(); // 清理可能残留的上一轮拖拽
    this.paletteDrag = {
      shape,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    };

    this.paletteDragMove = (ev: PointerEvent) => this.onPaletteDragMove(ev);
    this.paletteDragUp = (ev: PointerEvent) => this.onPaletteDragEnd(ev);
    this.paletteDragCancel = () => this.endPaletteDrag();

    // 注意不做 setPointerCapture：捕获后 pointerup 无论落在哪都会向源元素派生 click，
    // 会把「拖到画布」误判成「点击面板项」而在画布中心多加一个图形。
    document.addEventListener("pointermove", this.paletteDragMove);
    document.addEventListener("pointerup", this.paletteDragUp);
    document.addEventListener("pointercancel", this.paletteDragCancel);
  }

  private onPaletteDragMove(e: PointerEvent): void {
    const drag = this.paletteDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;

    if (!drag.dragging) {
      // 超过阈值才算拖拽，否则留给 click（点击 = 添加到画布中心）
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) < DrawioView.DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      this.createDragGhost(drag.shape);
    }
    this.positionDragGhost(e.clientX, e.clientY);
  }

  private onPaletteDragEnd(e: PointerEvent): void {
    const drag = this.paletteDrag;
    this.endPaletteDrag();
    if (!drag || !drag.dragging) return; // 未构成拖拽，按点击处理

    this.suppressPaletteClick = true;

    if (!this.graph || !this.graphContainer) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || !this.graphContainer.contains(target)) return;

    // getPointForEvent 读取 clientX/clientY 并已做网格吸附，PointerEvent 同样适用
    const pt = this.graph.getPointForEvent(e);
    // 以鼠标为中心落点，与 draw.io 行为一致
    this.addShape(drag.shape, pt.x - drag.shape.width / 2, pt.y - drag.shape.height / 2);
  }

  private endPaletteDrag(): void {
    if (this.paletteDragMove) {
      document.removeEventListener("pointermove", this.paletteDragMove);
      this.paletteDragMove = null;
    }
    if (this.paletteDragUp) {
      document.removeEventListener("pointerup", this.paletteDragUp);
      this.paletteDragUp = null;
    }
    if (this.paletteDragCancel) {
      document.removeEventListener("pointercancel", this.paletteDragCancel);
      this.paletteDragCancel = null;
    }
    this.paletteDrag = null;
    this.removeDragGhost();
  }

  /**
   * 拖拽跟随层：只含图形轮廓的 SVG，容器透明、pointer-events:none，
   * 用 transform 跟随光标，光标压在图形正中心。
   */
  private createDragGhost(shape: ShapeDef): void {
    this.removeDragGhost();

    const size = DrawioView.DRAG_GHOST_SIZE;
    const ghost = document.body.createDiv({ cls: "drawio-drag-ghost" });
    ghost.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${shape.icon}"/></svg>`;

    this.dragGhost = ghost;
  }

  private positionDragGhost(clientX: number, clientY: number): void {
    if (!this.dragGhost) return;
    const half = DrawioView.DRAG_GHOST_SIZE / 2;
    this.dragGhost.style.transform = `translate(${clientX - half}px, ${clientY - half}px)`;
  }

  private removeDragGhost(): void {
    this.dragGhost?.remove();
    this.dragGhost = null;
  }

  private addShape(shape: ShapeDef, x: number, y: number): void {
    const parent = this.graph.getDefaultParent();
    const isEdge = shape.id.startsWith("edge-");

    if (isEdge) {
      this.graph.getModel().beginUpdate();
      try {
        const e1 = this.graph.insertVertex(parent, null, t("shape.edgeSource"), x, y, 60, 30, "rounded=1;whiteSpace=wrap;html=1;");
        const e2 = this.graph.insertVertex(parent, null, t("shape.edgeTarget"), x + 120, y + 80, 60, 30, "rounded=1;whiteSpace=wrap;html=1;");
        this.graph.insertEdge(parent, null, "", e1, e2, shape.style);
      } finally {
        this.graph.getModel().endUpdate();
      }
    } else {
      this.graph.getModel().beginUpdate();
      try {
        this.graph.insertVertex(parent, null, getShapeLabel(shape), x, y, shape.width, shape.height, shape.style);
      } finally {
        this.graph.getModel().endUpdate();
      }
    }

    this.markDirty();
  }

  private addShapeAtCenter(shape: ShapeDef): void {
    if (!this.graph) return;
    const scale = this.graph.view.scale;
    const rect = this.graphContainer!.getBoundingClientRect();
    const cx = rect.width / 2 / scale - this.graph.view.translate.x;
    const cy = rect.height / 2 / scale - this.graph.view.translate.y;
    this.addShape(shape, cx - shape.width / 2, cy - shape.height / 2);
  }

  private buildToolbar(parent: HTMLElement): void {
    const toolbar = parent.createDiv({ cls: "drawio-toolbar" });

    interface ToolBtn {
      id?: string;
      icon?: string;
      title?: string;
      action?: () => void;
      sep?: boolean;
    }

    const btns: ToolBtn[] = [
      { id: "undo", icon: "rotate-ccw", title: t("toolbar.undo"), action: () => this.undo() },
      { id: "redo", icon: "rotate-cw", title: t("toolbar.redo"), action: () => this.redo() },
      { sep: true },
      { id: "zoomIn", icon: "zoom-in", title: t("toolbar.zoomIn"), action: () => this.graph?.zoomIn() },
      { id: "zoomOut", icon: "zoom-out", title: t("toolbar.zoomOut"), action: () => this.graph?.zoomOut() },
      { id: "fit", icon: "maximize", title: t("toolbar.fit"), action: () => this.graph?.fit() },
      { id: "reset", icon: "minimize", title: t("toolbar.resetZoom"), action: () => this.graph?.zoomActual() },
      { sep: true },
      { id: "delete", icon: "trash", title: t("toolbar.delete"), action: () => this.deleteSelected() },
      { id: "clear", icon: "file-minus", title: t("toolbar.clear"), action: () => this.clearCanvas() },
      { sep: true },
      { id: "export", icon: "download", title: t("toolbar.export"), action: () => this.exportSVG() },
      { id: "save", icon: "save", title: t("toolbar.save"), action: () => this.saveDiagram() },
    ];

    for (const btn of btns) {
      if (btn.sep) {
        toolbar.createDiv({ cls: "drawio-toolbar-sep" });
        continue;
      }
      const el = toolbar.createEl("button", { cls: "drawio-toolbar-btn", attr: { title: btn.title || "" } });
      el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${this.getIconSvg(btn.icon || "")}</svg>`;
      el.addEventListener("click", (e) => {
        e.preventDefault();
        btn.action?.();
      });
    }
  }

  private getIconSvg(icon: string): string {
    const icons: Record<string, string> = {
      "rotate-ccw": '<path d="M3 2v6h6"/><path d="M3 8a9 9 0 1 0 3-7.7L3 8"/>',
      "rotate-cw": '<path d="M21 2v6h-6"/><path d="M21 8a9 9 0 1 1-3-7.7L21 8"/>',
      "zoom-in": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
      "zoom-out": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>',
      maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
      minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
      trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      "file-minus": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 13h6"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    };
    return icons[icon] || "";
  }

  private initGraphEditor(): void {
    if (!this.graphContainer) return;

    const MxGraph = mxGraph();
    const MxEvent = mxEvent();
    const MxRubberband = mxRubberband();
    const MxUndoManager = mxUndoManager();

    this.graph = new MxGraph(this.graphContainer);

    // Editing features
    this.graph.setCellsEditable(true);
    this.graph.setConnectable(true);
    this.graph.setCellsMovable(true);
    this.graph.setCellsResizable(true);
    this.graph.setCellsSelectable(true);
    this.graph.setDropEnabled(true);
    this.graph.setMultigraph(true);
    this.graph.setAllowDanglingEdges(false);
    this.graph.setDisconnectOnMove(false);
    this.graph.setHtmlLabels(true);

    // Hover connect arrows: four direction handles on each vertex
    this.setupHoverConnectArrows();

    // Rubber-band selection
    this.setupRubberbandSelection();

    // Keyboard handler
    const KeyHandler = mxKeyHandler();
    new KeyHandler(this.graph);

    // Undo manager
    this.undoManager = new MxUndoManager();
    const undoListener = (sender: any, evt: any) => {
      this.undoManager.undoableEditHappened(evt.getProperty("edit"));
      this.markDirty();
    };
    this.graph.getModel().addListener(MxEvent.NOTIFY, undoListener);
    this.graph.getView().addListener(MxEvent.UNDO, undoListener);

    // Auto-save tracking
    this.graph.getModel().addListener(MxEvent.CHANGE, () => {
      this.markDirty();
    });

    // 自定义网格层需要跟随缩放 / 平移重算偏移
    const view = this.graph.getView();
    const syncGrid = () => this.updateGridBackground();
    for (const evtName of [
      MxEvent.SCALE,
      MxEvent.SCALE_AND_TRANSLATE,
      MxEvent.TRANSLATE,
      MxEvent.RESET,
    ]) {
      if (evtName) view.addListener(evtName, syncGrid);
    }

    // 面板到画布的拖放由 pointer 事件自建拖拽处理（见 makeShapeDraggable），
    // 不再使用原生 dragover/drop。

    this.graph.popupMenuHandler.autoExpand = true;
    this.graph.zoomActual();
    this.setupCanvasNavigation();
    this.applyTheme();
    this.applySettings();
  }

  /**
   * 画布导航交互（对齐 draw.io 习惯）：
   * - Ctrl+滚轮：以鼠标位置为锚点缩放（触摸板双指缩放派发的 wheel 自带 ctrlKey，同样生效）
   * - Ctrl+左键拖拽（空白处）/ 空格+左键拖拽 / 中键拖拽 / 右键拖拽 / Ctrl+Shift+拖拽：平移画布
   * - 空白处左键拖拽：框选（mxRubberband，保持原状）
   */
  private setupCanvasNavigation(): void {
    if (!this.graph || !this.graphContainer) return;

    const container = this.graphContainer;
    const graph: any = this.graph;
    const MxEvent = mxEvent();

    // 启用平移：右键拖拽与 Ctrl+Shift+拖拽是 mxPanningHandler 原生触发键
    graph.setPanning(true);

    const panningHandler = graph.panningHandler;

    // 补充中键拖拽、Ctrl+左键拖拽（仅空白处）平移，保留原生触发键。
    // Ctrl+左键限定空白处：按在图形上时保留 mxGraph 默认的 Ctrl 多选/拖动图形
    const originalIsPanningTrigger = panningHandler.isPanningTrigger;
    panningHandler.isPanningTrigger = function (me: any) {
      const evt = me.getEvent();
      return (
        originalIsPanningTrigger.apply(this, arguments) ||
        MxEvent.isMiddleMouseButton(evt) ||
        (MxEvent.isControlDown(evt) &&
          MxEvent.isLeftMouseButton(evt) &&
          me.getState() == null)
      );
    };

    // 平移进行中把光标钉在 grabbing 上（中键/右键/空格拖拽统一反馈）
    graph.addListener(MxEvent.PAN_START, () => container.addClass("drawio-panning"));
    graph.addListener(MxEvent.PAN_END, () => container.removeClass("drawio-panning"));

    // 空格按住进入平移模式：左键拖拽（即使按在图形上）都变成平移
    const setPanMode = (on: boolean) => {
      // ignoreCell 让平移优先于拖动图形；useLeftButtonForPanning 让左键拖空白触发平移
      panningHandler.useLeftButtonForPanning = on;
      panningHandler.ignoreCell = on;
      container.toggleClass("drawio-pan-ready", on);
    };
    this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      // 鼠标悬停在画布上才接管空格，避免干扰 Obsidian 其他面板
      if (!container.matches(":hover")) return;
      // 正在编辑图形文本时，空格照常输入
      if (typeof graph.isEditing === "function" && graph.isEditing()) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      e.preventDefault();
      setPanMode(true);
    });
    this.registerDomEvent(document, "keyup", (e: KeyboardEvent) => {
      if (e.code === "Space") setPanMode(false);
    });
    // 窗口失焦兜底退出平移模式（如按住空格时切走窗口）
    this.registerDomEvent(window, "blur", () => setPanMode(false));

    // 滚轮：仅 Ctrl+滚轮缩放。passive:false 才能 preventDefault
    // （不拦的话 Ctrl+滚轮会缩放整个 Obsidian 界面）
    this.registerDomEvent(
      container,
      "wheel",
      (e: WheelEvent) => this.handleCanvasWheel(e),
      { passive: false }
    );
  }

  /**
   * 左键框选（对齐 draw.io 的选中矩形效果）。
   *
   * 坐标约定（来自 mxRubberband 源码）：repaint 里 div 的 left/top 直接等于
   * this.x / this.y，这两个值是「容器本地像素坐标」——已扣除容器滚动与 panDx，
   * 但还没有除 scale。而 getCells 要的是「图坐标」。所以这里在 execute / repaint
   * 里统一反投影：graphX = px / scale - translate.x。
   *
   * 判定语义：**相交即选中**（只要框选矩形碰到/压住图形/连线就选中），而非
   * draw.io 默认的「完全包含才选中」。否则鼠标从形状旁边起框、只框到一半时，
   * 形状整块没被包进去就不会被选中，体验不符合直觉。
   */
  private setupRubberbandSelection(): void {
    if (!this.graph) return;

    const graph: any = this.graph;
    const MxRubberband = mxRubberband();
    const MxRectangle = mxRectangle();
    const MxUtils = mxUtils();
    const MxConstants = mxConstants();

    const rubberband = new MxRubberband(graph);

    // 容器本地像素坐标 → 图坐标
    const pxToGraph = (px: number, py: number) => {
      const view = graph.getView();
      const s = view.scale || 1;
      const t = view.translate || { x: 0, y: 0 };
      return { x: px / s - t.x, y: py / s - t.y };
    };

    // 由 rubberband 当前的 this.x/width（容器像素）推出图坐标矩形
    const currentRegion = () => {
      const tl = pxToGraph(rubberband.x, rubberband.y);
      const br = pxToGraph(
        rubberband.x + rubberband.width,
        rubberband.y + rubberband.height
      );
      return new MxRectangle(
        Math.min(tl.x, br.x),
        Math.min(tl.y, br.y),
        Math.abs(br.x - tl.x),
        Math.abs(br.y - tl.y)
      );
    };

    // 收集与给定矩形「相交」的所有图形/连线（含旋转、可见性过滤）。
    // 用 mxUtils.intersects 做相交判定，而不是 getCells 的严格包含，
    // 这样只要框选矩形碰到图形就会被选中。
    const collectIntersecting = (rect: any): any[] => {
      const parent = graph.getDefaultParent();
      console.log('[RB collect] parent=', parent?.id, 'childCount=', parent ? graph.getModel().getChildCount(parent) : 'N/A');
      const result: any[] = [];
      const visit = (cell: any) => {
        const model = graph.getModel();
        const cnt = model.getChildCount(cell);
        for (let i = 0; i < cnt; i++) {
          const child = model.getChildAt(cell, i);
          const state = graph.view.getState(child);
          if (state && graph.isCellVisible(child)) {
            let bb: any = state;
            const rot =
              MxUtils.getValue(state.style, MxConstants.STYLE_ROTATION) || 0;
            if (rot !== 0) bb = MxUtils.getBoundingBox(state, rot);
            const hits = MxUtils.intersects(rect, bb);
            console.log('[RB collect] child:', child?.id || child?.value, 'state=',
              state ? `${state.x},${state.y} ${state.width}x${state.height}` : 'null',
              'intersects=', hits);
            if (hits) result.push(child);
          } else {
            console.log('[RB collect] child:', child?.id || child?.value,
              'skipped: state=', !!state, 'visible=', graph.isCellVisible(child));
          }
          visit(child);
        }
      };
      if (parent) visit(parent);
      else console.log('[RB collect] WARNING: parent is null!');
      return result;
    };

    // mouseUp：选中所有与框选矩形相交的图形/连线（替换当前选择）
    rubberband.execute = function (evt?: any) {
      console.log('[RB execute] start, this.x=', this.x, 'this.y=', this.y, 'this.w=', this.width, 'this.h=', this.height);
      if (this.x == null || this.y == null) { console.log('[RB execute] early return: x/y null'); return; }
      const rect = currentRegion();
      console.log('[RB execute] region:', rect?.x, rect?.y, rect?.width, rect?.height);
      const raw = collectIntersecting(rect);
      console.log('[RB execute] collectIntersecting returned', raw.length, 'cells:', raw.map((c: any) => c.id || c.value));
      const cells = raw.filter((c: any) => graph.isCellSelectable(c));
      console.log('[RB execute] after isCellSelectable filter:', cells.length, 'cells');
      try {
        this.graph.setSelectionCells(cells);
        console.log('[RB execute] setSelectionCells done, selection=', this.graph.getSelectionCells()?.map((c: any) => c.id || c.value));
      } catch(e) {
        console.error('[RB execute] setSelectionCells threw:', e);
      }
    };

    // 拖拽途中实时算出「真正会被选中」的图形数量，给矩形加粗作为反馈
    const originalRepaint = rubberband.repaint;
    rubberband.repaint = function () {
      originalRepaint.apply(this, arguments);
      if (!this.div || this.first == null) return;
      const rect = currentRegion();
      const hits = collectIntersecting(rect);
      if (hits && hits.length > 0) {
        this.div.classList.add("mxRubberband-preview");
        // 只在命中数变化时打日志，避免刷屏
        (this as any)._lastHitCount !== hits.length && (console.log('[RB repaint] hits=', hits.length), (this as any)._lastHitCount = hits.length);
      } else {
        this.div.classList.remove("mxRubberband-preview");
        (this as any)._lastHitCount !== 0 && (console.log('[RB repaint] hits=0'), (this as any)._lastHitCount = 0);
      }
    };

    // 淡出控制：只在框接近铺满画布时才走 200ms 淡出动画；
    // 小框选松手后立即消失，否则选中结果像「延迟出现」。
    // ⚠️ 注意：不得影响 isActive 的真值（mouseUp 靠它决定是否调用 execute），
    //       所以淡出判断只用于 reset 内部的 fadeOut 分支，不在这里拦截。
    const prevIsActive = rubberband.isActive;
    rubberband.isActive = function () {
      // 始终透传原始真假值，保证 execute 正常触发
      const active = prevIsActive.apply(this, arguments);
      if (!active) return false;
      // 额外记录「是否该淡出」到实例上，供覆写的 reset 读取
      const container = graph.container as HTMLElement;
      const w = container.clientWidth || 0;
      const h = container.clientHeight || 0;
      if (w <= 0 || h <= 0 || !this.div) return true;
      const nearW =
        this.width >= w - DrawioView.RUBBERBAND_FADE_EDGE ||
        this.width / w >= DrawioView.RUBBERBAND_FADE_RATIO;
      const nearH =
        this.height >= h - DrawioView.RUBBERBAND_FADE_EDGE ||
        this.height / h >= DrawioView.RUBBERBAND_FADE_RATIO;
      (this as any)._shouldFade = nearW && nearH;
      return true; // 永远返回 true，不让淡出逻辑阻断 select
    };

    // 覆写 reset：根据 _shouldFade 决定是否走淡出（原始 reset 读 this.fadeOut，
    // 我们在这里临时把它改成和 _shouldFade 一致）
    const originalReset = rubberband.reset;
    rubberband.reset = function () {
      if (this.div) {
        const shouldFade = (this as any)._shouldFade === true;
        // 临时覆盖 fadeOut 让原始 reset 走正确的分支
        const origFadeOut = this.fadeOut;
        this.fadeOut = shouldFade;
        originalReset.apply(this, arguments);
        this.fadeOut = origFadeOut;
      } else {
        originalReset.apply(this, arguments);
      }
    };
  }

  /**
   * 悬停方向箭头：鼠标悬停在图形上时，在四周显示上/下/左/右四个蓝色圆点箭头，
   * 点击并拖拽即可从对应方向创建连线。效果对齐图片中的 draw.io 风格。
   */
  private setupHoverConnectArrows(): void {
    if (!this.graph) return;

    const MxImage = mxImage();
    const MxConnectionConstraint = mxConnectionConstraint();
    const MxPoint = mxPoint();
    const MxGraph = mxGraph();
    const consts = mxConstants();

    // 让整个单元格都可触发连接高亮（默认 0.5 只中心区域）
    consts.DEFAULT_HOTSPOT = 1;

    // 四个方向的连接约束点：上 / 右 / 下 / 左
    const originalGetAllConnectionConstraints =
      MxGraph.prototype.getAllConnectionConstraints;
    this.graph.getAllConnectionConstraints = (state: any, source: boolean) => {
      if (!state || !this.graph?.isCellConnectable(state.cell)) return null;
      // 优先保留 stencil 自带的连接约束；没有时才用默认四个方向
      const original = originalGetAllConnectionConstraints.call(
        this.graph,
        state,
        source
      );
      if (original && original.length > 0) return original;
      return [
        new MxConnectionConstraint(new MxPoint(0.5, 0), true), // top
        new MxConnectionConstraint(new MxPoint(1, 0.5), true), // right
        new MxConnectionConstraint(new MxPoint(0.5, 1), true), // bottom
        new MxConnectionConstraint(new MxPoint(0, 0.5), true), // left
      ];
    };

    // 为每个方向约束点渲染不同的箭头图标
    const arrowSvgs = this.buildConnectArrowSvgs();
    const ch = this.graph.connectionHandler.constraintHandler;
    const originalGetImage = ch.getImageForConstraint.bind(ch);
    ch.getImageForConstraint = (state: any, constraint: any, point: any) => {
      const p = constraint.point as { x: number; y: number };
      let key: "top" | "right" | "bottom" | "left" = "top";
      if (p.x === 0 && p.y === 0.5) key = "left";
      else if (p.x === 1 && p.y === 0.5) key = "right";
      else if (p.x === 0.5 && p.y === 0) key = "top";
      else if (p.x === 0.5 && p.y === 1) key = "bottom";

      const cached = arrowSvgs[key];
      if (cached) return new MxImage(cached, 18, 18);
      return originalGetImage(state, constraint, point);
    };

    // 拖拽到空白处时自动创建目标节点，与 draw.io 行为一致
    this.graph.connectionHandler.setCreateTarget(true);
  }

  /**
   * 生成四个方向（上/右/下/左）的连接箭头图标 base64 data URI。
   * 每个图标为 18x18 的蓝色圆点 + 白色向外箭头。
   */
  private buildConnectArrowSvgs(): Record<"top" | "right" | "bottom" | "left", string> {
    const toDataUri = (svg: string) => "data:image/svg+xml;base64," + btoa(svg);
    return {
      top: toDataUri(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="#4dabf7" stroke="#ffffff" stroke-width="1.5"/><path d="M9 10V6M7 7l2-2 2 2" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      ),
      right: toDataUri(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="#4dabf7" stroke="#ffffff" stroke-width="1.5"/><path d="M8 9h4M11 7l2 2-2 2" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      ),
      bottom: toDataUri(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="#4dabf7" stroke="#ffffff" stroke-width="1.5"/><path d="M9 8v4M7 11l2 2 2-2" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      ),
      left: toDataUri(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="#4dabf7" stroke="#ffffff" stroke-width="1.5"/><path d="M10 9H6M7 7l-2 2 2 2" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      ),
    };
  }

  private handleCanvasWheel(e: WheelEvent): void {
    if (!this.graph || !this.graphContainer) return;
    // 只接管 Ctrl+滚轮（含触摸板双指缩放），普通滚轮放行默认行为
    if (!e.ctrlKey) return;
    e.preventDefault();

    const view = this.graph.getView();
    const rect = this.graphContainer.getBoundingClientRect();
    // deltaMode=1 是按行（Firefox 鼠标），按每行约 33px 折算
    const deltaY = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;

    // Ctrl+滚轮：以鼠标位置为锚点缩放
    const factor = Math.exp(-deltaY * DrawioView.WHEEL_ZOOM_SENSITIVITY);
    const newScale = Math.min(
      DrawioView.ZOOM_MAX,
      Math.max(DrawioView.ZOOM_MIN, view.scale * factor)
    );
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // 缩放前鼠标指向的图坐标
    const gx = sx / view.scale - view.translate.x;
    const gy = sy / view.scale - view.translate.y;
    // 缩放并平移补偿，让 (gx, gy) 仍落在鼠标位置
    view.scaleAndTranslate(newScale, sx / newScale - gx, sy / newScale - gy);
  }

  /** 应用用户设置：网格显示、新建连线的默认走线方式 */
  applySettings(): void {
    if (!this.graph) return;

    const settings = this.plugin.settings;
    const consts = mxConstants();

    this.graph.setGridEnabled(settings.showGrid);
    this.graph.setGridSize(DrawioView.GRID_SIZE);
    this.updateGridBackground();

    const edgeStyle = this.graph.getStylesheet().getDefaultEdgeStyle();
    if (settings.defaultEdgeStyle === "straight") {
      edgeStyle[consts.STYLE_EDGE] = null;
      edgeStyle[consts.STYLE_ROUNDED] = false;
    } else {
      edgeStyle[consts.STYLE_EDGE] = consts.EDGESTYLE_ORTHOGONAL;
      edgeStyle[consts.STYLE_ROUNDED] = true;
    }

    this.graph.refresh();
  }

  applyTheme(): void {
    if (!this.graph) return;

    const isDark = document.body.hasClass("theme-dark");
    const bgColor = isDark ? "#1e1e1e" : "#ffffff";
    const textColor = isDark ? "#dcddde" : "#333333";

    this.graph.container.style.backgroundColor = bgColor;
    this.graph.container.style.color = textColor;

    const stylesheet = this.graph.getStylesheet();
    const consts = mxConstants();
    const defaults = stylesheet.getDefaultVertexStyle();
    defaults[consts.STYLE_FONTCOLOR] = textColor;
    // 图形默认透明填充 + 深灰描边，对齐 draw.io 默认风格
    defaults[consts.STYLE_FILLCOLOR] = "none";
    defaults[consts.STYLE_STROKECOLOR] = isDark ? "#6272a4" : "#333333";

    const edgeDefaults = stylesheet.getDefaultEdgeStyle();
    edgeDefaults[consts.STYLE_STROKECOLOR] = isDark ? "#6272a4" : "#333333";
    edgeDefaults[consts.STYLE_FONTCOLOR] = textColor;

    this.updateGridBackground();
    this.graph.refresh();
  }

  private static readonly GRID_SIZE = 10;
  /** 画布缩放上下限：10% – 800% */
  private static readonly ZOOM_MIN = 0.1;
  private static readonly ZOOM_MAX = 8;
  /** Ctrl+滚轮缩放灵敏度：newScale = oldScale * exp(-delta * 该值)，值越大每格缩放越猛 */
  private static readonly WHEEL_ZOOM_SENSITIVITY = 0.0015;
  /** 拖拽位图（图形轮廓）的正方形边长，单位 px */
  private static readonly DRAG_GHOST_SIZE = 32;
  /** 指针移动超过该距离才判定为拖拽，否则按点击处理，单位 px */
  private static readonly DRAG_THRESHOLD_PX = 4;
  /** 框选矩形铺满画布容器后才允许淡出，短边小于该值直接瞬间移除，单位 px */
  private static readonly RUBBERBAND_FADE_EDGE = 260;
  /** 框选矩形铺满画布容器后才允许淡出，覆盖面积占比达到该值即可 */
  private static readonly RUBBERBAND_FADE_RATIO = 0.6;

  /**
   * mxClient 里的 gridSize 只参与吸附计算，本身不绘制网格，
   * 所以这里用两层 linear-gradient 在容器背景上画一层跟随缩放 / 平移的网格。
   */
  private updateGridBackground(): void {
    if (!this.graph || !this.graphContainer) return;

    const container = this.graphContainer;
    // 容器被折叠 / 面板重排时宽度会变成 0，此时先撤掉网格，等布局稳定再画
    if (!this.plugin.settings.showGrid || !container.clientWidth) {
      container.style.backgroundImage = "none";
      container.style.backgroundSize = "";
      container.style.backgroundPosition = "";
      return;
    }

    const view = this.graph.getView();
    const scale = view.scale || 1;
    const size = Math.max(4, DrawioView.GRID_SIZE * scale);
    const offsetX = (((view.translate.x * scale) % size) + size) % size;
    const offsetY = (((view.translate.y * scale) % size) + size) % size;
    const line = document.body.hasClass("theme-dark")
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.08)";

    container.style.backgroundImage =
      `linear-gradient(to right, ${line} 1px, transparent 1px), ` +
      `linear-gradient(to bottom, ${line} 1px, transparent 1px)`;
    container.style.backgroundSize = `${size}px ${size}px`;
    container.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }

  private async loadDiagram(file: TFile): Promise<void> {
    if (!this.graph) return;

    try {
      const content = await this.app.vault.read(file);
      if (!content.trim()) return;

      const MxUtils = mxUtils();
      const MxCodec = mxCodec();
      const doc = MxUtils.parseXml(content);

      let graphModelNode = null;
      const diagramNode = doc.getElementsByTagName("diagram")[0];

      if (diagramNode) {
        const modelContent = (diagramNode.textContent || "").trim();
        if (modelContent && !modelContent.includes("<")) {
          // Compressed format — decode
          try {
            const decoded = this.decompressDrawio(modelContent);
            const decodedDoc = MxUtils.parseXml(decoded);
            graphModelNode = decodedDoc.getElementsByTagName("mxGraphModel")[0];
          } catch {
            graphModelNode = doc.getElementsByTagName("mxGraphModel")[0];
          }
        } else {
          graphModelNode = doc.getElementsByTagName("mxGraphModel")[0];
        }
      } else {
        graphModelNode = doc.getElementsByTagName("mxGraphModel")[0];
      }

      if (graphModelNode) {
        const codec = new MxCodec(graphModelNode.ownerDocument);
        codec.decode(graphModelNode, this.graph.getModel());
      }
    } catch (err) {
      console.error("Error loading diagram:", err);
      new Notice(t("notice.loadFailed") + (err as Error).message);
    }
  }

  /**
   * Decompress draw.io compressed diagram (URL-encoded base64 + raw deflate)
   */
  private decompressDrawio(compressed: string): string {
    // Step 1: URL decode
    let urlDecoded = compressed;
    try {
      urlDecoded = decodeURIComponent(compressed);
    } catch {
      // keep original
    }

    // Step 2: base64 decode
    const binary = atob(urlDecoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Step 3: raw inflate via pako
    const decompressed = inflate(bytes, { raw: true });
    return new TextDecoder().decode(decompressed);
  }

  private markDirty(): void {
    this.isDirty = true;

    // 关掉自动保存时只标记脏数据，等用户点工具栏的保存按钮
    if (!this.plugin.settings.autoSave) return;

    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      void this.saveDiagram();
    }, this.plugin.settings.autoSaveDelay);
  }

  private async saveManually(): Promise<void> {
    const ok = await this.saveDiagram();
    if (ok) new Notice(t("notice.saved"));
  }

  private async saveDiagram(): Promise<boolean> {
    if (!this.graph || !this.file) return false;

    try {
      const MxUtils = mxUtils();
      const MxCodec = mxCodec();

      const encoder = new MxCodec();
      const node = encoder.encode(this.graph.getModel());
      const modelXml = MxUtils.getXml(node);

      const name = this.escapeXmlAttr(this.file.basename);
      const id = this.escapeXmlAttr(this.file.path);
      const content = `<mxfile host="obsidian-drawio-editor" modified="${new Date().toISOString()}" version="${this.plugin.manifest.version}">\n  <diagram name="${name}" id="${id}">\n${modelXml}\n  </diagram>\n</mxfile>`;

      await this.app.vault.modify(this.file, content);
      this.isDirty = false;
      return true;
    } catch (err) {
      console.error("Save error:", err);
      new Notice(t("notice.saveFailed") + (err as Error).message);
      return false;
    }
  }

  private escapeXmlAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private undo(): void {
    if (!this.undoManager) return;
    this.undoManager.undo();
  }

  private redo(): void {
    if (!this.undoManager) return;
    this.undoManager.redo();
  }

  private deleteSelected(): void {
    if (!this.graph) return;
    this.graph.removeCells();
    this.markDirty();
  }

  private clearCanvas(): void {
    if (!this.graph) return;
    const parent = this.graph.getDefaultParent();
    const cells = this.graph.getChildCells(parent);
    if (cells.length === 0) return;

    this.graph.getModel().beginUpdate();
    try {
      this.graph.removeCells(cells, true);
    } finally {
      this.graph.getModel().endUpdate();
    }
    this.markDirty();
  }

  private exportSVG(): void {
    if (!this.graph) return;
    const MxUtils = mxUtils();

    const background = document.body.hasClass("theme-dark") ? "#1e1e1e" : "#ffffff";
    const svgRoot = this.graph.getSvg(background, 1, 0, undefined, undefined, background);

    const svg = MxUtils.getXml(svgRoot);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (this.file?.basename ?? "diagram") + ".svg";
    a.click();
    URL.revokeObjectURL(url);
    new Notice(t("notice.svgExported"));
  }

  private cleanup(): void {
    // 自动保存关闭时不强行写盘，避免出现"没点保存却被改了文件"的意外
    if (this.plugin.settings.autoSave && this.isDirty) {
      void this.saveDiagram();
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.endPaletteDrag();
    if (this.graph) {
      this.graph.destroy();
      this.graph = null;
    }
    this.undoManager = null;
    this.paletteEl = null;
    this.graphContainer = null;
  }
}
