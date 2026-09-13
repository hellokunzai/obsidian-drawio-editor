import { FloatingPanel, FloatingPanelHost } from "./FloatingPanel";
import { DRAWIO_TAG_SEP, DRAWIO_TAGS_STYLE_KEY } from "./settings";
import { t } from "./i18n";
import { mxUtils } from "./mxgraph-setup";

export interface TagsHost extends FloatingPanelHost {
  /** 标签改动后触发自动保存 */
  markDirty(): void;
}

/**
 * 去掉会破坏 mxGraph 样式串的字符。
 * 样式串用 `;` 分隔条目、用 `,` 分隔键值对，所以标签里不能出现这两个字符；
 * `|` 是本插件自己的多标签分隔符，同样要清掉。
 */
function sanitizeTag(raw: string): string {
  return raw
    .replace(/[;,]/g, " ")
    .replace(/\|/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * 标签面板。
 *
 * 标签直接写在 cell 的样式键 `drawioTags`（多个用 `|` 分隔）里 ——
 * 这样标签跟着 `.drawio` 文件走，不需要额外的存储位置，
 * draw.io 打开时也能原样保留（它不认这个键，但会照抄样式串）。
 */
export class TagsPanel {
  private panel: FloatingPanel;
  private host: TagsHost;
  private graph: any = null;

  private selectedListEl!: HTMLElement;
  private allListEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private addBtn!: HTMLButtonElement;

  constructor(parent: HTMLElement, host: TagsHost, onClose: () => void) {
    this.host = host;
    this.panel = new FloatingPanel(
      parent,
      {
        id: "tags",
        title: t("tags.title"),
        width: 250,
        height: 300,
        defaultX: "right",
        defaultY: 300,
        onClose,
      },
      host
    );
    this.build();
  }

  private build(): void {
    const body = this.panel.body;

    body.createDiv({
      cls: "drawio-tags-section",
      text: t("tags.selectedTitle"),
    });
    this.selectedListEl = body.createDiv({ cls: "drawio-tags-chips" });

    const addRow = body.createDiv({ cls: "drawio-tags-add" });
    this.inputEl = addRow.createEl("input", { cls: "drawio-tags-input" });
    this.inputEl.type = "text";
    this.inputEl.placeholder = t("tags.placeholder");

    this.addBtn = addRow.createEl("button", {
      cls: "drawio-tags-addbtn",
      text: t("tags.add"),
    });
    this.addBtn.type = "button";

    const submit = () => {
      const tag = sanitizeTag(this.inputEl.value);
      if (!tag) return;
      this.addTagToSelection(tag);
      this.inputEl.value = "";
    };
    this.addBtn.addEventListener("click", submit);
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });

    body.createDiv({ cls: "drawio-tags-section", text: t("tags.allTitle") });
    this.allListEl = body.createDiv({ cls: "drawio-tags-all" });
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
    this.panel.hide();
  }

  isOpen(): boolean {
    return this.panel.isOpen();
  }

  toggle(): void {
    if (this.panel.isOpen()) this.close();
    else this.open();
  }

  refresh(): void {
    if (!this.panel.isOpen()) return;
    this.render();
  }

  destroy(): void {
    this.panel.destroy();
  }

  // ------------------------------------------------------------ 读写标签

  private parseTags(cell: any): string[] {
    if (!this.graph) return [];
    const style = this.graph.getCellStyle(cell);
    const raw = style ? style[DRAWIO_TAGS_STYLE_KEY] : null;
    if (typeof raw !== "string" || !raw) return [];
    return raw
      .split(DRAWIO_TAG_SEP)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  private writeTags(cell: any, tags: string[]): void {
    const model = this.graph.getModel();
    const MxUtils = mxUtils();
    const current: string = model.getStyle(cell) || "";
    const next = MxUtils.setStyle(
      current,
      DRAWIO_TAGS_STYLE_KEY,
      tags.length > 0 ? tags.join(DRAWIO_TAG_SEP) : null
    );
    if (next !== current) model.setStyle(cell, next);
  }

  private selectedCells(): any[] {
    if (!this.graph) return [];
    return this.graph.getSelectionCells() || [];
  }

  /** 全图标签 → 携带它的图形列表 */
  private collectAllTags(): Map<string, any[]> {
    const map = new Map<string, any[]>();
    if (!this.graph) return map;

    const model = this.graph.getModel();
    const root = model.getRoot();
    const visit = (cell: any) => {
      const tags = this.parseTags(cell);
      for (const tag of tags) {
        const list = map.get(tag);
        if (list) list.push(cell);
        else map.set(tag, [cell]);
      }
      const count = model.getChildCount(cell);
      for (let i = 0; i < count; i++) visit(model.getChildAt(cell, i));
    };
    if (root) visit(root);
    return map;
  }

  // ------------------------------------------------------------ 操作

  private addTagToSelection(tag: string): void {
    const cells = this.selectedCells();
    if (cells.length === 0) return;

    const model = this.graph.getModel();
    model.beginUpdate();
    try {
      for (const cell of cells) {
        const tags = this.parseTags(cell);
        if (tags.indexOf(tag) < 0) tags.push(tag);
        this.writeTags(cell, tags);
      }
    } finally {
      model.endUpdate();
    }
    this.host.markDirty();
    this.render();
  }

  private removeTagFromSelection(tag: string): void {
    const cells = this.selectedCells();
    if (cells.length === 0) return;

    const model = this.graph.getModel();
    model.beginUpdate();
    try {
      for (const cell of cells) {
        const tags = this.parseTags(cell).filter((x) => x !== tag);
        this.writeTags(cell, tags);
      }
    } finally {
      model.endUpdate();
    }
    this.host.markDirty();
    this.render();
  }

  /** 从全图所有图形上摘掉某个标签 */
  private removeTagEverywhere(tag: string): void {
    const targets = this.collectAllTags().get(tag) || [];
    if (targets.length === 0) return;

    const model = this.graph.getModel();
    model.beginUpdate();
    try {
      for (const cell of targets) {
        const tags = this.parseTags(cell).filter((x) => x !== tag);
        this.writeTags(cell, tags);
      }
    } finally {
      model.endUpdate();
    }
    this.host.markDirty();
    this.render();
  }

  // ------------------------------------------------------------ 渲染

  private render(): void {
    if (!this.graph) return;
    this.renderSelected();
    this.renderAll();
    this.updateAddEnabled();
  }

  private updateAddEnabled(): void {
    const enabled = this.selectedCells().length > 0;
    this.addBtn.disabled = !enabled;
    this.inputEl.disabled = !enabled;
    this.inputEl.placeholder = enabled
      ? t("tags.placeholder")
      : t("tags.needSelection");
  }

  private renderSelected(): void {
    this.selectedListEl.empty();
    const cells = this.selectedCells();

    if (cells.length === 0) {
      this.selectedListEl.createDiv({
        cls: "drawio-tags-empty",
        text: t("tags.noSelection"),
      });
      return;
    }

    // 多个选中图形时取并集展示，去掉时对全部选中图形一起生效
    const union: string[] = [];
    for (const cell of cells) {
      for (const tag of this.parseTags(cell)) {
        if (union.indexOf(tag) < 0) union.push(tag);
      }
    }

    if (union.length === 0) {
      this.selectedListEl.createDiv({
        cls: "drawio-tags-empty",
        text: t("tags.noTags"),
      });
      return;
    }

    for (const tag of union) {
      const chip = this.selectedListEl.createDiv({ cls: "drawio-tags-chip" });
      chip.createSpan({ text: tag });
      const del = chip.createEl("button", {
        cls: "drawio-tags-chipdel",
        attr: { title: t("tags.remove"), "aria-label": t("tags.remove") },
      });
      del.type = "button";
      del.setText("\u00d7");
      del.addEventListener("click", () => this.removeTagFromSelection(tag));
    }
  }

  private renderAll(): void {
    this.allListEl.empty();
    const map = this.collectAllTags();

    if (map.size === 0) {
      this.allListEl.createDiv({
        cls: "drawio-tags-empty",
        text: t("tags.none"),
      });
      return;
    }

    const entries = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    for (const [tag, cells] of entries) {
      const row = this.allListEl.createDiv({ cls: "drawio-tags-row" });
      row.createSpan({ cls: "drawio-tags-name", text: tag });
      row.createSpan({ cls: "drawio-tags-count", text: String(cells.length) });

      const del = row.createEl("button", {
        cls: "drawio-tags-chipdel",
        attr: {
          title: t("tags.removeEverywhere"),
          "aria-label": t("tags.removeEverywhere"),
        },
      });
      del.type = "button";
      del.setText("\u00d7");
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeTagEverywhere(tag);
      });

      row.addEventListener("click", () => {
        this.graph.setSelectionCells(cells);
        this.render();
      });
    }
  }
}
