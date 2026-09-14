/**
 * mxGraph 样式值的读取工具。
 *
 * 坑：`mxStylesheet.getCellStyle()`（`mxGraph.getCellStyle()` 内部走它）在解析
 * 样式串时对**任何看起来像数字的值**都做 `parseFloat`：
 *
 *     f == mxConstants.NONE ? delete c[k]
 *       : mxUtils.isNumeric(f) ? c[k] = parseFloat(f)
 *       : c[k] = f
 *
 * 于是样式串里写进去的 `sketch=1`、`rounded=1`、`shadow=0`、`dashed=1`
 * 读出来都是 **number 1 / 0**，不是字符串 `"1"` / `"0"`。
 * 直接 `=== "1"` 比对本机永远为 false（数字 1 不严格等于字符串 "1"），
 * 表现就是「勾选框勾上又立刻弹回」「虚线永远显示实线」这类问题。
 *
 * 所以判定样式开关一律走这里，用 `String()` 把两种形态归一化后再比。
 */

/** 样式值是否等于期望的字面量（数字 / 字符串两种形态都认） */
export function styleIs(value: unknown, expected: string): boolean {
  // 只认基本类型：mxGraph 读回来的开关值要么是数字 0/1，要么是字符串，
  // 其它形态（对象等）一律按「不等」处理，避免 String() 出 [object Object]。
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return false;
  }
  return String(value) === expected;
}

/** 样式开关是否为「开」（draw.io 用 `=1` 表示开启） */
export function isStyleOn(value: unknown): boolean {
  return value === true || styleIs(value, "1");
}
