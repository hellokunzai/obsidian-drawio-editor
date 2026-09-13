import { mxUtils, mxConstants } from "./mxgraph-setup";
import { t } from "./i18n";

/** 帮助函数：用原生 DOM 创建元素，保持本模块不依赖 Obsidian 的 HTMLElement 扩展 */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const FONT_FAMILIES = [
  "Helvetica",
  "Arial",
  "Inter",
  "Segoe UI",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "宋体",
  "黑体",
  "微软雅黑",
];

const FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72,
];

/** 「样式」Tab 顶部的快速配色预设：点击即套用 填充 + 描边 */
const QUICK_STYLES: Array<{ fill: string; stroke: string }> = [
  { fill: "#ffffff", stroke: "#333333" },
  { fill: "#dbeafe", stroke: "#167dff" },
  { fill: "#dcfce7", stroke: "#16a34a" },
  { fill: "#fef3c7", stroke: "#d97706" },
  { fill: "#fee2e2", stroke: "#dc2626" },
  { fill: "#f3e8ff", stroke: "#7c3aed" },
  { fill: "#fde68a", stroke: "#b45309" },
  { fill: "#bfdbfe", stroke: "#1d4ed8" },
  { fill: "#333333", stroke: "#000000" },
  { fill: "#167dff", stroke: "#0f5fd6" },
  { fill: "#16a34a", stroke: "#15803d" },
  { fill: "#dc2626", stroke: "#991b1b" },
];

export class FormatPanel {
  private root: HTMLElement;
  private graph: any;
  private onChange: () => void;
  private currentCells: any[] = [];
  private currentStyle: any = {};
  private MxUtils: any;
  private MxConstants: any;
  private bottomActions!: HTMLElement;

  // 样式 Tab
  private styleGrid!: HTMLElement;
  private fillCheck!: HTMLInputElement;
  private fillColor!: HTMLElement;
  private strokeCheck!: HTMLInputElement;
  private strokeColor!: HTMLElement;
  private lineType!: HTMLSelectElement;
  private strokeWidth!: HTMLElement;
  private styleOpacity!: HTMLElement;
  // 文本 Tab
  private fontFamily!: HTMLSelectElement;
  private fontSize!: HTMLSelectElement;
  private boldBtn!: HTMLButtonElement;
  private italicBtn!: HTMLButtonElement;
  private underlineBtn!: HTMLButtonElement;
  private strikeBtn!: HTMLButtonElement;
  private alignBtns: Record<string, HTMLButtonElement> = {};
  private valignBtns: Record<string, HTMLButtonElement> = {};
  private writingDir!: HTMLSelectElement;
  private fontColor!: HTMLElement;
  private textBgColor!: HTMLElement;
  private textBorderColor!: HTMLElement;
  private shadowCheck!: HTMLInputElement;
  private wrapCheck!: HTMLInputElement;
  private htmlCheck!: HTMLInputElement;
  private textOpacity!: HTMLElement;
  // 排列 Tab
  private widthInput!: HTMLElement;
  private heightInput!: HTMLElement;
  private lockRatio!: HTMLInputElement;
  private leftInput!: HTMLElement;
  private topInput!: HTMLElement;
  private rotationInput!: HTMLElement;
  private lockBtn!: HTMLButtonElement;
  private groupBtn!: HTMLButtonElement;

  private origRatio = 1;
  private copiedStyle: string | null = null;

  constructor(root: HTMLElement, graph: any, onChange: () => void) {
    this.root = root;
    this.graph = graph;
    this.onChange = onChange;
    this.MxUtils = mxUtils();
    this.MxConstants = mxConstants();
    this.build();
  }

  // ---------- 构建 DOM ----------

