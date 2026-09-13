/**
 * 画布标尺：画布区上边缘与左边缘的两条刻度条。
 *
 * 实现要点：
 * - 标尺用绝对定位覆盖在画布区上，打开时给 `.drawio-graph-container` 加 20px 上/左外边距，
 *   把画布真正「挤」进去——这样标尺不遮挡内容，也不需要改动 mxGraph 容器本身的结构。
 * - 刻度按模型坐标换算：容器像素 px = view.scale * (模型坐标 + view.translate)，
 *   与 mxGraphView.updateCellState 的 state.x = scale*(translate.x + origin.x) 一致。
 * - 主刻度间隔按缩放自适应（始终保持在屏幕上约 60px 以上），保证放大后不会密成一片。
 */

/** 主刻度的候选间隔（模型单位），从细到粗取第一个「屏幕上够宽」的 */
const STEP_CANDIDATES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
/** 主刻度在屏幕上的最小间距（像素） */
const MIN_MAJOR_PX = 60;
/** 次刻度在屏幕上的最小间距（像素），低于该值就不画次刻度 */
const MIN_MINOR_PX = 6;

export class Ruler {
  private area: HTMLElement;
  private hEl: HTMLElement;
  private vEl: HTMLElement;
  private cornerEl: HTMLElement;
  private onToggle: (visible: boolean) => void;
  private visible = false;

  constructor(area: HTMLElement, onToggle: (visible: boolean) => void) {
    this.area = area;
    this.onToggle = onToggle;

    this.cornerEl = area.createDiv({ cls: "drawio-ruler-corner" });
    this.hEl = area.createDiv({ cls: "drawio-ruler-h" });
    this.vEl = area.createDiv({ cls: "drawio-ruler-v" });
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.area.toggleClass("drawio-ruler-on", visible);
    if (!visible) {
      this.hEl.empty();
      this.vEl.empty();
    }
    // 画布容器尺寸变了，mxGraph 不会自己察觉，必须主动通知它重算
    this.onToggle(visible);
  }

  /** 视图缩放 / 平移 / 模型变化后重画刻度 */
  update(graph: any): void {
    if (!this.visible || !graph) return;

    const view = graph.getView ? graph.getView() : graph.view;
    if (!view) return;

    const scale = view.scale || 1;
    const tx = view.translate.x || 0;
    const ty = view.translate.y || 0;

    const step = this.chooseStep(scale);
    const minorStep = step / 5;

    this.drawAxis(this.hEl, {
      length: this.hEl.clientWidth,
      scale,
      translate: tx,
      step,
      minorStep,
      horizontal: true,
    });
    this.drawAxis(this.vEl, {
      length: this.vEl.clientHeight,
      scale,
      translate: ty,
      step,
      minorStep,
      horizontal: false,
    });
  }

  /** 选一个屏幕上够宽的主刻度间隔 */
  private chooseStep(scale: number): number {
    for (const s of STEP_CANDIDATES) {
      if (s * scale >= MIN_MAJOR_PX) return s;
    }
    return STEP_CANDIDATES[STEP_CANDIDATES.length - 1];
  }

  private drawAxis(
    el: HTMLElement,
    opt: {
      length: number;
      scale: number;
      translate: number;
      step: number;
      minorStep: number;
      horizontal: boolean;
    }
  ): void {
    el.empty();
    const { length, scale, translate, step, minorStep, horizontal } = opt;
    if (length <= 0) return;

    // 可视区域对应的模型坐标范围：px = scale * (model + translate)
    const modelStart = -translate;
    const modelEnd = length / scale - translate;

    const drawMinor = minorStep * scale >= MIN_MINOR_PX;
    const unit = drawMinor ? minorStep : step;
    const first = Math.ceil(modelStart / unit) * unit;

    for (let m = first; m <= modelEnd; m += unit) {
      // 浮点累加会飘，用取整后的比值判断是否落在主刻度上
      const isMajor = Math.abs(m / step - Math.round(m / step)) < 1e-6;
      if (!isMajor && !drawMinor) continue;

      const px = scale * (m + translate);
      if (px < 0 || px > length) continue;

      const tick = el.createDiv({
        cls: isMajor
          ? "drawio-ruler-tick drawio-ruler-tick-major"
          : "drawio-ruler-tick",
      });
      if (horizontal) {
        tick.style.left = `${px}px`;
      } else {
        tick.style.top = `${px}px`;
      }

      if (isMajor) {
        const label = el.createDiv({ cls: "drawio-ruler-label" });
        label.setText(String(Math.round(m)));
        if (horizontal) {
          label.style.left = `${px + 3}px`;
        } else {
          label.style.top = `${px + 2}px`;
        }
      }
    }
  }

  destroy(): void {
    this.hEl.remove();
    this.vEl.remove();
    this.cornerEl.remove();
  }
}
