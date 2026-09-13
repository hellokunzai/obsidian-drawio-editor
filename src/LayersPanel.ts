import { Notice } from "obsidian";
import { FloatingPanel, FloatingPanelHost } from "./FloatingPanel";
import {
  DRAWIO_LAYER_STYLE_KEY,
  LayerDef,
} from "./settings";
import { t } from "./i18n";
import { mxUtils } from "./mxgraph-setup";

/** 默认图层的 id（cell 不带 drawioLayer 键即属于它） */
export const DEFAULT_LAYER_ID = "";

/** 锁定一个图形需要写的样式键。
 *  ⚠️ 本版 mxGraph 的 isCellLocked() **不读** 样式里的 locked，只看全局 cellsLocked，
 *  所以 draw.io 那种只写 locked=1 的做法在这里不生效，必须写下面这几个键。 */
const LOCK_STYLE_KEYS = [
  "movable",
  "resizable",
  "rotatable",
  "deletable",
  "editable",
];

export interface LayersHost extends FloatingPanelHost {
  /** 用户自建图层（默认层不在此列） */
  getLayers(): LayerDef[];
  /** 写回插件设置并持久化 */
  saveLayers(layers: LayerDef[]): void;
  /** 图层内容变化后触发自动保存 */
  markDirty(): void;
  getCurrentLayerId(): string;
  setCurrentLayerId(id: string): void;
}

const ICON = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="m3 3 18 18"/><path d="M10.6 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4"/><path d="M6.2 6.3A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4.2-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  unlock:
    '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.5-2"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};

function svg(path: string): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

/**
 * 图层面板。
 *
 * 数据模型：
 * - 图层定义（名称 / 显隐 / 锁定）存在插件设置里 —— 本版 mxGraphModel 没有图层概念，
 *   没法跟页一起写进 `.drawio`。
 * - 图形归属靠样式键 `drawioLayer=<id>` 标记，这个键会被原样保留在文件里，
 *   所以「哪几个图形属于哪一层」是跟着文件走的，跨会话 / 跨设备都能还原。
 * - 显隐用 `mxCell.visible`（写进文件是 `visible="0"`，draw.io 也认），
 *   锁定用 movable/resizable/rotatable/deletable/editable 五个样式键。
 */
export class LayersPanel {
  private panel: FloatingPanel;
  private host: LayersHost;
  private graph: any = null;

  private listEl!: HTMLElement;
  private footerEl!: HTMLElement;
  private btnUp!: HTMLButtonElement;
  private btnDown!: HTMLButtonElement;
  private btnDelete!: HTMLButtonElement;

  /** 双击重命名中的图层 id；非 null 时列表按输入框渲染 */
  private renamingId: string | null = null;
  /** 删除按钮的两步确认态，避免误删整层图形 */
  private pendingDeleteId: string | null = null;
  private pendingDeleteTimer: number | null = null;

  constructor(
    parent: HTMLElement,
    host: LayersHost,
    onClose: () => void
  ) {
    this.host = host;
    this.panel = new FloatingPanel(
      parent,
      {
        id: "layers",
        title: t("layers.title"),
        width: 240,
        height: 260,
        defaultX: "right",
        defaultY: 16,
        onClose,
      },
      host
    );
    this.build();
  }

  private build(): void {
    const body = this.panel.body;
    this.listEl = body.createDiv({ cls: "drawio-layers-list" });

    this.footerEl = body.createDiv({ cls: "drawio-layers-footer" });

    const addBtn = this.footerButton(this.footerEl, ICON.plus, t("layers.add"));
    addBtn.addEventListener("click", () => this.addLayer());

    this.btnUp = this.footerButton(this.footerEl, ICON.up, t("layers.moveUp"));
    this.btnUp.addEventListener("click", () => this.moveLayer(1));

    this.btnDown = this.footerButton(
      this.footerEl,
      ICON.down,
      t("layers.moveDown")
    );
    this.btnDown.addEventListener("click", () => this.moveLayer(-1));

    this.btnDelete = this.footerButton(
      this.footerEl,
      ICON.trash,
      t("layers.delete")
    );
    this.btnDelete.addEventListener("click", () => this.deleteLayer());
  }

  private footerButton(
    parent: HTMLElement,
    icon: string,
    title: string
  ): HTMLButtonElement {
    const btn = parent.createEl("button", {
      cls: "drawio-layers-btn",
      attr: { title, "aria-label": title },
    });
    btn.type = "button";
    btn.innerHTML = svg(icon);
    return btn;
  }

  // ------------------------------------------------------------ 对外接口

  setGraph(graph: any): void {
    this.graph = graph;
    if (this.panel.isOpen()) this.render();
  }