  private build(): void {
    this.root.empty();

    // 头部
    const header = h("div", "drawio-fmt-header");
    header.appendChild(h("span", "drawio-fmt-title", t("format.title")));
    const actions = h("div", "drawio-fmt-actions");
    const collapseBtn = h("button", "drawio-fmt-icon-btn");
    collapseBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>';
    collapseBtn.title = t("format.collapse");
    const closeBtn = h("button", "drawio-fmt-icon-btn");
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    closeBtn.title = t("format.close");
    actions.appendChild(collapseBtn);
    actions.appendChild(closeBtn);
    header.appendChild(actions);
    this.root.appendChild(header);

    collapseBtn.addEventListener("click", () => this.hide());
    closeBtn.addEventListener("click", () => {
      this.graph.clearSelection();
      this.hide();
    });

    // Tab 导航
    const tabs = h("div", "drawio-fmt-tabs");
    const tabDefs = [
      { id: "style", label: t("format.tab.style") },
      { id: "text", label: t("format.tab.text") },
      { id: "arrange", label: t("format.tab.arrange") },
    ];
    for (const def of tabDefs) {
      const tab = h("button", "drawio-fmt-tab", def.label);
      tab.dataset.tab = def.id;
      if (def.id === "style") tab.classList.add("active");
      tab.addEventListener("click", () => {
        tabs
          .querySelectorAll(".drawio-fmt-tab")
          .forEach((e) => e.classList.remove("active"));
        tab.classList.add("active");
        this.root
          .querySelectorAll(".drawio-fmt-tabpane")
          .forEach((e) => e.classList.remove("active"));
        this.root
          .querySelector(`.drawio-fmt-tabpane[data-pane="${def.id}"]`)
          ?.classList.add("active");
        this.bottomActions.style.display =
          def.id === "style" ? "flex" : "none";
      });
      tabs.appendChild(tab);
    }
    this.root.appendChild(tabs);

    // 内容区
    const body = h("div", "drawio-fmt-body");
    body.appendChild(this.buildStylePane());
    body.appendChild(this.buildTextPane());
    body.appendChild(this.buildArrangePane());
    this.root.appendChild(body);

    // 底部按钮（仅在「样式」Tab 显示）
    const bottom = h("div", "drawio-fmt-bottom");
    this.bottomActions = bottom;
    const editBtn = h("button", "drawio-fmt-bottom-btn", t("format.edit"));
    editBtn.addEventListener("click", () => {
      if (this.currentCells.length > 0) {
        this.graph.startEditingAtCell(this.currentCells[0]);
      }
    });
    const copyBtn = h("button", "drawio-fmt-bottom-btn", t("format.copyStyle"));
    copyBtn.addEventListener("click", () => this.copyStyle());
    const pasteBtn = h("button", "drawio-fmt-bottom-btn", t("format.pasteStyle"));
    pasteBtn.addEventListener("click", () => this.pasteStyle());
    const defaultBtn = h(
      "button",
      "drawio-fmt-bottom-btn",
      t("format.setAsDefault")
    );
    defaultBtn.addEventListener("click", () => this.setAsDefaultStyle());
    bottom.appendChild(editBtn);
    bottom.appendChild(copyBtn);
    bottom.appendChild(pasteBtn);
    bottom.appendChild(defaultBtn);
    this.root.appendChild(bottom);
  }

  private buildStylePane(): HTMLElement {
    const pane = h("div", "drawio-fmt-tabpane active");
    pane.dataset.pane = "style";

    // 快速配色网格
    const carousel = h("div", "drawio-fmt-style-grid");
    this.styleGrid = carousel;
    QUICK_STYLES.forEach((s) => {
      const sw = h("div", "drawio-fmt-swatch");
      sw.style.background = `linear-gradient(135deg, ${s.fill} 0 50%, ${s.stroke} 50% 100%)`;
      sw.addEventListener("click", () => {
        this.applyStyle(this.MxConstants.STYLE_FILLCOLOR, s.fill);
        this.applyStyle(this.MxConstants.STYLE_STROKECOLOR, s.stroke);
        this.fillCheck.checked = true;
        this.strokeCheck.checked = true;
        this.setColorBlock(this.fillColor, s.fill);
        this.setColorBlock(this.strokeColor, s.stroke);
      });
      carousel.appendChild(sw);
    });
    pane.appendChild(carousel);

    // 填充
    pane.appendChild(
      this.section(t("format.fill"), (body) => {
        const row = h("div", "drawio-fmt-row");
        this.fillCheck = h("input") as HTMLInputElement;
        this.fillCheck.type = "checkbox";
        this.fillCheck.checked = true;
        const lbl = h("label", "drawio-fmt-check");
        lbl.appendChild(this.fillCheck);
        lbl.appendChild(h("span", undefined, t("format.fill")));
        row.appendChild(lbl);
        this.fillColor = this.colorField("#ffffff", (hex) => {
          if (this.fillCheck.checked)
            this.applyStyle(this.MxConstants.STYLE_FILLCOLOR, hex);
        });
        row.appendChild(this.fillColor);
        this.fillCheck.addEventListener("change", () => {
          this.applyStyle(
            this.MxConstants.STYLE_FILLCOLOR,
            this.fillCheck.checked ? this.hexOf(this.fillColor) : "none"
          );
        });
        body.appendChild(row);
      })
    );

    // 线条
    pane.appendChild(
      this.section(t("format.stroke"), (body) => {
        const row1 = h("div", "drawio-fmt-row");
        this.strokeCheck = h("input") as HTMLInputElement;
        this.strokeCheck.type = "checkbox";
        this.strokeCheck.checked = true;
        const lbl = h("label", "drawio-fmt-check");
        lbl.appendChild(this.strokeCheck);
        lbl.appendChild(h("span", undefined, t("format.stroke")));
        row1.appendChild(lbl);
        this.strokeColor = this.colorField("#000000", (hex) => {
          if (this.strokeCheck.checked)
            this.applyStyle(this.MxConstants.STYLE_STROKECOLOR, hex);
        });
        row1.appendChild(this.strokeColor);
        this.strokeCheck.addEventListener("change", () => {
          this.applyStyle(
            this.MxConstants.STYLE_STROKECOLOR,
            this.strokeCheck.checked ? this.hexOf(this.strokeColor) : "none"
          );
        });
        body.appendChild(row1);

        const row2 = h("div", "drawio-fmt-row");
        this.lineType = this.selectField(
          [
            { v: "solid", t: t("format.lineSolid") },
            { v: "dashed", t: t("format.lineDashed") },
            { v: "dotted", t: t("format.lineDotted") },
          ],
          "solid",
          (v) => {
            if (v === "solid") {
              this.applyStyle(this.MxConstants.STYLE_DASHED, null);
              this.applyStyle(this.MxConstants.STYLE_FIX_DASH, null);
            } else if (v === "dashed") {
              this.applyStyle(this.MxConstants.STYLE_DASHED, "1");
              this.applyStyle(this.MxConstants.STYLE_FIX_DASH, null);
            } else {
              this.applyStyle(this.MxConstants.STYLE_DASHED, "1");
              this.applyStyle(this.MxConstants.STYLE_FIX_DASH, "1");
            }
          }
        );
        row2.appendChild(this.lineType);
        this.strokeWidth = this.numberField("pt", "1", (v) =>
          this.applyStyle(this.MxConstants.STYLE_STROKEWIDTH, String(v))
        );
        row2.appendChild(this.strokeWidth);
        body.appendChild(row2);
      })
    );

    // 不透明度
    const opRow = h("div", "drawio-fmt-row");
    opRow.appendChild(h("span", "drawio-fmt-label", t("format.opacity")));
    this.styleOpacity = this.numberField("%", "100", (v) =>
      this.applyStyle(
        this.MxConstants.STYLE_OPACITY,
        String(Math.min(100, Math.max(0, v)))
      )
    );
    opRow.appendChild(this.styleOpacity);
    pane.appendChild(opRow);

    // 效果（占位）
    pane.appendChild(
      this.section(
        t("format.effects"),
        (body) => {
          body.appendChild(
            h(
              "div",
              "drawio-fmt-muted",
              t("format.effectsPlaceholder")
            )
          );
        },
        false
      )
    );

    return pane;
  }

