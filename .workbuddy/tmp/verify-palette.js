/* 校验：源码里的 48 组配色是否与「参考图逐像素还原」的期望表完全一致，
   以及产物 / CSS / 版本号是否都到位。跑完即删。 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
let fail = 0;
const ok = (m) => console.log("  ✅ " + m);
const bad = (m) => { fail++; console.log("  ❌ " + m); };

// ---- 期望表：来自 python 连通域分析 + 渐变最小二乘拟合（参考图 6 张）----
const EXPECT = [
  [ // 1 默认浅色
    ["#ffffff","#000000",null,false],["#f5f5f5","#666666",null,false],
    ["#dae8fc","#6c8ebf",null,false],["#d5e8d4","#82b366",null,false],
    ["#ffe6cc","#d79b00",null,false],["#fff2cc","#d6b656",null,false],
    ["#f8cecc","#b85450",null,false],["#e1d5e7","#9673a6",null,false],
  ],
  [ // 2 饱和彩色
    ["#ffffff","#000000",null,false],["#60a917","#2d7600",null,false],
    ["#008a00","#005700",null,false],["#1ba1e2","#006eaf",null,false],
    ["#0050ef","#001dbc",null,false],["#6a00ff","#3700cc",null,false],
    ["#d80073","#a50040",null,false],["#a20025","#6f0000",null,false],
  ],
  [ // 3 暖色/深色
    ["#e51400","#b20000",null,false],["#fa6800","#c73500",null,false],
    ["#f0a30a","#bd7000",null,false],["#e3c800","#b09500",null,false],
    ["#6d8764","#3a5431",null,false],["#647687","#314354",null,false],
    ["#76608a","#432d57",null,false],["#a0522d","#6d1f00",null,false],
  ],
  [ // 4 粉彩（含无填充）
    ["#ffffff","#000000",null,false],["#ffffff","#000000",null,true],
    ["#fad7ac","#b46504",null,false],["#fad9d5","#ae4132",null,false],
    ["#b0e3e6","#0e8088",null,false],["#b1ddf0","#10739e",null,false],
    ["#d0cee2","#56517e",null,false],["#bac8d3","#23445d",null,false],
  ],
  [ // 5 竖向渐变
    ["#ffffff","#000000",null,false],["#f6f6f6","#666666","#b0b0b0",false],
    ["#dce9fc","#6c8ebf","#79a2df",false],["#d6e8d5","#82b366","#94cf72",false],
    ["#ffce29","#d79b00","#ffa300",false],["#fff3ce","#d6b656","#ffd861",false],
    ["#f8d0ce","#b85450","#e96661",false],["#e6d1df","#996185","#d46e99",false],
  ],
  [ // 6 柔和
    ["#ffffff","#000000",null,false],["#eeeeee","#36393d",null,false],
    ["#f9f7ed","#36393d",null,false],["#ffcc99","#36393d",null,false],
    ["#cce5ff","#36393d",null,false],["#ffff88","#36393d",null,false],
    ["#cdeb8b","#36393d",null,false],["#ffcccc","#36393d",null,false],
  ],
];

// ---- 1. 从源码里抠出 STYLE_PRESET_PAGES 并求值 ----
const src = fs.readFileSync(path.join(ROOT, "src/FormatPanel.ts"), "utf8");
const m = src.match(/const STYLE_PRESET_PAGES[^=]*=\s*(\[[\s\S]*?\n\]);/);
if (!m) { bad("源码里找不到 STYLE_PRESET_PAGES 数组字面量"); }
else {
  let actual;
  try { actual = new Function("return " + m[1])(); }
  catch (e) { bad("数组字面量求值失败: " + e.message); }
  if (actual) {
    console.log("配色数据");
    if (actual.length !== EXPECT.length) bad(`页数 ${actual.length} ≠ ${EXPECT.length}`);
    else ok(`页数 ${actual.length}`);
    for (let p = 0; p < EXPECT.length; p++) {
      const page = actual[p] || [];
      if (page.length !== 8) { bad(`第 ${p + 1} 页色块数 ${page.length} ≠ 8`); continue; }
      for (let i = 0; i < 8; i++) {
        const a = page[i], e = EXPECT[p][i];
        const got = [a.fill, a.stroke, a.gradient ?? null, !!a.noFill];
        if (got.join("|") !== e.join("|"))
          bad(`第 ${p + 1} 页第 ${i + 1} 块 实际 ${got.join("|")} ≠ 期望 ${e.join("|")}`);
      }
    }
    if (!fail) ok("48 组（填充/描边/渐变色/无填充）与参考图逐像素还原值全部一致");
    // 唯一性抽查：确认没有把同一页复制粘贴漏改
    const flat = [];
    actual.forEach((pg, pi) => pg.forEach((s, si) => flat.push(`${pi}:${si}:${s.fill}/${s.stroke}/${s.gradient ?? ""}/${!!s.noFill}`)));
    ok(`共 ${flat.length} 条预设条目`);

    // ---- 高亮匹配逻辑的数据前提 ----
    const key = (s) => `${s.noFill ? "none" : s.fill}/${s.stroke}/${s.gradient ?? "none"}`;
    console.log("高亮匹配（镜像实现里的 matchStylePreset，验证数据前提）");
    let pageDup = 0;
    actual.forEach((pg, pi) => {
      const seen = new Set();
      pg.forEach((s) => { if (seen.has(key(s))) pageDup++; seen.add(key(s)); });
    });
    (pageDup === 0 ? ok : bad)(`页内预设无重复（同页高亮不会撞车），重复 ${pageDup} 组`);

    const globalSeen = {};
    let globalDup = 0;
    actual.forEach((pg, pi) => pg.forEach((s, si) => {
      const k = key(s);
      if (globalSeen[k] !== undefined) globalDup++;
      else globalSeen[k] = `${pi}:${si}`;
    }));
    ok(`跨页重复 ${globalDup} 组（靠「优先当前页」消化，不会无谓跳页）`);

    // 镜像算法：先当前页，再全局首个
    const norm = (v) => (v == null ? "none" : String(v).toLowerCase());
    function match(fill, stroke, gradient, currentPage) {
      const probe = { fill: norm(fill), stroke: norm(stroke), gradient: norm(gradient) };
      const hit = (s) => key(s) === `${probe.fill}/${probe.stroke}/${probe.gradient}`;
      const li = actual[currentPage].findIndex(hit);
      if (li >= 0) return currentPage * 8 + li;
      for (let p = 0; p < actual.length; p++) {
        const i = actual[p].findIndex(hit);
        if (i >= 0) return p * 8 + i;
      }
      return -1;
    }
    let trip = 0, tripBad = 0;
    actual.forEach((pg, pi) => pg.forEach((s, si) => {
      const want = pi * 8 + si;
      for (const cur of [pi, 0, 3]) {           // 当前页 = 自己 / 首页 / 第 4 页
        const got = match(s.noFill ? "none" : s.fill, s.stroke, s.gradient ?? null, cur);
        trip++;
        if (cur === pi ? got !== want : got < 0) tripBad++;
      }
    }));
    (tripBad === 0 ? ok : bad)(`往返匹配 ${trip - tripBad}/${trip}（当前页命中自己；跨页也能命中而非 -1）`);
    (match("#123456", "#654321", null, 0) === -1 ? ok : bad)("非预设配色返回 -1（不高亮）");
  }
}

// ---- 2. 源码里不该再有旧配色 ----
console.log("源码");
for (const dead of ["QUICK_STYLES", "#dbeafe", "#fde68a", "#bfdbfe"]) {
  if (src.includes(dead)) bad(`仍残留旧配色/旧常量: ${dead}`);
}
if (!src.includes("QUICK_STYLES")) ok("旧 QUICK_STYLES 与 12 组手调配色已清除");
for (const need of ["buildStylePalette", "applyStylePreset", "syncStylePalette", "matchStylePreset", "changeStylePage", "paintSwatch"]) {
  if (!src.includes(need)) bad(`缺少方法 ${need}`);
}
if (src.includes("syncStylePalette")) ok("轮播相关方法齐全");
// 用真 <button> 而不是 div，别退回丢键盘可访问性
const mkBtn = (cls) => new RegExp(`h\\(\\s*"button",\\s*"${cls}`);
if (mkBtn("drawio-fmt-pager-btn").test(src) && mkBtn("drawio-fmt-swatch").test(src) && mkBtn("drawio-fmt-style-dot").test(src))
  ok("箭头 / 色块 / 圆点都用真 <button>（键盘可访问）");
else bad("有按钮退回了 <div>");

// ---- 3. CSS ----
console.log("styles.css");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
if (/^\.drawio-fmt-swatch\s*\{/m.test(css)) bad("仍有裸单类名 .drawio-fmt-swatch 规则（会被 Obsidian 盖掉）");
else ok("无裸单类名 .drawio-fmt-swatch 残留规则");
for (const sel of [
  ".drawio-fmt-stylepager .drawio-fmt-pager-btn",
  ".drawio-fmt-style-grid .drawio-fmt-swatch",
  ".drawio-fmt-style-grid .drawio-fmt-swatch.is-none",
  ".drawio-fmt-style-grid .drawio-fmt-swatch.active",
  ".drawio-fmt-style-dots .drawio-fmt-style-dot",
]) {
  if (!css.includes(sel)) bad(`CSS 缺少提权选择器: ${sel}`);
}
if (css.includes(".drawio-fmt-style-dots .drawio-fmt-style-dot")) ok("新增选择器全部带父级前缀（(0,2,0)/(0,3,0)）");
for (const keep of ["transform: translateY(-1px)", "box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12)"]) {
  if (!css.includes(keep)) bad(`悬停效果缺失: ${keep}`);
}
ok("悬停沿用「上浮 1px + 投影」");
const open = (css.match(/\{/g) || []).length, close = (css.match(/\}/g) || []).length;
(open === close ? ok : bad)(`大括号 ${open}/${close}`);

// ---- 4. 产物（esbuild minify 会把非 ASCII 转成 \uXXXX，先反转义再查）----
console.log("main.js 产物");
const raw = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
// 注意：esbuild minify 对 U+0080~U+00FF 用 \xHH（如 `·` → \xB7），
// 更靠后的字符才用 \uXXXX —— 两种都得反转义，否则中文文案会「看起来缺失」。
const un = raw
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const need = ["上一组配色", "下一组配色", "第 {{n}} 组配色", "填充 {{fill}} · 线条 {{stroke}}", "无填充",
              "Previous palette", "Next palette", "Palette {{n}}", "Fill {{fill}} · Stroke {{stroke}}", "No fill",
              "drawio-fmt-pager-btn", "drawio-fmt-swatch", "drawio-fmt-style-dot", "drawio-fmt-palette",
              "#dae8fc", "#e6d1df", "#ffce29", "#d46e99", "linear-gradient(180deg"];
const miss = need.filter((s) => !un.includes(s));
(miss.length === 0 ? ok : bad)(`产物命中 ${need.length - miss.length}/${need.length}` + (miss.length ? ` 缺: ${miss.join(", ")}` : ""));

// ---- 5. 版本号三处一致 ----
console.log("版本号");
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const ver = JSON.parse(fs.readFileSync(path.join(ROOT, "versions.json"), "utf8"));
(man.version === pkg.version && ver[man.version] ? ok : bad)(
  `manifest=${man.version} package=${pkg.version} versions[${man.version}]=${ver[man.version]}`);

console.log("\n" + (fail ? `❌ ${fail} 项未通过` : "✅ 全部通过"));
process.exit(fail ? 1 : 0);
