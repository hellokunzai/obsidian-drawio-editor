import { App, Modal } from "obsidian";
import { t } from "./i18n";

export interface TextEditOptions {
  /** 弹窗标题 */
  title: string;
  /** 输入框上方的标签 */
  label: string;
  /** 初始值 */
  value: string;
  /** 是否多行（默认 true） */
  multiline?: boolean;
  /** 输入框占位提示 */
  placeholder?: string;
  /** 输入框下方的辅助说明（可选） */
  hint?: string;
  /** 点击「应用」时回调，入参为最新文本；返回 false 可阻止关闭 */
  onSave: (value: string) => boolean | void;
}

/**
 * 通用单行 / 多行文本编辑弹窗。
 * 右键菜单的「编辑样式 / 编辑链接 / 编辑数据 / 编辑连接点」共用此组件，
 * 避免每个编辑入口都重写一遍 Modal 模板。
 */
export class TextEditModal extends Modal {
  private opts: TextEditOptions;
  private input!: HTMLTextAreaElement | HTMLInputElement;
  private value: string;

  constructor(app: App, opts: TextEditOptions) {
    super(app);
    this.opts = opts;
    this.value = opts.value;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("drawio-text-edit");

    contentEl.createEl("h3", { text: this.opts.title });

    contentEl.createEl("label", {
      cls: "drawio-text-edit-label",
      text: this.opts.label,
    });

    if (this.opts.multiline === false) {
      const input = contentEl.createEl("input", {
        cls: "drawio-text-edit-input",
        attr: { type: "text", placeholder: this.opts.placeholder ?? "" },
      });
      input.value = this.value;
      this.input = input;
    } else {
      const ta = contentEl.createEl("textarea", {
        cls: "drawio-text-edit-input drawio-text-edit-textarea",
        attr: { placeholder: this.opts.placeholder ?? "" },
      });
      ta.value = this.value;
      this.input = ta;
    }

    if (this.opts.hint) {
      contentEl.createEl("div", {
        cls: "drawio-text-edit-hint",
        text: this.opts.hint,
      });
    }

    const actions = contentEl.createDiv({ cls: "drawio-text-edit-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "drawio-text-edit-btn",
      text: t("ctx.modal.cancel"),
    });
    cancelBtn.addEventListener("click", () => this.close());

    const applyBtn = actions.createEl("button", {
      cls: "drawio-text-edit-btn drawio-text-edit-apply",
      text: t("ctx.modal.apply"),
    });
    applyBtn.addEventListener("click", () => {
      const ok = this.opts.onSave(this.input.value);
      if (ok !== false) this.close();
    });

    // 打开即聚焦，方便直接编辑
    this.input.focus();
    // 多行框：Ctrl+Enter 直接应用
    this.input.addEventListener("keydown", (e) => {
      const ke = e as KeyboardEvent;
      if (this.opts.multiline !== false && ke.key === "Enter" && (ke.ctrlKey || ke.metaKey)) {
        ke.preventDefault();
        const ok = this.opts.onSave(this.input.value);
        if (ok !== false) this.close();
      }
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
