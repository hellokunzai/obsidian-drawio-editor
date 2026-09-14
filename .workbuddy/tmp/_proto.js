
var OLD = [
  ["#ffffff","#333333"],["#dbeafe","#167dff"],["#dcfce7","#16a34a"],["#fef3c7","#d97706"],
  ["#fee2e2","#dc2626"],["#f3e8ff","#7c3aed"],["#fde68a","#b45309"],["#bfdbfe","#1d4ed8"],
  ["#333333","#000000"],["#167dff","#0f5fd6"],["#16a34a","#15803d"],["#dc2626","#991b1b"]
];

/* 与 src/FormatPanel.ts 的 STYLE_PRESET_PAGES 完全一致 */
var PAGES = [
  [{fill:"#ffffff",stroke:"#000000"},{fill:"#f5f5f5",stroke:"#666666"},{fill:"#dae8fc",stroke:"#6c8ebf"},{fill:"#d5e8d4",stroke:"#82b366"},
   {fill:"#ffe6cc",stroke:"#d79b00"},{fill:"#fff2cc",stroke:"#d6b656"},{fill:"#f8cecc",stroke:"#b85450"},{fill:"#e1d5e7",stroke:"#9673a6"}],
  [{fill:"#ffffff",stroke:"#000000"},{fill:"#60a917",stroke:"#2d7600"},{fill:"#008a00",stroke:"#005700"},{fill:"#1ba1e2",stroke:"#006eaf"},
   {fill:"#0050ef",stroke:"#001dbc"},{fill:"#6a00ff",stroke:"#3700cc"},{fill:"#d80073",stroke:"#a50040"},{fill:"#a20025",stroke:"#6f0000"}],
  [{fill:"#e51400",stroke:"#b20000"},{fill:"#fa6800",stroke:"#c73500"},{fill:"#f0a30a",stroke:"#bd7000"},{fill:"#e3c800",stroke:"#b09500"},
   {fill:"#6d8764",stroke:"#3a5431"},{fill:"#647687",stroke:"#314354"},{fill:"#76608a",stroke:"#432d57"},{fill:"#a0522d",stroke:"#6d1f00"}],
  [{fill:"#ffffff",stroke:"#000000"},{fill:"#ffffff",stroke:"#000000",noFill:true},{fill:"#fad7ac",stroke:"#b46504"},{fill:"#fad9d5",stroke:"#ae4132"},
   {fill:"#b0e3e6",stroke:"#0e8088"},{fill:"#b1ddf0",stroke:"#10739e"},{fill:"#d0cee2",stroke:"#56517e"},{fill:"#bac8d3",stroke:"#23445d"}],
  [{fill:"#ffffff",stroke:"#000000"},{fill:"#f6f6f6",stroke:"#666666",gradient:"#b0b0b0"},{fill:"#dce9fc",stroke:"#6c8ebf",gradient:"#79a2df"},{fill:"#d6e8d5",stroke:"#82b366",gradient:"#94cf72"},
   {fill:"#ffce29",stroke:"#d79b00",gradient:"#ffa300"},{fill:"#fff3ce",stroke:"#d6b656",gradient:"#ffd861"},{fill:"#f8d0ce",stroke:"#b85450",gradient:"#e96661"},{fill:"#e6d1df",stroke:"#996185",gradient:"#d46e99"}],
  [{fill:"#ffffff",stroke:"#000000"},{fill:"#eeeeee",stroke:"#36393d"},{fill:"#f9f7ed",stroke:"#36393d"},{fill:"#ffcc99",stroke:"#36393d"},
   {fill:"#cce5ff",stroke:"#36393d"},{fill:"#ffff88",stroke:"#36393d"},{fill:"#cdeb8b",stroke:"#36393d"},{fill:"#ffcccc",stroke:"#36393d"}]
];

/* 页签行（三列共用） */
Array.prototype.forEach.call(document.querySelectorAll("[data-tabs]"), function (host) {
  ["样式", "文本", "排列"].forEach(function (label, i) {
    var b = document.createElement("button");
    b.className = "fmt-tab" + (i === 0 ? " active" : "");
    b.textContent = label;
    host.appendChild(b);
  });
});

/* ① 更早那版：对角双色块 */
(function () {
  var oldGrid = document.getElementById("oldGrid");
  OLD.forEach(function (p) {
    var d = document.createElement("div");
    d.className = "sw";
    d.style.background = "linear-gradient(135deg, " + p[0] + " 0 50%, " + p[1] + " 50% 100%)";
    oldGrid.appendChild(d);
  });
})();

/* ②③ 同一套轮播组件：各自独立翻页，互不干扰 */
function mountPalette(root) {
  var grid = root.querySelector("[data-grid]");
  var dotsHost = root.querySelector("[data-dots]");
  var host = root.parentElement;
  var fillChip = host.querySelector("[data-fill-chip]");
  var strokeChip = host.querySelector("[data-stroke-chip]");
  var gradChip = host.querySelector("[data-grad-chip]");
  var page = 0, active = -1;

  function render() {
    grid.textContent = "";
    PAGES[page].forEach(function (s, i) {
      var index = page * 8 + i;
      var b = document.createElement("button");
      b.className = "drawio-fmt-swatch";
      if (s.noFill) {
        b.classList.add("is-none");
      } else {
        b.style.background = s.gradient
          ? "linear-gradient(180deg, " + s.fill + " 0%, " + s.gradient + " 100%)"
          : s.fill;
      }
      b.style.borderColor = s.stroke;
      b.title = (s.noFill ? "无填充" : (s.gradient ? s.fill + " → " + s.gradient : s.fill)) + " · 线条 " + s.stroke;
      b.setAttribute("aria-label", b.title);
      if (index === active) b.classList.add("active");
      b.addEventListener("click", function () {
        fillChip.style.background = s.noFill ? "transparent" : s.fill;
        strokeChip.style.background = s.stroke;
        gradChip.style.background = s.gradient || "transparent";
        active = index;
        render();
      });
      grid.appendChild(b);
    });
    Array.prototype.forEach.call(dotsHost.children, function (el, i) {
      el.classList.toggle("active", i === page);
    });
  }

  PAGES.forEach(function (_, idx) {
    var d = document.createElement("button");
    d.className = "drawio-fmt-style-dot";
    d.title = "第 " + (idx + 1) + " 组配色";
    d.setAttribute("aria-label", d.title);
    d.addEventListener("click", function () { page = idx; render(); });
    dotsHost.appendChild(d);
  });

  root.querySelector("[data-prev]").addEventListener("click", function () {
    page = (page - 1 + PAGES.length) % PAGES.length; render();      /* 循环翻页 */
  });
  root.querySelector("[data-next]").addEventListener("click", function () {
    page = (page + 1) % PAGES.length; render();
  });

  render();
}

Array.prototype.forEach.call(document.querySelectorAll("[data-palette]"), mountPalette);

/* 主题切换 */
document.getElementById("themeBtn").addEventListener("click", function () {
  var dark = document.body.classList.toggle("dark");
  this.textContent = dark ? "切换亮色主题" : "切换暗色主题";
  this.classList.toggle("on", dark);
});