  open(): void {
    this.panel.show();
    this.render();
  }

  close(): void {
    this.clearPendingDelete();
    this.renamingId = null;
    this.panel.hide();
  }

  isOpen(): boolean {
    return this.panel.isOpen();
  }

  toggle(): void {
    if (this.panel.isOpen()) this.close();
    else this.open();
  }

  /** 模型 / 选择 / 切页变化后刷新列表 */
  refresh(): void {
    if (!this.panel.isOpen()) return;
    // 正在行内改名 / 等待删除确认时不要重建 DOM，否则输入框会被打断
    if (this.isEditing()) return;
    this.render();
  }

  destroy(): void {
    this.clearPendingDelete();
    this.panel.destroy();
  }

  /** 当前是否处于「重命名 / 待确认删除」这类编辑态（此时不要被外部刷新打断） */
  isEditing(): boolean {
    return this.renamingId !== null || this.pendingDeleteId !== null;
  }

  // ------------------------------------------------------------ 图层数据

  /** 底 → 顶 的完整顺序：默认层永远在最底，其后是用户图层（数组顺序即绘制顺序） */
  private orderedLayers(): LayerDef[] {
    return [
      { id: DEFAULT_LAYER_ID, name: t("layers.defaultName"), visible: true, locked: false },
      ...this.host.getLayers(),
    ];
  }

  private findLayer(id: string): LayerDef | undefined {
    return this.orderedLayers().find((l) => l.id === id);
  }

  /** 读取 cell 自己声明的图层 id（不带键 = 默认层） */
  private cellLayerId(cell: any): string {
    if (!this.graph) return DEFAULT_LAYER_ID;
    const style = this.graph.getCellStyle(cell);
    const id = style ? style[DRAWIO_LAYER_STYLE_KEY] : null;
    return typeof id === "string" && id ? id : DEFAULT_LAYER_ID;
  }

  /**
   * 某一层的顶层图形。
   * 只认默认父节点的直接子节点：子节点跟随其所在组合的图层，
   * 这样分组不会让同一批图形在两个层里被重复计算。
   */
  private layerCells(layerId: string): any[] {
    if (!this.graph) return [];
    const parent = this.graph.getDefaultParent();
    if (!parent) return [];
    const out: any[] = [];
    for (const cell of this.graph.getChildCells(parent)) {
      if (this.cellLayerId(cell) === layerId) out.push(cell);
    }
    return out;
  }

  /** cell 及其全部后代（分配图层时要一起打标，将来被拆出组合也不会丢归属） */
  private withDescendants(cell: any): any[] {
    const model = this.graph.getModel();
    const out: any[] = [cell];
    const visit = (c: any) => {
      const count = model.getChildCount(c);
      for (let i = 0; i < count; i++) {
        const child = model.getChildAt(c, i);
        out.push(child);
        visit(child);
      }
    };
    visit(cell);
    return out;
  }

  // ------------------------------------------------------------ 渲染

  private render(): void {
    if (!this.graph) return;
    this.listEl.empty();

    const current = this.host.getCurrentLayerId();
    const all = this.orderedLayers();

    // 面板里顶层在上（与 draw.io 的图层面板一致）
    for (let i = all.length - 1; i >= 0; i--) {
      const layer = all[i];
      const isDefault = layer.id === DEFAULT_LAYER_ID;
      const cells = this.layerCells(layer.id);

      const row = this.listEl.createDiv({ cls: "drawio-layers-row" });
      if (layer.id === current) row.addClass("is-current");
      if (this.pendingDeleteId === layer.id) row.addClass("is-pending-delete");

      const eye = row.createEl("button", {
        cls: "drawio-layers-icon",
        attr: {
          title: layer.visible ? t("layers.hide") : t("layers.show"),
          "aria-label": t("layers.visibility"),
        },
      });
      eye.type = "button";
      eye.innerHTML = svg(layer.visible ? ICON.eye : ICON.eyeOff);
      if (!layer.visible) eye.addClass("is-off");
      eye.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleVisibility(layer.id);
      });