  private buildTextPane(): HTMLElement {
    const pane = h("div", "drawio-fmt-tabpane");
    pane.dataset.pane = "text";

    const fontRow = h("div", "drawio-fmt-row");
    this.fontFamily = this.selectField(
      FONT_FAMILIES.map((f) => ({ v: f, t: f })),
      "Helvetica",
      (v) => this.applyStyle(this.MxConstants.STYLE_FONTFAMILY, v)
    );
    fontRow.appendChild(this.fontFamily);
    pane.appendChild(fontRow);

    const styleRow = h("div", "drawio-fmt-toolbar");
    this.boldBtn = this.toggleBtn("B", "bold", true, (on) =>
      this.setFontStyle(this.MxConstants.FONT_BOLD, on)
    );
    this.italicBtn = this.toggleBtn("I", "italic", false, (on) =>
      this.setFontStyle(this.MxConstants.FONT_ITALIC, on)
    );
    this.underlineBtn = this.toggleBtn("U", "underline", false, (on) =>
      this.setFontStyle(this.MxConstants.FONT_UNDERLINE, on)
    );
    this.strikeBtn = this.toggleBtn("S", "strike", false, (on) =>
      this.setFontStyle(this.MxConstants.FONT_STRIKETHROUGH, on)
    );
    styleRow.appendChild(this.boldBtn);
    styleRow.appendChild(this.italicBtn);
    styleRow.appendChild(this.underlineBtn);
    styleRow.appendChild(this.strikeBtn);
    this.fontSize = this.selectField(
      FONT_SIZES.map((s) => ({ v: String(s), t: `${s} px` })),
      "12",
      (v) => this.applyStyle(this.MxConstants.STYLE_FONTSIZE, v)
    );
    styleRow.appendChild(this.fontSize);
    pane.appendChild(styleRow);

    const alignRow = h("div", "drawio-fmt-toolbar");
    const aligns: Array<[string, string, string]> = [
      ["left", "l", "M4 6h16M4 12h10M4 18h14"],
      ["center", "c", "M4 6h16M7 12h10M5 18h14"],
      ["right", "r", "M4 6h16M10 12h10M6 18h14"],
    ];
    for (const [k, icon, d] of aligns) {
      const b = this.iconToggleBtn(icon, d, false, () => {
        this.applyStyle(this.MxConstants.STYLE_ALIGN, k);
        Object.values(this.alignBtns).forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      this.alignBtns[k] = b;
      alignRow.appendChild(b);
    }
    const valigns: Array<[string, string, string]> = [
      ["top", "t", "M6 4v16M12 4v10M18 4v16"],
      ["middle", "m", "M6 4v16M12 7v10M18 4v16"],
      ["bottom", "b", "M6 4v16M12 10v10M18 4v16"],
    ];
    for (const [k, icon, d] of valigns) {
      const b = this.iconToggleBtn(icon, d, false, () => {
        this.applyStyle(this.MxConstants.STYLE_VERTICAL_ALIGN, k);
        Object.values(this.valignBtns).forEach((x) =>
          x.classList.remove("active")
        );
        b.classList.add("active");
      });
      this.valignBtns[k] = b;
      alignRow.appendChild(b);
    }
    pane.appendChild(alignRow);

    const wdRow = h("div", "drawio-fmt-row");
    wdRow.appendChild(h("span", "drawio-fmt-label", t("format.position")));
    this.writingDir = this.selectField(
      [
        { v: "auto", t: t("format.posCenterH") },
        { v: "left", t: t("format.posLeft") },
        { v: "right", t: t("format.posRight") },
      ],
      "auto",
      (v) => {
        const map: Record<string, string> = {
          auto: this.MxConstants.ALIGN_CENTER,
          left: this.MxConstants.ALIGN_LEFT,
          right: this.MxConstants.ALIGN_RIGHT,
        };
        this.applyAlign(map[v]);
      }
    );
    wdRow.appendChild(this.writingDir);
    pane.appendChild(wdRow);

    const wdRow2 = h("div", "drawio-fmt-row");
    wdRow2.appendChild(h("span", "drawio-fmt-label", t("format.writingDir")));
    const dirSel = this.selectField(
      [
        { v: "auto", t: t("format.dirAuto") },
        { v: "h", t: t("format.dirH") },
        { v: "v", t: t("format.dirV") },
      ],
      "auto",
      (v) => {
        if (v === "v")
          this.applyStyle(this.MxConstants.STYLE_HORIZONTAL, "0");
        else this.applyStyle(this.MxConstants.STYLE_HORIZONTAL, null);
      }
    );
    wdRow2.appendChild(dirSel);
    pane.appendChild(wdRow2);

    const fcRow = h("div", "drawio-fmt-row");
    const fcLbl = h("label", "drawio-fmt-check");
    const fcChk = h("input") as HTMLInputElement;
    fcChk.type = "checkbox";
    fcChk.checked = true;
    fcLbl.appendChild(fcChk);
    fcLbl.appendChild(h("span", undefined, t("format.fontColor")));
    fcRow.appendChild(fcLbl);
    this.fontColor = this.colorField("#000000", (hex) =>
      this.applyStyle(this.MxConstants.STYLE_FONTCOLOR, hex)
    );
    fcRow.appendChild(this.fontColor);
    pane.appendChild(fcRow);

    const bgRow = h("div", "drawio-fmt-row");
    const bgLbl = h("label", "drawio-fmt-check");
    const bgChk = h("input") as HTMLInputElement;
    bgChk.type = "checkbox";
    bgLbl.appendChild(bgChk);
    bgLbl.appendChild(h("span", undefined, t("format.bgColor")));
    bgRow.appendChild(bgLbl);
    this.textBgColor = this.colorField("#ffffff", (hex) =>
      this.applyStyle(this.MxConstants.STYLE_LABEL_BACKGROUNDCOLOR, hex)
    );
    bgRow.appendChild(this.textBgColor);
    pane.appendChild(bgRow);

    const bcRow = h("div", "drawio-fmt-row");
    const bcLbl = h("label", "drawio-fmt-check");
    const bcChk = h("input") as HTMLInputElement;
    bcChk.type = "checkbox";
    bcLbl.appendChild(bcChk);
    bcLbl.appendChild(h("span", undefined, t("format.borderColor")));
    bcRow.appendChild(bcLbl);
    this.textBorderColor = this.colorField("#ffffff", (hex) =>
      this.applyStyle(this.MxConstants.STYLE_LABEL_BORDERCOLOR, hex)
    );
    bcRow.appendChild(this.textBorderColor);
    pane.appendChild(bcRow);

    const shRow = h("div", "drawio-fmt-row");
    this.shadowCheck = h("input") as HTMLInputElement;
    this.shadowCheck.type = "checkbox";
    const shLbl = h("label", "drawio-fmt-check");
    shLbl.appendChild(this.shadowCheck);
    shLbl.appendChild(h("span", undefined, t("format.shadow")));
    this.shadowCheck.addEventListener("change", () =>
      this.applyStyle(
        this.MxConstants.STYLE_SHADOW,
        this.shadowCheck.checked ? "1" : null
      )
    );
    shRow.appendChild(shLbl);
    pane.appendChild(shRow);

    pane.appendChild(h("div", "drawio-fmt-divider"));

    const wrapRow = h("div", "drawio-fmt-row");
    this.wrapCheck = h("input") as HTMLInputElement;
    this.wrapCheck.type = "checkbox";
    this.wrapCheck.checked = true;
    const wrapLbl = h("label", "drawio-fmt-check");
    wrapLbl.appendChild(this.wrapCheck);
    wrapLbl.appendChild(h("span", undefined, t("format.wordWrap")));
    this.wrapCheck.addEventListener("change", () =>
      this.applyStyle(
        this.MxConstants.STYLE_WHITE_SPACE,
        this.wrapCheck.checked ? this.MxConstants.WORD_WRAP : null
      )
    );
    wrapRow.appendChild(wrapLbl);
    pane.appendChild(wrapRow);

    const htmlRow = h("div", "drawio-fmt-row");
    this.htmlCheck = h("input") as HTMLInputElement;
    this.htmlCheck.type = "checkbox";
    this.htmlCheck.checked = true;
    const htmlLbl = h("label", "drawio-fmt-check");
    htmlLbl.appendChild(this.htmlCheck);
    htmlLbl.appendChild(h("span", undefined, t("format.formattedText")));
    this.htmlCheck.addEventListener("change", () =>
      this.applyStyle(
        this.MxConstants.STYLE_HTML,
        this.htmlCheck.checked ? "1" : null
      )
    );
    htmlRow.appendChild(htmlLbl);
    pane.appendChild(htmlRow);

    const opRow = h("div", "drawio-fmt-row");
    opRow.appendChild(h("span", "drawio-fmt-label", t("format.opacity")));
    this.textOpacity = this.numberField("%", "100", (v) =>
      this.applyStyle(
        this.MxConstants.STYLE_TEXT_OPACITY,
        String(Math.min(100, Math.max(0, v)))
      )
    );
    opRow.appendChild(this.textOpacity);
    pane.appendChild(opRow);

    pane.appendChild(
      this.section(
        t("format.spacing"),
        (body) => {
          body.appendChild(
            h("div", "drawio-fmt-muted", t("format.spacingPlaceholder"))
          );
        },
        false
      )
    );

    return pane;
  }

  private buildArrangePane(): HTMLElement {
    const pane = h("div", "drawio-fmt-tabpane");
    pane.dataset.pane = "arrange";

    const grid = h("div", "drawio-fmt-arrange-grid");
    const mk = (label: string, fn: () => void) => {
      const b = h("button", "drawio-fmt-arrange-btn", label);
      b.addEventListener("click", fn);
      return b;
    };
    grid.appendChild(mk(t("format.toFront"), () => this.graph.bringToFront(this.currentCells)));
    grid.appendChild(mk(t("format.toBack"), () => this.graph.sendToBack(this.currentCells)));
    grid.appendChild(
      mk(t("format.forward"), () => this.graph.orderCells(false, this.currentCells))
    );
    grid.appendChild(
      mk(t("format.backward"), () => this.graph.orderCells(true, this.currentCells))
    );
    pane.appendChild(grid);

    pane.appendChild(
      this.section(
        t("format.sizePosition"),
        (body) => {
          const sizeRow = h("div", "drawio-fmt-row");
          sizeRow.appendChild(h("span", "drawio-fmt-label-wide", t("format.size")));
          this.widthInput = this.numberField("pt", "80", (v) => {
            this.applyGeometry((g) => {
              g.width = v;
              if (this.lockRatio.checked && this.origRatio)
                g.height = Math.round(v / this.origRatio);
            });
          });
          this.heightInput = this.numberField("pt", "80", (v) => {
            this.applyGeometry((g) => {
              g.height = v;
              if (this.lockRatio.checked && this.origRatio)
                g.width = Math.round(v * this.origRatio);
            });
          });
          sizeRow.appendChild(this.widthInput);
          sizeRow.appendChild(this.heightInput);
          body.appendChild(sizeRow);

          const ratioRow = h("div", "drawio-fmt-row");
          this.lockRatio = h("input") as HTMLInputElement;
          this.lockRatio.type = "checkbox";
          this.lockRatio.checked = true;
          const rl = h("label", "drawio-fmt-check");
          rl.appendChild(this.lockRatio);
          rl.appendChild(h("span", undefined, t("format.lockRatio")));
          ratioRow.appendChild(rl);
          body.appendChild(ratioRow);

          const posRow = h("div", "drawio-fmt-row");
          posRow.appendChild(h("span", "drawio-fmt-label-wide", t("format.position")));
          this.leftInput = this.numberField("pt", "0", (v) =>
            this.applyGeometry((g) => (g.x = v))
          );
          this.topInput = this.numberField("pt", "0", (v) =>
            this.applyGeometry((g) => (g.y = v))
          );
          posRow.appendChild(this.leftInput);
          posRow.appendChild(this.topInput);
          body.appendChild(posRow);
        },
        true
      )
    );

    pane.appendChild(
      this.section(
        t("format.rotation"),
        (body) => {
          const rRow = h("div", "drawio-fmt-row");
          this.rotationInput = this.numberField("°", "0", (v) =>
            this.applyStyle(this.MxConstants.STYLE_ROTATION, String(v))
          );
          rRow.appendChild(this.rotationInput);
          body.appendChild(rRow);
        },
        false
      )
    );

    pane.appendChild(
      this.section(
        t("format.flip"),
        (body) => {
          const fg = h("div", "drawio-fmt-arrange-grid");
          const flipH = h("button", "drawio-fmt-arrange-btn", t("format.flipH"));
          flipH.addEventListener("click", () =>
            this.toggleFlip(this.MxConstants.STYLE_FLIPH)
          );
          const flipV = h("button", "drawio-fmt-arrange-btn", t("format.flipV"));
          flipV.addEventListener("click", () =>
            this.toggleFlip(this.MxConstants.STYLE_FLIPV)
          );
          fg.appendChild(flipH);
          fg.appendChild(flipV);
          body.appendChild(fg);
        },
        false
      )
    );

    const gridRow = h("div", "drawio-fmt-row");
    const gridBtn = h(
      "button",
      "drawio-fmt-arrange-btn drawio-fmt-block",
      t("format.alignToGrid")
    );
    gridBtn.addEventListener("click", () => this.graph.alignCells(this.MxConstants.ALIGN_CENTER, this.currentCells));
    gridRow.appendChild(gridBtn);
    pane.appendChild(gridRow);

    const stack = h("div", "drawio-fmt-stack");
    this.groupBtn = h("button", "drawio-fmt-arrange-btn", t("format.group")) as HTMLButtonElement;
    this.groupBtn.addEventListener("click", () => {
      if (this.currentCells.length > 1) this.graph.groupCells(null, 0, this.currentCells);
      this.refresh(this.currentCells);
    });
    const ungroupBtn = h("button", "drawio-fmt-arrange-btn", t("format.ungroup"));
    ungroupBtn.addEventListener("click", () => {
      this.graph.ungroupCells(this.currentCells);
      this.refresh(this.currentCells);
    });
    this.lockBtn = h("button", "drawio-fmt-arrange-btn", t("format.lock")) as HTMLButtonElement;
    this.lockBtn.addEventListener("click", () => {
      const locked = this.MxUtils.getValue(this.currentStyle, this.MxConstants.STYLE_LOCKED, "0") === "1";
      this.applyStyle(this.MxConstants.STYLE_LOCKED, locked ? null : "1");
      this.refresh(this.currentCells);
    });
    const delBtn = h("button", "drawio-fmt-arrange-btn", t("format.delete"));
    delBtn.addEventListener("click", () => {
      this.graph.removeCells(this.currentCells);
      this.hide();
    });
    stack.appendChild(this.groupBtn);
    stack.appendChild(ungroupBtn);
    stack.appendChild(this.lockBtn);
    stack.appendChild(delBtn);
    pane.appendChild(stack);

    return pane;
  }

  // ---------- 通用控件构造 ----------

  private section(
    title: string,
    fill: (body: HTMLElement) => void,
    open = true
  ): HTMLElement {
    const sec = h("div", "drawio-fmt-section" + (open ? " open" : ""));
    const head = h("div", "drawio-fmt-section-header");
    head.appendChild(h("span", undefined, title));
    head.appendChild(h("span", "drawio-fmt-section-arrow", "▸"));
    sec.appendChild(head);
    const body = h("div", "drawio-fmt-section-body");
    fill(body);
    sec.appendChild(body);
    head.addEventListener("click", () => sec.classList.toggle("open"));
    return sec;
  }

  private colorField(
    initial: string,
    onChange: (hex: string) => void
  ): HTMLElement {
    const wrap = h("div", "drawio-fmt-color");
    wrap.style.background = initial;
    const input = h("input") as HTMLInputElement;
    input.type = "color";
    input.value = initial;
    input.style.position = "absolute";
    input.style.inset = "0";
    input.style.opacity = "0";
    input.style.cursor = "pointer";
    input.style.border = "none";
    input.style.padding = "0";
    input.addEventListener("input", () => {
      wrap.style.background = input.value;
      onChange(input.value);
    });
    wrap.appendChild(input);
    (wrap as any)._input = input;
    return wrap;
  }

  private setColorBlock(block: HTMLElement, hex: string): void {
    block.style.background = hex;
    const input = (block as any)._input as HTMLInputElement | undefined;
    if (input && /^#[0-9a-fA-F]{6}$/.test(hex)) input.value = hex;
  }

  private hexOf(block: HTMLElement): string {
    return block.style.background || "#ffffff";
  }

  private selectField(
    opts: Array<{ v: string; t: string }>,
    value: string,
    onChange: (v: string) => void
  ): HTMLSelectElement {
    const sel = h("select", "drawio-fmt-select") as HTMLSelectElement;
    for (const o of opts) {
      const op = h("option", undefined, o.t) as HTMLOptionElement;
      op.value = o.v;
      sel.appendChild(op);
    }
    sel.value = value;
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }

  private numberField(
    unit: string,
    value: string,
    onChange: (v: number) => void
  ): HTMLElement {
    const wrap = h("div", "drawio-fmt-number");
    const input = h("input") as HTMLInputElement;
    input.type = "number";
    input.value = value;
    input.addEventListener("change", () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v)) onChange(v);
    });
    wrap.appendChild(input);
    wrap.appendChild(h("span", "drawio-fmt-unit", unit));
    (wrap as any)._input = input;
    return wrap;
  }

