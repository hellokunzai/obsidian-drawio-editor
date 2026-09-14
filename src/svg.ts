import { sanitizeHTMLToDom } from "obsidian";

/**
 * 把一段 SVG 标记渲染进元素（替换原有内容，语义等同 `el.innerHTML = markup`）。
 *
 * 为什么不直接写 `innerHTML`：Obsidian 会把 `innerHTML` / `outerHTML` 判为 DOM 注入，
 * 官方 eslint 规则集里有三条会同时报（`@microsoft/sdl/no-inner-html`、
 * `no-unsanitized/property`、`obsidianmd/prefer-create-el` 的同族规则），
 * 插件开发指南也明确点名。这里统一走 Obsidian 自己导出的 `sanitizeHTMLToDom()`：
 * 它内部是 DOMPurify（`RETURN_DOM_FRAGMENT` + `FORBID_TAGS: ["style"]`），
 * 过一遍再 importNode 回来，属性原样保留（viewBox / stroke-width /
 * preserveAspectRatio / stroke-dasharray 等都实测无损）。
 *
 * 本项目里这些标记都是自绘的静态字面量、拼进路径 `d` 的两个变量也来自
 * 内置形状表，本来就不可注入；换成这条路径只是把那层「看起来像注入」消掉。
 */
export function setSvgMarkup(el: Element, markup: string): void {
  if (!markup) {
    el.replaceChildren();
    return;
  }
  el.replaceChildren(sanitizeHTMLToDom(markup));
}
