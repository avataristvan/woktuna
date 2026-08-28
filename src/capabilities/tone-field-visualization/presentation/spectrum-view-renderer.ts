import type { FrequencyBar } from '../domain/spectrum-to-bars'

const BACKGROUND_COLOR = '#111111'
const BAR_COLOR = '#4fc3f7'
const BAR_GAP_RATIO = 0.2

/**
 * Renders `FrequencyBar[]` (from `domain/spectrum-to-bars.ts`) as a
 * left-to-right vertical bar chart — a spectrum/equalizer diagnostic view.
 *
 * Not unit tested — Canvas drawing correctness is verified manually/visually
 * (see this capability's `__demo__/spectrum-demo` page) per the project's
 * testing split.
 */
export class SpectrumViewRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly resizeObserver: ResizeObserver
  private latestBars: FrequencyBar[] | null = null
  private dprMediaQuery: MediaQueryList | null = null
  private readonly onDprChange = (): void => this.resizeToDisplaySize()
  private cssWidth = 0
  private cssHeight = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('SpectrumViewRenderer: 2d rendering context unavailable')
    }
    this.context = context

    // Canvas has no free DPI scaling the way SVG viewBox does — the backing
    // store must be explicitly resized to devicePixelRatio and the drawing
    // transform scaled back down so draw calls can stay in CSS pixel units.
    this.resizeObserver = new ResizeObserver(() => this.resizeToDisplaySize())
    this.resizeObserver.observe(canvas)
    this.resizeToDisplaySize()
  }

  render(bars: FrequencyBar[]): void {
    this.latestBars = bars
    this.draw(bars)
  }

  dispose(): void {
    this.resizeObserver.disconnect()
    this.dprMediaQuery?.removeEventListener('change', this.onDprChange)
  }

  /**
   * ResizeObserver only fires on element size changes — browser zoom or
   * moving the window to a different-DPI monitor changes
   * window.devicePixelRatio without resizing the canvas element, so it needs
   * its own listener. A matchMedia query for the *current* dpr fires exactly
   * once, when that value stops matching, so the listener is re-armed for
   * the new dpr on every change.
   */
  private watchDevicePixelRatio(): void {
    this.dprMediaQuery?.removeEventListener('change', this.onDprChange)
    const dpr = window.devicePixelRatio || 1
    this.dprMediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`)
    this.dprMediaQuery.addEventListener('change', this.onDprChange)
  }

  private resizeToDisplaySize(): void {
    const dpr = window.devicePixelRatio || 1
    const { width: cssWidth, height: cssHeight } = this.canvas.getBoundingClientRect()
    this.cssWidth = cssWidth
    this.cssHeight = cssHeight
    const backingWidth = Math.max(1, Math.round(cssWidth * dpr))
    const backingHeight = Math.max(1, Math.round(cssHeight * dpr))

    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth
      this.canvas.height = backingHeight
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.watchDevicePixelRatio()

    if (this.latestBars) {
      this.draw(this.latestBars)
    }
  }

  private draw(bars: FrequencyBar[]): void {
    const cssWidth = this.cssWidth
    const cssHeight = this.cssHeight
    const ctx = this.context
    ctx.fillStyle = BACKGROUND_COLOR
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    if (bars.length === 0) return

    const slotWidth = cssWidth / bars.length
    const barWidth = slotWidth * (1 - BAR_GAP_RATIO)
    ctx.fillStyle = BAR_COLOR

    bars.forEach((bar, index) => {
      const barHeight = bar.normalizedHeight * cssHeight
      const x = index * slotWidth + (slotWidth - barWidth) / 2
      const y = cssHeight - barHeight
      ctx.fillRect(x, y, barWidth, barHeight)
    })
  }
}
