/**
 * 草图（Sketch）渲染层
 *
 * 开源版 mxGraph 4.2.2（本插件打包的 mxClient）不含 draw.io 的
 * `mxScribble` / `STYLE_SKETCH` 渲染器，所以格式面板里的「草图」勾选框虽然
 * 能把 `sketch=1` 写进样式并触发重绘，但 mxGraph 收到后不做任何处理，
 * 视觉上毫无变化 —— 表现为「按钮没用」。
 *
 * 这里在 mxGraph 原生重绘之后补一层后处理：把带 `sketch=1` 的图形所生成的
 * SVG 几何顶点按「低频倾斜 + 高频手抖」位移，得到边框稍微歪歪扭扭的手绘感。
 *
 * 为什么不是逐坐标独立随机：那样只会得到毛毛的锯齿边（毛边），边本身仍然笔直。
 * 参考效果要的是「整条边轻微倾斜 / 上下边往一侧收拢」，即相邻顶点之间位移是
 * 相关的。所以这里对顶点位移做两级分解：
 *   - 低频分量（低频种子，幅度大）：同一条边两端点共享一部分，产生整体倾斜；
 *   - 高频分量（顶点级种子，幅度小）：每个顶点各有一份微扰，避免过于工整。
 *
 * 确定性：种子基于「图形自身几何 + 顶点序号」。mxGraph 每次重绘都从模型重新
 * 生成几何，所以同一图形反复重绘结果稳定 —— 选中高亮、悬停、缩放、样式刷新
 * 都不会让图形乱抖；移动 / 缩放后自然跟随新几何。
 */

import { mx } from "./mxgraph-setup";
import { isStyleOn } from "./styleValue";

/**
 * 低频倾斜幅度（屏幕像素）。同一分组的顶点共享这部分位移，打散剪切场的规律性。
 * 轻微档：约 1.5–2.5px，边缘看得出不齐但不夸张。
 */
const LEAN_AMP = 0.8;

/** 高频手抖幅度（屏幕像素）。每个顶点独立微扰，决定「边缘毛不毛」。 */
const JITTER_AMP = 0.7;

/**
 * 剪切场幅度（屏幕像素）。这是「边歪」的主力。
 *
 * 只靠相邻顶点的随机共享还不够：随机方向可能恰好让一条边的两端同向移动，
 * 斜率不变，看起来仍是一条平移后的直线。参考效果要的是「整条边一起斜」，
 * 所以这里沿顶点序号铺设一条极低频的平滑波 —— 波谷/波峰跨好几个顶点，
 * 于是相邻顶点位移高度相关（边倾斜），隔几个顶点才反向（上下边收拢）。
 */
const SHEAR_AMP = 1.6;

/** 剪切场波长（以顶点数为单位）：约 2 个顶点一个完整起伏 */
const SHEAR_WAVELENGTH = 2.0;

/**
 * y 分量的波长倍数。x / y 用不同波长，使「左右边倾斜」与「上下边倾斜」
 * 的相位差不可预测 —— 这正是参考图里矩形既斜又略微收拢的来源。
 * 若两者同波长同相位，整个图形会退化成统一旋转，反而不像手绘。
 */
const SHEAR_Y_WAVELENGTH_RATIO = 1.6;

/** 可草图化的几何元素选择器 */
const GEOM_SEL = "path,rect,ellipse,circle,line,polyline,polygon";

/** FNV-1a 字符串哈希 → 32bit 种子 */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32：小巧确定性 PRNG */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NUM_RE = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

function fmt(v: number): string {
  // 与 mxGraph 一致保留 2 位小数，去掉多余尾零
  return String(Math.round(v * 100) / 100);
}

/** [-1, 1) 的确定性随机 */
function rnd(seed: number): number {
  return mulberry32(seed)() * 2 - 1;
}

/**
 * 求某个顶点的位移。
 *
 * 三层叠加，从大到小：
 *   1. 剪切场（SHEAR_AMP）——沿顶点序号平滑起伏，相邻顶点相位接近，
 *      因此「一条边的两端几乎同步移动」→ 边整体倾斜；跨越半波长后反向
 *      → 上下边 / 左右边相对收拢。这是「歪歪扭扭」的主视觉来源，也保证
 *      不同图形之间因 saltBase 不同而歪得不一样。
 *   2. 低频随机（LEAN_AMP）——同一分组共享，打散剪切场的规律性，
 *      避免所有图形歪成同一个形状。
 *   3. 高频手抖（JITTER_AMP）——每个顶点独立，让边不显得过于光滑。
 *
 * @param saltBase 图形几何指纹
 * @param vi       顶点序号（同一图形内递增，保证每个顶点用不同随机流）
 * @param part     0 = x 分量，1 = y 分量
 * @param edgeAnchor 低频种子分组键；同一条边 / 同一分组的顶点共用它。
 *                   传 null 表示该顶点不参与低频倾斜（例如圆弧半径）。
 */
