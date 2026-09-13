import { Menu, Notice, Plugin, TAbstractFile, TFolder, WorkspaceLeaf, addIcon } from "obsidian";
import { DrawioView, VIEW_TYPE_DRAWIO, DRAWIO_ICON_ID } from "./DrawioView";
import { DrawioSettingTab } from "./settings-tab";
import { DEFAULT_SETTINGS, DrawioSettings, MIN_PALETTE_WIDTH, MAX_PALETTE_WIDTH } from "./settings";
import { t } from "./i18n";

/** 流程图图标（两框一连线），用于标签页 / 菜单 */
const DRAWIO_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="9" height="6" rx="1"/><rect x="13" y="15.5" width="9" height="6" rx="1"/><path d="M6.5 8.5v6a3 3 0 0 0 3 3h3.5"/></svg>`;

export default class DrawioPlugin extends Plugin {
  settings!: DrawioSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 自绘图标：Obsidian 内置图标集里没有合适的流程图图标，
    // 之前用的 "diagram-project" 在部分客户端不存在，会渲染成空白按钮
    addIcon(DRAWIO_ICON_ID, DRAWIO_ICON_SVG);

    // Settings panel (appears under Settings → Community plugins → Drawio Editor)
    this.addSettingTab(new DrawioSettingTab(this.app, this));

    // Register the custom view for .drawio files
    this.registerView(VIEW_TYPE_DRAWIO, (leaf: WorkspaceLeaf) => new DrawioView(leaf, this));

    // Register .drawio file extension
    // Obsidian will use our view to open files with this extension
    this.registerExtensions(["drawio", "drawio.svg", "xml"], VIEW_TYPE_DRAWIO);

    // Add command to create new diagram (command palette entry point)
    this.addCommand({
      id: "create-new-drawio-diagram",
      name: t("command.createDiagram"),
      callback: async () => {
        await this.createNewDiagram(null, `${t("file.untitledDiagram")} ${Date.now()}`);
      },
    });

    // File list context menu: 新建流程图
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        // 右键文件夹 → 建在该文件夹里；右键文件 → 建在它所在的文件夹里
        const folder = file instanceof TFolder ? file : file.parent ?? this.app.vault.getRoot();
        menu.addItem((item) =>
          item
            .setTitle(t("file.newFlowchart"))
            .setIcon("file-plus")
            .onClick(() => {
              void this.createNewDiagram(folder, t("file.newFlowchart"));
            })
        );
      })
    );

    // Listen for theme changes to update graph colors
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DRAWIO);
        for (const leaf of leaves) {
          const view = leaf.view;
          if (view && (view as any).applyTheme) {
            (view as any).applyTheme();
          }
        }
      })
    );
  }

  async onunload(): Promise<void> {
  }

  /**
   * 在指定目录下新建一个空 .drawio 图表并打开
   * @param folder   目标目录，null / 未传表示仓库根目录
   * @param baseName 文件名（不含扩展名），重名时自动加序号
   */
  async createNewDiagram(folder?: TFolder | null, baseName?: string): Promise<void> {
    const target = folder ?? this.app.vault.getRoot();
    const name = baseName ?? t("file.newFlowchart");
    const path = this.getUniquePath(target, name, "drawio");

    try {
      const file = await this.app.vault.create(path, this.defaultDiagramContent());
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file, { active: true });
    } catch (err) {
      console.error("Error creating diagram:", err);
      new Notice(t("notice.createFailed") + (err as Error).message);
    }
  }

  /** 生成不冲突的路径：新建流程图.drawio → 新建流程图 1.drawio → … */
  private getUniquePath(folder: TFolder, baseName: string, ext: string): string {
    const dir = folder.path === "/" || !folder.path ? "" : `${folder.path}/`;
    const isTaken = (p: string) => this.app.vault.getAbstractFileByPath(p) !== null;

    let path = `${dir}${baseName}.${ext}`;
    for (let i = 1; isTaken(path); i++) {
      if (i > 999) {
        path = `${dir}${baseName} ${Date.now()}.${ext}`;
        break;
      }
      path = `${dir}${baseName} ${i}.${ext}`;
    }
    return path;
  }

  /** 空图表的标准 mxfile 内容 */
  private defaultDiagramContent(): string {
    return `<mxfile host="obsidian-drawio-editor" version="${this.manifest.version}">
  <diagram name="Untitled">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<DrawioSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});

    // 修正被外部改坏的字段，避免脏数据导致行为异常
    if (
      typeof this.settings.autoSaveDelay !== "number" ||
      !Number.isFinite(this.settings.autoSaveDelay) ||
      this.settings.autoSaveDelay <= 0
    ) {
      this.settings.autoSaveDelay = DEFAULT_SETTINGS.autoSaveDelay;
    }
    if (this.settings.defaultEdgeStyle !== "straight") {
      this.settings.defaultEdgeStyle = "orthogonal";
    }
    if (
      typeof this.settings.paletteWidth !== "number" ||
      !Number.isFinite(this.settings.paletteWidth)
    ) {
      this.settings.paletteWidth = DEFAULT_SETTINGS.paletteWidth;
    }
    this.settings.paletteWidth = Math.min(
      MAX_PALETTE_WIDTH,
      Math.max(MIN_PALETTE_WIDTH, Math.round(this.settings.paletteWidth))
    );
    // 便签本必须是数组，且过滤掉结构不合法的项，避免脏数据让面板渲染崩掉
    if (!Array.isArray(this.settings.scratchpad)) {
      this.settings.scratchpad = [];
    } else {
      this.settings.scratchpad = this.settings.scratchpad.filter(
        (s) => s && typeof s === "object" && typeof s.style === "string"
      );
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.applySettingsToViews();
  }

  /** 把最新设置推给所有已打开的图表视图，做到改完即生效 */
  private applySettingsToViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DRAWIO)) {
      const view = leaf.view as unknown as Partial<DrawioView>;
      if (typeof view.applySettings === "function") {
        view.applySettings();
      }
    }
  }
}