  private toggleBtn(
    text: string,
    cls: string,
    active: boolean,
    onChange: (on: boolean) => void
  ): HTMLButtonElement {
    const b = h("button", "drawio-fmt-tbtn" + (active ? " active" : ""), text) as HTMLButtonElement;
    if (cls === "bold") b.style.fontWeight = "bold";
    if (cls === "italic") b.style.fontStyle = "italic";
    if (cls === "underline") b.style.textDecoration = "underline";
    b.addEventListener("click", () => {
      b.classList.toggle("active");
      onChange(b.classList.contains("active"));
    });
    return b;
  }

  private iconToggleBtn(
    key: string,
    d: string,
    active: boolean,
    onClick: () => void
  ): HTMLButtonElement {
    const b = h(
      "button",
      "drawio-fmt-tbtn icon" + (active ? " active" : "")
    ) as HTMLButtonElement;
    b.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
    b.addEventListener("click", onClick);
    return b;
  }

  // ---------- 样式写入 ----------

  private applyStyle(key: string, value: any): void {
    if (!this.graph || this.currentCells.length === 0) return;
    const cells = this.currentCells;
    this.graph.getModel().beginUpdate();
    try {
      this.graph.setCellStyles(key, value, cells);
    } finally {
      this.graph.getModel().endUpdate();
    }
    this.onChange();
  }

