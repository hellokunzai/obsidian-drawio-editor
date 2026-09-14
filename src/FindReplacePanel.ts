import { Notice } from "obsidian";
import { FloatingPanel, FloatingPanelHost } from "./FloatingPanel";
import { t } from "./i18n";
import { setSvgMarkup } from "./svg";

export interface FindReplaceHost extends FloatingPanelHost {
  /** 替换文本后触发自动保存 */
  markDirty(): void;
}

/** 正则元字符转义，查找词按字面量处理 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 查找 / 替换工具窗。
 *
 * 搜索范围是当前页所有 cell 的文本值（图形标签与连线标签），
 * 命中后选中该 cell 并把视口平移过去——本插件的画布容器是 overflow:hidden，
 * 没有滚动条可滚，所以不能用 mxGraph 自带的 scrollCellToVisible，
 * 改为直接算 translate 让目标落在视口中心。
 */
export class FindReplacePanel {
  private panel: FloatingPanel;
  private host: FindReplaceHost;
  private graph: any = null;

  private queryInput!: HTMLInputElement;
  private replaceInput!: HTMLInputElement;
  private countEl!: HTMLElement;
  private caseBox!: HTMLInputElement;

  private query = "";
  private replacement = "";
  private matchCase = false;
  private matches: any[] = [];
  private current = -1;

  constructor(
    parent: HTMLElement,
    host: FindReplaceHost,
    onClose: () => void
  ) {
    this.host = host;
    this.panel = new FloatingPanel(
      parent,
      {
        id: "find",
        title: t("find.title"),
        width: 320,
        height: 150,
        defaultX: 16,
        defaultY: 16,
        onClose,
      },
      host
    );
    this.build();
  }