      const lock = row.createEl("button", {
        cls: "drawio-layers-icon",
        attr: {
          title: layer.locked ? t("layers.unlock") : t("layers.lock"),
          "aria-label": t("layers.lockState"),
        },
      });
      lock.type = "button";
      lock.innerHTML = svg(layer.locked ? ICON.lock : ICON.unlock);
      if (layer.locked) lock.addClass("is-on");
      lock.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleLock(layer.id);
      });

      if (this.renamingId === layer.id) {
        const input = row.createEl("input", { cls: "drawio-layers-rename" });
        input.type = "text";
        input.value = layer.name;
        window.setTimeout(() => {
          input.focus();
          input.select();
        }, 0);
        const commit = () => {
          const name = input.value.trim();
          this.renamingId = null;
          if (name && name !== layer.name) this.renameLayer(layer.id, name);
          else this.render();
        };
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            this.renamingId = null;
            this.render();
          }
        });
        input.addEventListener("blur", commit);
        input.addEventListener("pointerdown", (e) => e.stopPropagation());
      } else {
        const name = row.createSpan({
          cls: "drawio-layers-name",
          text: layer.name,
        });
        name.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          if (isDefault) return;
          this.renamingId = layer.id;
          this.render();
        });

        row.createSpan({
          cls: "drawio-layers-count",
          text: String(cells.length),
        });

        row.addEventListener("click", () => this.activateLayer(layer.id));
      }

      if (isDefault) row.addClass("is-default");
    }

    this.updateFooter();
  }

  private updateFooter(): void {
    const current = this.host.getCurrentLayerId();
    const isDefault = current === DEFAULT_LAYER_ID;
    const layers = this.host.getLayers();
    const index = layers.findIndex((l) => l.id === current);

    this.btnUp.disabled = isDefault || index < 0 || index === layers.length - 1;
    this.btnDown.disabled = isDefault || index <= 0;
    this.btnDelete.disabled = isDefault || index < 0;

    const pendingDelete = this.pendingDeleteId === current && !isDefault;
    this.btnDelete.toggleClass("is-confirming", pendingDelete);
    this.btnDelete.setAttr(
      "title",
      pendingDelete
        ? t("layers.deleteConfirm")
        : isDefault
        ? t("layers.defaultLocked")
        : t("layers.delete")
    );
  }

  // ------------------------------------------------------------ 图层操作

  /** 点行：设为当前图层，并选中该层全部图形 */
  private activateLayer(id: string): void {
    if (this.graph) {
      const cells = this.layerCells(id);
      if (cells.length > 0) this.graph.setSelectionCells(cells);
      else this.graph.clearSelection();
    }
    this.host.setCurrentLayerId(id);
    this.render();
  }

  private addLayer(): void {
    const layers = this.host.getLayers();
    // 未占用的默认图层名：图层 1 / 图层 2 ……
    const taken = new Set(layers.map((l) => l.name));
    let n = 1;
    while (taken.has(t("layers.layerName", { n: String(n) }))) n++;
    const id = `layer-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    layers.push({ id, name: t("layers.layerName", { n: String(n) }), visible: true, locked: false });
    this.host.saveLayers(layers);
    this.host.setCurrentLayerId(id);
    this.render();
  }

  private renameLayer(id: string, name: string): void {
    const layers = this.host.getLayers();
    const layer = layers.find((l) => l.id === id);
    if (!layer) {
      this.render();
      return;
    }
    layer.name = name;
    this.host.saveLayers(layers);
    this.render();
  }

  /**
   * 上移 / 下移一层。direction = +1 表示在「底→顶」顺序里往上走。
   * 移动完要按新的图层顺序重排模型里的子节点，绘制层次才会真的变。
   */
  private moveLayer(direction: 1 | -1): void {
    const layers = this.host.getLayers();
    const from = layers.findIndex((l) => l.id === this.host.getCurrentLayerId());
    if (from < 0) return;
    const to = from + direction;
    if (to < 0 || to >= layers.length) return;

    const [moved] = layers.splice(from, 1);
    layers.splice(to, 0, moved);
    this.host.saveLayers(layers);
    this.reorderCells();
    this.host.markDirty();
    this.render();
  }

  /**
   * 删除图层（两步确认）。按 draw.io 的语义连带删掉层内图形，
   * 但因为不可撤销地丢数据，这里做成「点两次」而不是弹 Modal。
   */
  private deleteLayer(): void {
    const id = this.host.getCurrentLayerId();
    if (id === DEFAULT_LAYER_ID) return;

    if (this.pendingDeleteId !== id) {
      this.pendingDeleteId = id;
      this.updateFooter();
      this.render();
      this.pendingDeleteTimer = window.setTimeout(() => {
        this.pendingDeleteId = null;
        this.pendingDeleteTimer = null;
        this.render();
      }, 3000);
      return;
    }

    this.clearPendingDelete();

    const cells = this.layerCells(id);
    const model = this.graph.getModel();
    if (cells.length > 0) {
      model.beginUpdate();
      try {
        this.graph.removeCells(cells, true);
      } finally {
        model.endUpdate();
      }
    }

    const layers = this.host.getLayers().filter((l) => l.id !== id);
    this.host.saveLayers(layers);
    this.host.setCurrentLayerId(DEFAULT_LAYER_ID);
    this.host.markDirty();
    this.render();
    new Notice(t("layers.deleted", { count: String(cells.length) }));
  }

  private clearPendingDelete(): void {
    if (this.pendingDeleteTimer !== null) {
      window.clearTimeout(this.pendingDeleteTimer);
      this.pendingDeleteTimer = null;
    }
    this.pendingDeleteId = null;
  }

  private toggleVisibility(id: string): void {
    if (id === DEFAULT_LAYER_ID) {
      // 默认层不给隐藏：隐藏后没有任何层可放新图形
      new Notice(t("layers.defaultLocked"));
      return;
    }
    const layers = this.host.getLayers();
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    layer.visible = !layer.visible;
    this.host.saveLayers(layers);
    this.applyLayerState(layer.id);
    this.host.markDirty();
    this.render();
  }

  private toggleLock(id: string): void {
    const layers = this.host.getLayers();
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    layer.locked = !layer.locked;
    this.host.saveLayers(layers);
    this.applyLayerState(layer.id);
    this.host.markDirty();
    this.render();
  }

  // ------------------------------------------------------------ 落到模型

  /** 把某一层的显隐 / 锁定重放到它的图形上 */
  applyLayerState(id: string): void {
    if (!this.graph) return;
    const layer = this.findLayer(id);
    if (!layer) return;

    const cells = this.layerCells(id);
    if (cells.length === 0) return;

    const model = this.graph.getModel();
    model.beginUpdate();
    try {
      for (const cell of cells) {
        model.setVisible(cell, layer.visible);
        this.setLockStyle(cell, layer.locked);
        for (const child of this.withDescendants(cell)) {
          if (child === cell) continue;
          this.setLockStyle(child, layer.locked);
        }
      }
    } finally {
      model.endUpdate();
    }
  }

  /** 重放全部图层的状态（加载页 / 打开文件后调用，幂等） */
  applyAllLayerStates(): void {
    if (!this.graph) return;
    for (const layer of this.orderedLayers()) {
      this.applyLayerState(layer.id);
    }
  }

  /**
   * 写锁定样式。用 mxUtils.setStyle 先算出目标样式串，只有真的变了才 setStyle，
   * 否则每次打开文件都会产生无谓的模型改动（进而触发自动保存）。
   */
  private setLockStyle(cell: any, locked: boolean): void {
    const model = this.graph.getModel();
    const MxUtils = mxUtils();
    const current: string = model.getStyle(cell) || "";
    let next = current;
    for (const key of LOCK_STYLE_KEYS) {
      next = MxUtils.setStyle(next, key, locked ? "0" : null);
    }
    if (next !== current) model.setStyle(cell, next);
  }

  /** 给指定图形打上图层标记（连同后代） */
  assignLayer(cells: any[], layerId: string): void {
    if (!this.graph || cells.length === 0) return;
    const model = this.graph.getModel();
    const MxUtils = mxUtils();
    const value = layerId || null;

    model.beginUpdate();
    try {
      for (const cell of cells) {
        for (const target of this.withDescendants(cell)) {
          const current: string = model.getStyle(target) || "";
          const next = MxUtils.setStyle(
            current,
            DRAWIO_LAYER_STYLE_KEY,
            value
          );
          if (next !== current) model.setStyle(target, next);
        }
      }
    } finally {
      model.endUpdate();
    }
  }

  /**
   * 按图层顺序重排默认父节点的子节点 —— mxGraph 的绘制层次就是子节点顺序，
   * 所以「上移一层」必须真的重排，否则只是面板上的顺序好看而已。
   * 做法：从后往前依次插到下标 0，最终顺序即目标顺序（稳定，不改同层内相对次序）。
   */
  private reorderCells(): void {
    if (!this.graph) return;
    const model = this.graph.getModel();
    const parent = this.graph.getDefaultParent();
    if (!parent) return;

    const count = model.getChildCount(parent);
    if (count < 2) return;

    const children: any[] = [];
    for (let i = 0; i < count; i++) children.push(model.getChildAt(parent, i));

    const order = this.orderedLayers().map((l) => l.id);
    const rank = new Map(order.map((id, i) => [id, i]));

    const sorted = children
      .map((cell, index) => ({
        cell,
        index,
        rank: rank.get(this.cellLayerId(cell)) ?? 0,
      }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((item) => item.cell);

    // 顺序没变就别动模型（避免无谓的脏标记）
    let changed = false;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== children[i]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    model.beginUpdate();
    try {
      for (let i = sorted.length - 1; i >= 0; i--) {
        model.add(parent, sorted[i], 0);
      }
    } finally {
      model.endUpdate();
    }
  }
}
