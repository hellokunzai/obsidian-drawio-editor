
/* ---------- 现状的 12 组（当前代码里的 QUICK_STYLES） ---------- */
var OLD = [
  ["#ffffff","#333333"],["#dbeafe","#167dff"],["#dcfce7","#16a34a"],["#fef3c7","#d97706"],
  ["#fee2e2","#dc2626"],["#f3e8ff","#7c3aed"],["#fde68a","#b45309"],["#bfdbfe","#1d4ed8"],
  ["#333333","#000000"],["#167dff","#0f5fd6"],["#16a34a","#15803d"],["#dc2626","#991b1b"]
];

/* ---------- 新版 6 页 × 8 组，逐像素取自截图 ----------
   fill    填充色
   stroke  描边色（= 色块边框色）
   grad    渐变色（仅第 5 页；竖向，上 = fill，下 = grad）
   isNone  无填充（棋盘格）
------------------------------------------------------- */
var PAGES = [
  [ /* 第 1 页 · 默认浅色 */
    {fill:"#ffffff", stroke:"#000000"},
    {fill:"#f5f5f5", stroke:"#666666"},
    {fill:"#dae8fc", stroke:"#6c8ebf"},
    {fill:"#d5e8d4", stroke:"#82b366"},
    {fill:"#ffe6cc", stroke:"#d79b00"},
    {fill:"#fff2cc", stroke:"#d6b656"},
    {fill:"#f8cecc", stroke:"#b85450"},
    {fill:"#e1d5e7", stroke:"#9673a6"}
  ],
  [ /* 第 2 页 · 饱和彩色 */
    {fill:"#ffffff", stroke:"#000000"},
    {fill:"#60a917", stroke:"#2d7600"},
    {fill:"#008a00", stroke:"#005700"},
    {fill:"#1ba1e2", stroke:"#006eaf"},
    {fill:"#0050ef", stroke:"#001dbc"},
    {fill:"#6a00ff", stroke:"#3700cc"},
    {fill:"#d80073", stroke:"#a50040"},
    {fill:"#a20025", stroke:"#6f0000"}
  ],
  [ /* 第 3 页 · 暖色 / 深色 */
    {fill:"#e51400", stroke:"#b20000"},
    {fill:"#fa6800", stroke:"#c73500"},
    {fill:"#f0a30a", stroke:"#bd7000"},
    {fill:"#e3c800", stroke:"#b09500"},
    {fill:"#6d8764", stroke:"#3a5431"},
    {fill:"#647687", stroke:"#314354"},
    {fill:"#76608a", stroke:"#432d57"},
    {fill:"#a0522d", stroke:"#6d1f00"}
  ],
  [ /* 第 4 页 · 粉彩（含无填充） */
    {fill:"#ffffff", stroke:"#000000"},
    {fill:"none",    stroke:"#000000", isNone:true},
    {fill:"#fad7ac", stroke:"#b46504"},
    {fill:"#fad9d5", stroke:"#ae4132"},
    {fill:"#b0e3e6", stroke:"#0e8088"},
    {fill:"#b1ddf0", stroke:"#10739e"},
    {fill:"#d0cee2", stroke:"#56517e"},
    {fill:"#bac8d3", stroke:"#23445d"}
  ],
  [ /* 第 5 页 · 渐变 */
    {fill:"#ffffff", stroke:"#000000"},
    {fill:"#f6f6f6", stroke:"#666666", grad:"#b0b0b0"},
    {fill:"#dce9fc", stroke:"#6c8ebf", grad:"#79a2df"},
    {fill:"#d6e8d5", stroke:"#82b366", grad:"#94cf72"},
    {fill:"#ffce29", stroke:"#d79b00", grad:"#ffa300"},
    {fill:"#fff3ce", stroke:"#d6b656", grad:"#ffd861"},
    {fill:"#f8d0ce", stroke:"#b85450", grad:"#e96661"},
    {fill:"#e6d1df", stroke:"#996185", grad:"#d46e99"}
  ],
  [ /* 第 6 页 · 柔和 */
    {fill:"#ffffff", stroke:"#000000"},
    {fill:"#eeeeee", stroke:"#36393d"},
    {fill:"#f9f7ed", stroke:"#36393d"},
    {fill:"#ffcc99", stroke:"#36393d"},
    {fill:"#cce5ff", stroke:"#36393d"},
    {fill:"#ffff88", stroke:"#36393d"},
    {fill:"#cdeb8b", stroke:"#36393d"},
    {fill:"#ffcccc", stroke:"#36393d"}
  ]
];

/* ---------- 现状 ---------- */
var gridOld = document.getElementById("gridOld");
OLD.forEach(function (p) {
  var d = document.createElement("div");
  d.className = "sw";
  d.style.background = "linear-gradient(135deg, " + p[0] + " 0 50%, " + p[1] + " 50% 100%)";
  gridOld.appendChild(d);
});

/* ---------- 新版 ---------- */
var gridNew   = document.getElementById("gridNew");
var dotsHost  = document.getElementById("dots");
var fillChip  = document.getElementById("fillChip");
var strokeChip= document.getElementById("strokeChip");
var page = 0;

function swatchStyle(s) {
  if (s.isNone) return { cls: "sw is-none", css: "" };
  var css = "background:" + (s.grad
    ? "linear-gradient(180deg, " + s.fill + " 0%, " + s.grad + " 100%)"
    : s.fill) + ";border-color:" + s.stroke + ";";
  return { cls: "sw", css: css };
}

function render() {
  gridNew.textContent = "";
  PAGES[page].forEach(function (s) {
    var st = swatchStyle(s);
    var d = document.createElement("div");
    d.className = st.cls;
    d.setAttribute("style", st.css);
    d.title = s.isNone ? "无填充 / " + s.stroke
                       : s.fill + (s.grad ? " → " + s.grad : "") + " / " + s.stroke;
    d.addEventListener("click", function () {
      fillChip.style.background   = s.isNone ? "#ffffff" : s.fill;
      strokeChip.style.background = s.stroke;
    });
    gridNew.appendChild(d);
  });
  Array.prototype.forEach.call(dotsHost.children, function (el, i) {
    el.classList.toggle("active", i === page);
  });
}

for (var i = 0; i < PAGES.length; i++) {
  (function (idx) {
    var b = document.createElement("button");
    b.className = "dot" + (idx === 0 ? " active" : "");
    b.title = "第 " + (idx + 1) + " 组";
    b.setAttribute("aria-label", "第 " + (idx + 1) + " 组配色");
    b.addEventListener("click", function () { page = idx; render(); });
    dotsHost.appendChild(b);
  })(i);
}

document.getElementById("prevBtn").addEventListener("click", function () {
  page = (page - 1 + PAGES.length) % PAGES.length;   // 循环翻页
  render();
});
document.getElementById("nextBtn").addEventListener("click", function () {
  page = (page + 1) % PAGES.length;
  render();
});

render();