  private build(): void {
    const body = this.panel.body;

    // ---- 第一行：查找词 + 计数 + 上一个/下一个
    const row1 = body.createDiv({ cls: "drawio-find-row" });
    this.queryInput = row1.createEl("input", { cls: "drawio-find-input" });
    this.queryInput.type = "text";
    this.queryInput.placeholder = t("find.placeholder");
    this.countEl = row1.createSpan({ cls: "drawio-find-count", text: "" });

    const prevBtn = this.iconButton(row1, "prev", t("find.prev"));
    const nextBtn = this.iconButton(row1, "next", t("find.next"));

    // ---- 第二行：替换词 + 替换 / 全部替换
    const row2 = body.createDiv({ cls: "drawio-find-row" });
    this.replaceInput = row2.createEl("input", { cls: "drawio-find-input" });
    this.replaceInput.type = "text";
    this.replaceInput.placeholder = t("find.replacePlaceholder");

    const replaceBtn = row2.createEl("button", {
      cls: "drawio-find-btn drawio-find-btn-text",
      text: t("find.replace"),
    });
    replaceBtn.type = "button";
    replaceBtn.addEventListener("click", () => this.replaceCurrent());

    const replaceAllBtn = row2.createEl("button", {
      cls: "drawio-find-btn drawio-find-btn-text",
      text: t("find.replaceAll"),
    });
    replaceAllBtn.type = "button";
    replaceAllBtn.addEventListener("click", () => this.replaceAll());

    // ---- 第三行：区分大小写
    const row3 = body.createDiv({ cls: "drawio-find-row drawio-find-row-flat" });
    const caseLabel = row3.createEl("label", { cls: "drawio-find-check" });
    this.caseBox = caseLabel.createEl("input");
    this.caseBox.type = "checkbox";
    caseLabel.createSpan({ text: t("find.matchCase") });

    // ---- 事件
    const onQuery = () => {
      this.query = this.queryInput.value;
      this.runSearch();
      this.goTo(0);
    };
    this.queryInput.addEventListener("input", onQuery);
    this.queryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) this.goTo(this.current - 1);
        else this.goTo(this.current + 1);
      }
    });
    this.replaceInput.addEventListener("input", () => {
      this.replacement = this.replaceInput.value;
    });
    this.replaceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.replaceCurrent();
      }
    });
    this.caseBox.addEventListener("change", () => {
      this.matchCase = this.caseBox.checked;
      this.runSearch();
      this.goTo(0);
    });

    prevBtn.addEventListener("click", () => this.goTo(this.current - 1));
    nextBtn.addEventListener("click", () => this.goTo(this.current + 1));
  }

  private iconButton(
    parent: HTMLElement,
    dir: "prev" | "next",
    title: string
  ): HTMLElement {
    const btn = parent.createEl("button", {
      cls: "drawio-find-btn",
      attr: { title, "aria-label": title },
    });
    btn.type = "button";
    const path =
      dir === "prev" ? '<path d="m18 15-6-6-6 6"/>' : '<path d="m6 9 6 6 6-6"/>';
    setSvgMarkup(
      btn,
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`
    );
    return btn;
  }

  // ------------------------------------------------------------ 对外接口

  setGraph(graph: any): void {
    this.graph = graph;
    if (this.panel.isOpen()) this.refresh();
  }

  open(): void {
    this.panel.show();
    this.refresh();
    // 打开即聚焦查找框，符合工具窗的使用习惯
    window.setTimeout(() => this.queryInput?.focus(), 0);
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

  /** 模型 / 页变化后重跑搜索与计数（面板关着时不做无谓计算） */
  refresh(): void {
    if (!this.panel.isOpen()) return;
    this.runSearch();
    this.updateCount();
  }

  destroy(): void {
    this.panel.destroy();
  }

  // ------------------------------------------------------------ 搜索实现

  /** 当前页全部 cell（深度优先，含连线；不含 root 与默认父节点本身） */
  private collectCells(): any[] {
    if (!this.graph) return [];
    const model = this.graph.getModel();
    const root = model.getRoot();
    const out: any[] = [];

    const visit = (cell: any) => {
      const count = model.getChildCount(cell);
      for (let i = 0; i < count; i++) {
        const child = model.getChildAt(cell, i);
        out.push(child);
        visit(child);
      }
    };
    if (root) visit(root);
    return out;
  }

  private cellText(cell: any): string {
    const value = this.graph.getModel().getValue(cell);
    if (value == null) return "";
    return typeof value === "string" ? value : String(value);
  }

  private runSearch(): void {
    this.matches = [];
    this.current = -1;
    if (!this.graph || !this.query) {
      this.updateCount();
      return;
    }

    const re = new RegExp(
      escapeRegExp(this.query),
      this.matchCase ? "" : "i"
    );
    for (const cell of this.collectCells()) {
      if (!this.graph.isCellVisible(cell)) continue;
      if (re.test(this.cellText(cell))) this.matches.push(cell);
    }
    this.updateCount();
  }

  private updateCount(): void {
    if (!this.countEl) return;
    if (!this.query) {
      this.countEl.setText("");
      return;
    }
    if (this.matches.length === 0) {
      this.countEl.setText(t("find.noResult"));
      return;
    }
    this.countEl.setText(
      `${this.current < 0 ? 0 : this.current + 1} / ${this.matches.length}`
    );
  }

  /** 跳到第 index 个命中（循环）并把它平移到视口中心 */
  private goTo(index: number): void {
    if (!this.graph || this.matches.length === 0) {
      this.current = -1;
      this.updateCount();
      return;
    }
    const len = this.matches.length;
    this.current = ((index % len) + len) % len;
    const cell = this.matches[this.current];

    this.graph.setSelectionCell(cell);
    this.centerOn(cell);
    this.updateCount();
  }

  /**
   * 把 cell 平移到视口中心。
   * 容器像素 px = scale * (模型坐标 + translate) ⇒ 模型坐标 = px / scale - translate，
   * 反过来要让模型坐标 mc 落在视口中心：translate = 视口尺寸 / 2 / scale - mc。
   */
  private centerOn(cell: any): void {
    const graph = this.graph;
    const container = graph.container as HTMLElement | null;
    if (!container) return;

    const view = graph.getView();
    const state = view.getState(cell);
    if (!state) return;

    const scale = view.scale || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const modelCx =
      (state.x + state.width / 2) / scale - view.translate.x;
    const modelCy =
      (state.y + state.height / 2) / scale - view.translate.y;

    view.scaleAndTranslate(
      scale,
      w / 2 / scale - modelCx,
      h / 2 / scale - modelCy
    );
  }

  // ------------------------------------------------------------ 替换实现

  private replacePattern(): RegExp | null {
    if (!this.query) return null;
    return new RegExp(escapeRegExp(this.query), this.matchCase ? "g" : "gi");
  }

  private replaceCurrent(): void {
    if (!this.graph || this.current < 0) return;
    const cell = this.matches[this.current];
    const pattern = this.replacePattern();
    if (!cell || !pattern) return;

    const model = this.graph.getModel();
    const before = this.cellText(cell);
    const after = before.replace(pattern, this.replacement);
    if (after === before) return;

    model.beginUpdate();
    try {
      model.setValue(cell, after);
    } finally {
      model.endUpdate();
    }
    this.host.markDirty();

    // 替换后词条可能不再匹配，重跑搜索并把光标停在原来的序号附近
    const keepIndex = this.current;
    this.runSearch();
    this.goTo(keepIndex);
  }

  private replaceAll(): void {
    if (!this.graph) return;
    const pattern = this.replacePattern();
    if (!pattern) return;

    const targets = this.matches.slice();
    if (targets.length === 0) return;

    const model = this.graph.getModel();
    let replaced = 0;
    model.beginUpdate();
    try {
      for (const cell of targets) {
        const before = this.cellText(cell);
        const after = before.replace(this.replacePattern()!, this.replacement);
        if (after !== before) {
          model.setValue(cell, after);
          replaced++;
        }
      }
    } finally {
      model.endUpdate();
    }

    if (replaced > 0) this.host.markDirty();
    this.runSearch();
    this.goTo(0);
    new Notice(t("find.replacedCount", { count: String(replaced) }));
  }
}