function vertexDelta(
  saltBase: string,
  vi: number,
  part: number,
  edgeAnchor: string | null
): number {
  // 1. 剪切场：沿顶点序号的低频正弦，x / y 用不同波长与随机相位，
  //    让两个分量的起伏错开（否则会退化成纯旋转）
  const shearSeed = hashStr(saltBase + "#S" + part);
  const phase = ((shearSeed % 1000) / 1000) * Math.PI * 2;
  const wave =
    ((vi / SHEAR_WAVELENGTH) *
      (part === 1 ? SHEAR_Y_WAVELENGTH_RATIO : 1) *
      Math.PI *
      2);
  const shear = Math.sin(phase + wave) * SHEAR_AMP;

  // 2. 低频随机：同分组共享
  const lean =
    edgeAnchor !== null
      ? rnd(hashStr(saltBase + "#L" + edgeAnchor + "_" + part)) * LEAN_AMP
      : 0;

  // 3. 高频手抖：每顶点独立
  const jitter = rnd(hashStr(saltBase + "#j" + vi + "_" + part)) * JITTER_AMP;

  return shear + lean + jitter;
}

/**
 * 对 path 的 `d` 字符串做草图化。
 *
 * 保留命令字母与分隔符，仅扰动数值。注意几类特殊参数不能动：
 *   - 圆弧命令 `A` 的 large-arc / sweep 标志位（每组 7 参数里的第 4、5 个）
 *     是整数枚举，抖动会让几何错乱；
 *   - 圆弧的 rx / ry（第 1、2 个）抖动会造成半径不匹配、弧长跳变，保持原值。
 * 其余数值按「每 2 个数值 = 1 个顶点」成对位移，同一对共享顶点序号，
 * 让 x / y 位移相关（避免出现只在一个方向上乱抖的割裂感）。
 */
function sketchifyPathD(d: string, saltBase: string): string {
  let lastCmd = "";
  let argCount = 0;
  let tokenIndex = 0;
  // 顶点序号：H / V / A 等每个顶点消费 1 个数值，L / M 等消费 2 个
  let vi = 0;
  let part = 0;

  return d.replace(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g, (tok) => {
    if (/[a-zA-Z]/.test(tok)) {
      lastCmd = tok.toUpperCase();
      argCount = 0;
      return tok;
    }

    // 仅这些命令带「非坐标参数」，需要按位置判断并原样保留：
    //   A rx ry x-axis-rotation large-arc-flag sweep-flag x y   (7 个一组)
    //   C / S / Q / T 全是坐标，不在此列
    if (lastCmd === "A") {
      const g = argCount % 7;
      // 0=rx 1=ry 2=rotation 3=large-arc 4=sweep —— 保持原值
      // 5=x 6=y —— 参与位移
      if (g <= 4) {
        argCount++;
        return tok;
      }
      // 圆弧终点：整条弧共享一个低频锚点，弧整体倾斜而不散开
      const arcIdx = Math.floor(argCount / 7);
      const delta = vertexDelta(
        saltBase,
        tokenIndex++,
        g === 5 ? 0 : 1,
        "arc" + arcIdx
      );
      argCount++;
      return fmt(parseFloat(tok) + delta);
    }

    // H / V：单坐标命令，一个数值 = 一个顶点
    const singleAxis = lastCmd === "H" || lastCmd === "V";

    // 低频锚点：每 2 个顶点归为一组共享同一份低频位移。
    // 这样「边的两端点」会拿到相同的倾斜分量 → 整条边平移倾斜，
    // 而不是两端各自乱移把边拉直。
    const group = singleAxis ? Math.floor(tokenIndex / 2) : Math.floor(vi / 2);
    const anchor = "v" + group;

    const delta = vertexDelta(
      saltBase,
      singleAxis ? tokenIndex : vi,
      part,
      anchor
    );

    tokenIndex++;

    if (singleAxis) {
      vi++;
      part = 0;
    } else {
      part = part === 0 ? 1 : 0;
      if (part === 0) vi++;
    }

    argCount++;
    return fmt(parseFloat(tok) + delta);
  });
}

/** 对 polyline/polygon 的 `points` 字符串做草图化（成对取值 = 顶点） */
function sketchifyPoints(pts: string, saltBase: string): string {
  let tokenIndex = 0;
  return pts.replace(NUM_RE, (tok) => {
    const idx = tokenIndex++;
    const vi = Math.floor(idx / 2);
    const part = idx % 2;
    const delta = vertexDelta(saltBase, vi, part, String(vi));
    return fmt(parseFloat(tok) + delta);
  });
}

/**
 * 对单个几何元素的数值属性做草图化。
 *
 * 坐标类属性（x / y / cx / cy / x1 / y1 / x2 / y2）参与位移；
 * 尺寸类属性（width / height / rx / ry / r）不位移 —— 只挪位不改尺寸，
 * 才能保证「描边歪、填充平整」：填充与描边共用同一份几何，
 * 改动尺寸会让描边和填充对不上、露白边。
 */
