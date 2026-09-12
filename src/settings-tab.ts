import { App, PluginSettingTab, Setting } from "obsidian";
import type DrawioPlugin from "./main";
import {
  MAX_AUTOSAVE_DELAY,
  MIN_AUTOSAVE_DELAY,
} from "./settings";
import { t } from "./i18n";

export class DrawioSettingTab extends PluginSettingTab {
  plugin: DrawioPlugin;

  constructor(app: App, plugin: DrawioPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const settings = this.plugin.settings;

    new Setting(containerEl)
      .setName(t("settings.autoSave.name"))
      .setDesc(t("settings.autoSave.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.autoSave).onChange(async (value) => {
          settings.autoSave = value;
          await this.plugin.saveSettings();
          // 延迟项是否可用取决于此开关，重绘一次
          this.display();
        })
      );

    const delaySetting = new Setting(containerEl)
      .setName(t("settings.autoSaveDelay.name"))
      .setDesc(
        t("settings.autoSaveDelay.desc", {
          min: String(MIN_AUTOSAVE_DELAY),
          max: String(MAX_AUTOSAVE_DELAY),
        })
      )
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(MIN_AUTOSAVE_DELAY);
        text.inputEl.max = String(MAX_AUTOSAVE_DELAY);
        text
          .setValue(String(settings.autoSaveDelay))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed) || parsed <= 0) return;
            settings.autoSaveDelay = Math.min(
              MAX_AUTOSAVE_DELAY,
              Math.max(MIN_AUTOSAVE_DELAY, Math.round(parsed))
            );
            await this.plugin.saveSettings();
          });
      });

    if (!settings.autoSave) {
      delaySetting.setDisabled(true);
    }

    new Setting(containerEl)
      .setName(t("settings.showGrid.name"))
      .setDesc(t("settings.showGrid.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showGrid).onChange(async (value) => {
          settings.showGrid = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("settings.defaultEdgeStyle.name"))
      .setDesc(t("settings.defaultEdgeStyle.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("orthogonal", t("settings.defaultEdgeStyle.orthogonal"))
          .addOption("straight", t("settings.defaultEdgeStyle.straight"))
          .setValue(settings.defaultEdgeStyle)
          .onChange(async (value) => {
            settings.defaultEdgeStyle =
              value === "straight" ? "straight" : "orthogonal";
            await this.plugin.saveSettings();
          })
      );
  }
}
