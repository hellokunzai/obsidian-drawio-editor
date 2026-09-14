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

// ---- 6. 「填充 / 线条 / 效果」标题栏 → 分割线（v0.17.1 填充组，v0.17.2 补上线条/效果）----
console.log("分割线改造");
for (const gone of ["format.fill", "format.stroke", "format.effects"]) {
  const re = new RegExp(`this\\.section\\(\\s*t\\("${gone.replace(/\./g, "\\.")}"\\)`);
  if (re.test(src)) bad(`${gone} 组仍在用可折叠标题栏 this.section(...)`);
}
ok("填充 / 线条 / 效果三组都已不再渲染标题栏");
const flatCalls = (src.match(/this\.flatSection\(\(body\) => \{/g) || []).length;
(flatCalls === 3 ? ok : bad)(`flatSection 调用点 ${flatCalls} 处（应为 3：填充 / 线条 / 效果）`);
const flatDefs = (src.match(/private flatSection\(/g) || []).length;
(flatDefs === 1 ? ok : bad)(`flatSection 定义 ${flatDefs} 处（应为 1）`);
// 扁平分组内部：分割线是第一个子元素，且首行不是 margin-bottom:0（:last-child 才是）
const flatImpl = src.match(/private flatSection\([\s\S]*?\n  \}/);
if (flatImpl && /h\("div", "drawio-fmt-flat"\)/.test(flatImpl[0]) &&
    /appendChild\(h\("div", "drawio-fmt-divider"\)\)/.test(flatImpl[0]))
  ok("flatSection = .drawio-fmt-flat > .drawio-fmt-divider，内容直接追加（:last-child 语义与旧 section 一致）");
else bad("flatSection 结构不符预期");
// 文案本身必须还在：填充 / 线条 = 勾选框标签；效果 = 去掉标题后的 aria-label
const cnt = (s) => (src.match(new RegExp(`t\\("${s.replace(/\./g, "\\.")}"\\)`, "g")) || []).length;
(cnt("format.fill") === 1 ? ok : bad)(`t("format.fill") 剩 ${cnt("format.fill")} 处（应为 1：勾选框标签）`);
(cnt("format.stroke") === 1 ? ok : bad)(`t("format.stroke") 剩 ${cnt("format.stroke")} 处（应为 1：勾选框标签）`);
(cnt("format.effects") === 1 ? ok : bad)(`t("format.effects") 剩 ${cnt("format.effects")} 处（应为 1：aria-label）`);
for (const keep of ["format.gradient", "format.opacity"]) {
  if (!src.includes(`t("${keep}")`)) bad(`文案 key 丢失: ${keep}`);
}
ok("渐变 / 不透明度文案仍在");
// 标题栏没了不能把语义一起丢掉
if (/setAttribute\("role", "group"\)/.test(src) && /setAttribute\("aria-label", t\("format\.effects"\)\)/.test(src))
  ok("效果组补了 role=group + aria-label（读屏仍能听到「效果」）");
else bad("效果组缺少 role/aria-label，标题栏去掉后语义丢失");

// 不透明度必须并进线条组：否则 row2 会命中 :last-child 把行距归零、和线型控件贴在一起
const sp = src.match(/private buildStylePane\(\)[\s\S]*?\n  \}/);
if (!sp) bad("找不到 buildStylePane 方法体");
else {
  if (/body\.appendChild\(opRow\)/.test(sp[0])) ok("不透明度行已并入线条扁平组（body.appendChild(opRow)）");
  else bad("不透明度行没并进线条组");
  if (/pane\.appendChild\(opRow\)/.test(sp[0])) bad("样式面板里仍把不透明度行挂在分组之外");
  else ok("样式面板里不再有组外的 opRow");
}
if (src.includes("drawio-fmt-group\"") || /"drawio-fmt-group"/.test(css))
  bad("残留已弃用的 .drawio-fmt-group 命名（与 .drawio-fmt-group-title/-body 语义撞车）");
else ok("无 .drawio-fmt-group 命名残留");

// 特异性：扁平分割线的间距规则必须真的压过 .drawio-fmt-divider 的基础规则
const spec = (sel) => {
  const s = { a: 0, b: 0, c: 0 };
  sel.split(",").forEach((one) => {
    const t = one.trim();
    s.a += (t.match(/#[\w-]+/g) || []).length;
    s.b += (t.match(/\.[\w-]+/g) || []).length + (t.match(/\[[^\]]+\]/g) || []).length +
           (t.match(/:(?!:)[\w-]+(\([^)]*\))?/g) || []).length;
    s.c += (t.match(/(^|[\s>+~])([a-z][\w-]*)/g) || []).length;
  });
  return s.a * 10000 + s.b * 100 + s.c;
};
const flatRule = css.match(/([^\n{}]*drawio-fmt-flat[^\n{}]*drawio-fmt-divider[^\n{}]*)\{([^{}]*)\}/);
if (!flatRule) bad("CSS 缺少 .drawio-fmt-flat > .drawio-fmt-divider 规则");
else {
  if (/margin:\s*11px 0 10px/.test(flatRule[2])) ok("三条分割线上边 11px / 下边 10px");
  else bad("分割线间距不是 margin: 11px 0 10px —— " + flatRule[2].trim());
  const base = css.match(/([^\n{}]*\.drawio-fmt-divider[^\n{}]*)\{([^{}]*margin:[^{}]*)\}/);
  if (!base) bad("找不到基础 .drawio-fmt-divider 规则");
  else {
    const w = spec(flatRule[1]), l = spec(base[1]);
    (w > l ? ok : bad)(`特异性 ${w} > ${l}（扁平分割线生效，基础 12px 间距被覆盖）`);
  }
}
// 首组（紧接配色轮播那条）不能叠加：palette 的 margin-bottom 11px + divider 的 margin-top 11px = 22px
const firstFlat = css.match(/([^\n{}]*drawio-fmt-palette\s*\+\s*\.drawio-fmt-flat[^\n{}]*drawio-fmt-divider[^\n{}]*)\{([^{}]*)\}/);
if (!firstFlat) bad("CSS 缺少 .drawio-fmt-palette + .drawio-fmt-flat > .drawio-fmt-divider 覆盖规则");
else {
  if (!/margin-top:\s*0/.test(firstFlat[2])) bad("首组分割线没有清零 margin-top（会叠成 22px）");
  else if (spec(firstFlat[1]) <= spec(flatRule[1])) bad(`首组覆盖规则特异性 ${spec(firstFlat[1])} 未超过基础扁平规则 ${spec(flatRule[1])}`);
  else ok(`首组分割线 margin-top 归零，且特异性 ${spec(firstFlat[1])} > ${spec(flatRule[1])}`);
}
const pal = css.match(/\.drawio-fmt-palette\s*\{([^{}]*)\}/);
if (pal && /margin-bottom:\s*11px/.test(pal[1])) ok("配色轮播 margin-bottom: 11px（对齐参考图 dots→分割线 11px）");
else bad("配色轮播 margin-bottom 不是 11px —— " + (pal ? pal[1].trim() : "无规则"));
// 旧规则不该被顺手改掉：基础 .drawio-fmt-divider 仍是 12px
if (/\.drawio-fmt-divider\s*\{[^{}]*margin:\s*12px 0/.test(css)) ok("基础 .drawio-fmt-divider 仍是 12px（文本/排列面板不受影响）");
else bad("基础 .drawio-fmt-divider 的 12px 间距被改动");
if (un.includes("drawio-fmt-flat") && un.includes("drawio-fmt-divider"))
  ok("产物含 .drawio-fmt-flat / .drawio-fmt-divider");
else bad("产物缺少 drawio-fmt-flat / drawio-fmt-divider");
if (un.includes("drawio-fmt-section-header")) ok("文本/排列面板仍保留可折叠标题栏（section 未被整体删掉）");
else bad("drawio-fmt-section-header 从产物里消失了");

// ---- 7. 原型必须和落地实现同步（否则预览会骗人）----
console.log("原型 prototypes/style-palette-carousel.html");
const fsx = require("child_process");
const proto = fs.readFileSync(path.join(ROOT, "prototypes/style-palette-carousel.html"), "utf8");
const scripts = [...proto.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 1) bad(`内联 <script> 数量 ${scripts.length}（应为 1）`);
else {
  const jsFile = path.join(ROOT, ".workbuddy/tmp/_proto.js");
  fs.writeFileSync(jsFile, scripts[0]);
  try {
    fsx.execFileSync(process.execPath, ["--check", jsFile], { stdio: "pipe" });
    ok("内联 JS 语法检查通过");
  } catch (e) {
    bad("内联 JS 语法错误: " + (e.stderr ? e.stderr.toString().split("\n")[0] : e.message));
  }
}
// 原型的 PAGES 必须与源码 STYLE_PRESET_PAGES 完全一致
const pm = proto.match(/var PAGES = (\[[\s\S]*?\n\]);/);
if (!pm) bad("原型里找不到 PAGES 数组");
else {
  try {
    const p = new Function("return " + pm[1])();
    let diff = 0;
    if (p.length !== EXPECT.length) diff++;
    for (let i = 0; i < EXPECT.length; i++) {
      const pg = p[i] || [];
      if (pg.length !== 8) { diff++; continue; }
      for (let j = 0; j < 8; j++) {
        const a = pg[j], e = EXPECT[i][j];
        if ([a.fill, a.stroke, a.gradient ?? null, !!a.noFill].join("|") !== e.join("|")) {
          diff++;
          bad(`原型第 ${i + 1} 页第 ${j + 1} 块与源码不一致`);
        }
      }
    }
    if (!diff) ok("原型 PAGES（48 组）与 src/FormatPanel.ts / 参考图三方一致");
  } catch (e) { bad("原型 PAGES 求值失败: " + e.message); }
}
// 两列对照是否齐、②③ 是否共用同一套 palette 结构
const cols = (proto.match(/class="sidebar"/g) || []).length;
(cols === 2 ? ok : bad)(`对照列数 ${cols}（② 现状 / ③ 本次 应为 2）`);
const pals = (proto.match(/class="drawio-fmt-palette" data-palette/g) || []).length;
(pals === 2 ? ok : bad)(`data-palette 挂载点 ${pals}（②③ 应各一个）`);
// ③ 必须是 3 个扁平分组；② 只有填充组是扁平的，线条/效果仍是标题栏
const flats = (proto.match(/class="drawio-fmt-flat"/g) || []).length;
(flats === 4 ? ok : bad)(`.drawio-fmt-flat 出现 ${flats} 次（② 填充 1 + ③ 三组 3 = 4）`);
const secs = (proto.match(/class="drawio-fmt-section open"/g) || []).length;
(secs === 2 ? ok : bad)(`② 列保留 ${secs} 个可折叠标题栏（线条 + 效果，应为 2）`);
if (proto.includes('<span>线条</span>') && proto.includes('<span>效果</span>'))
  ok("② 列仍渲染「线条」「效果」标题栏（对照的另一端）");
else bad("② 列缺少「线条 / 效果」标题栏，对照会失真");
// 只看标记部分：下方的说明块里也提到了「不透明度」，别把它算进来
const notesAt = proto.indexOf('class="notes"');
const markup = proto.slice(0, notesAt > 0 ? notesAt : proto.length);
if ((markup.match(/>不透明度</g) || []).length === 2)
  ok("「不透明度」在②（组外）/③（组内）各出现一次");
else bad(`「不透明度」出现 ${(markup.match(/>不透明度</g) || []).length} 次（②③ 应各一次）`);
const lastFlat = markup.lastIndexOf('class="drawio-fmt-flat"');
const tail = markup.slice(lastFlat);
if (!/不透明度/.test(tail) && /drawio-fmt-effects-grid/.test(tail))
  ok("③ 最后一条分割线下面只有效果勾选框（不透明度在线之上）");
else bad("③ 的效果组里混进了其它行");
// 原型 CSS 的关键数值必须与 styles.css 一致
const want = [
  [/\.drawio-fmt-palette\s*\{\s*margin-bottom:\s*11px/, "palette margin-bottom 11px"],
  [/\.drawio-fmt-divider\s*\{[^}]*margin:\s*12px 0/, "基础 divider 12px"],
  [/\.drawio-fmt-flat > \.drawio-fmt-divider\s*\{\s*margin:\s*11px 0 10px/, "扁平 divider 11/10px"],
  [/\.drawio-fmt-palette \+ \.drawio-fmt-flat > \.drawio-fmt-divider\s*\{\s*margin-top:\s*0/, "首组 margin-top 归零"],
  [/aspect-ratio:\s*1\.5/, "色块 1.5 宽高比"],
  [/width:\s*9px; height:\s*9px/, "圆点 9px"],
  [/gap:\s*9px; margin-top:\s*10px/, "圆点间距 9px"],
  [/button:not\(\.clickable-icon\)\s*\{/, "Obsidian 按钮规则已抄入（否则按钮态会失真）"],
];
const badCss = want.filter(([re]) => !re.test(proto)).map(([, n]) => n);
(badCss.length === 0 ? ok : bad)(`原型 CSS 数值与落地一致 ${want.length - badCss.length}/${want.length}` +
  (badCss.length ? ` 缺: ${badCss.join(", ")}` : ""));

console.log("\n" + (fail ? `❌ ${fail} 项未通过` : "✅ 全部通过"));
process.exit(fail ? 1 : 0);