function sketchifyElement(el: Element, saltBase: string): void {
  const d = el.getAttribute("d");
  if (d) {
    el.setAttribute("d", sketchifyPathD(d, saltBase));
    return;
  }

  const points = el.getAttribute("points");
  if (points) {
    el.setAttribute("points", sketchifyPoints(points, saltBase));
    return;
  }

  // 坐标类：成对处理，让同一顶点的 x / y 共享顶点序号
  const pairAttrs: Array<[string, string]> = [
    ["x", "y"],
    ["x1", "y1"],
    ["x2", "y2"],
  ];
  for (const [ax, ay] of pairAttrs) {
    const vx = el.getAttribute(ax);
    const vy = el.getAttribute(ay);
    if (vx == null && vy == null) continue;
    if (vx != null) {
      el.setAttribute(ax, fmt(parseFloat(vx) + vertexDelta(saltBase, 0, 0, ax)));
    }
    if (vy != null) {
      // y 与 x 属于同一顶点：沿用同一低频锚点，形成一致的倾斜方向
      el.setAttribute(ay, fmt(parseFloat(vy) + vertexDelta(saltBase, 0, 1, ax)));
    }
  }

  // 圆心单独处理（ellipse / circle），半径保持原值
  for (const attr of ["cx", "cy"]) {
    const v = el.getAttribute(attr);
    if (v == null) continue;
    const part = attr === "cx" ? 0 : 1;
    el.setAttribute(attr, fmt(parseFloat(v) + vertexDelta(saltBase, 0, part, "c")));
  }
}

/**
 * 对某个 cell 的 shape 节点整体做草图化。
 *
 * 关键点：mxGraph 里 `state.shape.node` 本身往往就是几何元素
 * （矩形 => <rect>、连线 => <path>、圆 => <ellipse>），而不是包着子元素的容器。
 * 因此这里既要处理 `node` 自身（当它恰好是几何元素时），也要处理它的后代。
 *
 * 「描边歪、填充平整」的实现方式：mxGraph 的矩形 / 椭圆等 shape 只有一个几何
 * 节点，填充和描边共用它，无法只改描边。所以这里对「带 fill/stroke 的几何」
 * 统一只做位置级扰动（坐标平移，不改尺寸），保证填充块与描边轮廓始终对齐。
 * 连线（path，无填充）则完整参与，观感最接近手绘。
 */
function sketchify(node: Element | null): void {
  if (!node) return;
  const targets: Element[] = [];
  // node 自身若是几何元素，也纳入
  if (typeof (node as any).matches === "function" && (node as any).matches(GEOM_SEL)) {
    targets.push(node);
  }
  if (typeof node.querySelectorAll === "function") {
    node.querySelectorAll(GEOM_SEL).forEach((el) => targets.push(el));
  }
  for (const el of targets) {
    // 种子基于元素标签 + 原始几何字符串，重绘时几何由模型重新生成，稳定
    const saltBase =
      el.tagName +
      "|" +
      (el.getAttribute("d") || "") +
      (el.getAttribute("points") || "") +
      (el.getAttribute("x") || "") +
      (el.getAttribute("y") || "") +
      (el.getAttribute("cx") || "") +
      (el.getAttribute("cy") || "");
    sketchifyElement(el, saltBase);
  }
}

let installed = false;

/**
 * 安装草图渲染层。幂等，只需在 initMxGraph() 之后调用一次。
 *
 * 之所以覆写 `mxShape.prototype.redraw` 而不是 `mxCellRenderer.prototype.redraw`：
 * 后者只在「整 cell 状态重绘」时触发，而选中高亮、预览、缩放、部分样式刷新等
 * 十几处路径会直接调用 `state.shape.redraw()` 绕开它，把后处理抖动覆盖掉。
 * 覆写 mxShape.redraw 能覆盖全部几何重绘入口。
 *
 * 只对手绘几何 shape 生效：`this.state.text === this` 时为文字 shape，跳过，
 * 否则若该 cell 样式带 `sketch=1` 就对几何节点做草图化抖动。
 */
export function installSketchRenderer(): void {
  if (installed) return;
  const ShapeClass = mx("mxShape");
  if (
    !ShapeClass ||
    !ShapeClass.prototype ||
    typeof ShapeClass.prototype.redraw !== "function"
  )
    return;

  const origRedraw = ShapeClass.prototype.redraw;
  ShapeClass.prototype.redraw = function (this: any): void {
    origRedraw.call(this);
    // 样式串里的 `sketch=1` 被 mxStylesheet 解析成 number 1，用 isStyleOn() 归一化判定
    if (
      this &&
      this.state &&
      this.state.style &&
      isStyleOn(this.state.style["sketch"]) &&
      this.state.text !== this &&
      this.node
    ) {
      sketchify(this.node);
    }
  };

  installed = true;
}