  private applyGeometry(mut: (geo: any) => void): void {
    if (!this.graph || this.currentCells.length === 0) return;
    const model = this.graph.getModel();
    model.beginUpdate();
    try {
      for (const cell of this.currentCells) {
        let geo = model.getGeometry(cell);
        if (!geo) continue;
        geo = geo.clone();
        mut(geo);
        model.setGeometry(cell, geo);
      }
    } finally {
      model.endUpdate();
    }
    this.onChange();
  }

  private setFontStyle(flag: number, on: boolean): void {
    const cur = this.MxUtils.getNumber(
      this.currentStyle,
      this.MxConstants.STYLE_FONTSTYLE,
      0
    );
    const v = on ? cur | flag : cur & ~flag;
    this.applyStyle(this.MxConstants.STYLE_FONTSTYLE, v === 0 ? null : String(v));
  }

  private applyAlign(align: string): void {
    if (!this.graph || this.currentCells.length === 0) return;
    this.graph.alignCells(align, this.currentCells);
    this.onChange();
  }

  private toggleFlip(key: string): void {
    const cur = this.MxUtils.getValue(this.currentStyle, key, "0");
    this.applyStyle(key, cur === "1" ? null : "1");
    this.refresh(this.currentCells);
  }

  private copyStyle(): void {
    if (this.currentCells.length === 0) return;
    const codec = new (this.MxUtils.getCodec ? this.MxUtils.getCodec() : Object)();
    const style = this.graph.getCellStyle(this.currentCells[0]);
    this.copiedStyle = JSON.stringify(style);
    try {
      navigator.clipboard?.writeText(this.copiedStyle);
    } catch {
      /* ignore */
    }
    // 轻量反馈：直接改按钮文本短暂提示
    this.onChange();
  }

  private pasteStyle(): void {
    if (!this.copiedStyle || this.currentCells.length === 0) return;
    let style: any;
    try {
      style = JSON.parse(this.copiedStyle);
    } catch {
      return;
    }
    this.graph.getModel().beginUpdate();
    try {
      for (const cell of this.currentCells) {
        for (const [k, v] of Object.entries(style)) {
          this.graph.setCellStyles(k, v as any, [cell]);
        }
      }
    } finally {
      this.graph.getModel().endUpdate();
    }
    this.refresh(this.currentCells);
    this.onChange();
  }

  private setAsDefaultStyle(): void {
    if (this.currentCells.length === 0) return;
    const style = this.graph.getCellStyle(this.currentCells[0]);
    const sheet = this.graph.getStylesheet();
    sheet.putDefaultVertexStyle(Object.assign({}, style));
    this.onChange();
  }

  // ---------- 显示 / 刷新 ----------

  show(cells: any[]): void {
    this.currentCells = cells || [];
    this.root.classList.remove("drawio-collapsed");
    this.refresh(cells);
  }

  hide(): void {
    this.root.classList.add("drawio-collapsed");
  }

  private refresh(cells: any[]): void {
    if (!cells || cells.length === 0) return;
    this.currentCells = cells;
    const cell = cells[0];
    this.currentStyle = this.graph.getCellStyle(cell);

    const get = (key: string, def?: any) =>
      this.MxUtils.getValue(this.currentStyle, key, def);

    // 样式 Tab
    const fill = get(this.MxConstants.STYLE_FILLCOLOR, "none");
    this.fillCheck.checked = fill !== "none" && fill != null;
    this.setColorBlock(this.fillColor, this.toHex(fill));
    const stroke = get(this.MxConstants.STYLE_STROKECOLOR, "none");
    this.strokeCheck.checked = stroke !== "none" && stroke != null;
    this.setColorBlock(this.strokeColor, this.toHex(stroke));
    const dashed = get(this.MxConstants.STYLE_DASHED, null);
    this.lineType.value = dashed ? "dashed" : "solid";
    const sw = get(this.MxConstants.STYLE_STROKEWIDTH, "1");
    this.setNumber(this.strokeWidth, sw);
    const op = get(this.MxConstants.STYLE_OPACITY, "100");
    this.setNumber(this.styleOpacity, op);

    // 文本 Tab
    const ff = get(this.MxConstants.STYLE_FONTFAMILY, "Helvetica");
    this.fontFamily.value = FONT_FAMILIES.includes(ff) ? ff : "Helvetica";
    const fs = String(get(this.MxConstants.STYLE_FONTSIZE, "12"));
    this.fontSize.value = FONT_SIZES.map(String).includes(fs) ? fs : "12";
    const fs2 = get(this.MxConstants.STYLE_FONTSTYLE, 0);
    this.boldBtn.classList.toggle("active", (Number(fs2) & this.MxConstants.FONT_BOLD) !== 0);
    this.italicBtn.classList.toggle("active", (Number(fs2) & this.MxConstants.FONT_ITALIC) !== 0);
    this.underlineBtn.classList.toggle("active", (Number(fs2) & this.MxConstants.FONT_UNDERLINE) !== 0);
    this.strikeBtn.classList.toggle("active", (Number(fs2) & this.MxConstants.FONT_STRIKETHROUGH) !== 0);
    const align = get(this.MxConstants.STYLE_ALIGN, this.MxConstants.ALIGN_CENTER);
    Object.entries(this.alignBtns).forEach(([k, b]) =>
      b.classList.toggle("active", k === align)
    );
    const valign = get(this.MxConstants.STYLE_VERTICAL_ALIGN, this.MxConstants.ALIGN_MIDDLE);
    Object.entries(this.valignBtns).forEach(([k, b]) =>
      b.classList.toggle("active", k === valign)
    );
    const horiz = get(this.MxConstants.STYLE_HORIZONTAL, null);
    this.writingDir.value = horiz === "0" ? "v" : "auto";
    this.setColorBlock(this.fontColor, this.toHex(get(this.MxConstants.STYLE_FONTCOLOR, "#000000")));
    this.setColorBlock(this.textBgColor, this.toHex(get(this.MxConstants.STYLE_LABEL_BACKGROUNDCOLOR, "none")));
    this.setColorBlock(this.textBorderColor, this.toHex(get(this.MxConstants.STYLE_LABEL_BORDERCOLOR, "none")));
    this.shadowCheck.checked = get(this.MxConstants.STYLE_SHADOW, null) === "1";
    this.wrapCheck.checked = get(this.MxConstants.STYLE_WHITE_SPACE, null) === this.MxConstants.WORD_WRAP;
    this.htmlCheck.checked = get(this.MxConstants.STYLE_HTML, null) === "1";
    this.setNumber(this.textOpacity, get(this.MxConstants.STYLE_TEXT_OPACITY, "100"));

    // 排列 Tab
    const geo = this.graph.getModel().getGeometry(cell);
    if (geo) {
      this.setNumber(this.widthInput, Math.round(geo.width));
      this.setNumber(this.heightInput, Math.round(geo.height));
      this.setNumber(this.leftInput, Math.round(geo.x));
      this.setNumber(this.topInput, Math.round(geo.y));
      if (geo.width && geo.height) this.origRatio = geo.width / geo.height;
    }
    const rot = get(this.MxConstants.STYLE_ROTATION, "0");
    this.setNumber(this.rotationInput, rot);
    const locked = get(this.MxConstants.STYLE_LOCKED, "0") === "1";
    this.lockBtn.textContent = locked ? t("format.unlock") : t("format.lock");
    const isGroup = cells.length === 1 && this.graph.getModel().getChildCount(cell) > 0;
    this.groupBtn.disabled = cells.length < 2 && !isGroup;
  }

  private toHex(c: string | undefined): string {
    if (!c || c === "none" || c === "transparent") return "#ffffff";
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      return (
        "#" +
        c
          .slice(1)
          .split("")
          .map((ch) => ch + ch)
          .join("")
      );
    }
    return "#ffffff";
  }

  private setNumber(wrap: HTMLElement, value: any): void {
    const input = (wrap as any)._input as HTMLInputElement | undefined;
    if (input) input.value = String(value);
  }
}
