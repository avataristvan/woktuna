import type { AxisGuidance, ToneFieldGuidance } from '../domain/guidance-model'
import { severityToColor } from './color-scale'

const OUTLINE_COLOR = '#888888'
const OUTLINE_WIDTH = 2

// Fraction of the oval's radius used for the "hit near center" zone and the
// inner edge of the "hit near edge" band. These are illustrative, not
// measured — see deviation-to-guidance.ts's comment on why this must stay a
// general zone, never a precise point.
const CENTER_ZONE_RADIUS_RATIO = 0.32
const EDGE_ZONE_INNER_RADIUS_RATIO = 0.8

// Angular half-width (radians) of an axis marker arc, drawn at each end of
// the axis to represent the "several distributed blows" pattern from
// research doc §2.4 rather than a single strike point.
const AXIS_MARKER_HALF_ANGLE = Math.PI / 7
const AXIS_MARKER_WIDTH = 10

/**
 * Renders a `ToneFieldGuidance` onto a canvas as an oval tone-field graphic:
 * a radial zone hinting center-vs-edge hammer bias for the fundamental, and
 * (when present) axis marker arcs for the octave (long axis) and compound
 * fifth (short axis) partials.
 *
 * Not unit tested — Canvas drawing correctness is verified manually/visually
 * (see this capability's `__demo__` page) per the project's testing split.
 */
export class CanvasToneFieldRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly resizeObserver: ResizeObserver
  private latestGuidance: ToneFieldGuidance | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('CanvasToneFieldRenderer: 2d rendering context unavailable')
    }
    this.context = context

    // Canvas has no free DPI scaling the way SVG viewBox does — the backing
    // store must be explicitly resized to devicePixelRatio and the drawing
    // transform scaled back down so draw calls can stay in CSS pixel units.
    this.resizeObserver = new ResizeObserver(() => this.resizeToDisplaySize())
    this.resizeObserver.observe(canvas)
    this.resizeToDisplaySize()
  }

  render(guidance: ToneFieldGuidance): void {
    this.latestGuidance = guidance
    this.draw(guidance)
  }

  dispose(): void {
    this.resizeObserver.disconnect()
  }

  private resizeToDisplaySize(): void {
    const dpr = window.devicePixelRatio || 1
    const { width: cssWidth, height: cssHeight } = this.canvas.getBoundingClientRect()
    const backingWidth = Math.max(1, Math.round(cssWidth * dpr))
    const backingHeight = Math.max(1, Math.round(cssHeight * dpr))

    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth
      this.canvas.height = backingHeight
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (this.latestGuidance) {
      this.draw(this.latestGuidance)
    }
  }

  private draw(guidance: ToneFieldGuidance): void {
    const { width: cssWidth, height: cssHeight } = this.canvas.getBoundingClientRect()
    const ctx = this.context
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const centerX = cssWidth / 2
    const centerY = cssHeight / 2
    // Long axis (octave, research doc §2.1) drawn horizontal, short axis
    // (compound fifth) vertical — an arbitrary but consistent screen
    // orientation; nothing in the physics constrains which way is "up".
    const radiusX = Math.min(cssWidth, cssHeight * 1.6) * 0.42
    const radiusY = radiusX * 0.62

    this.drawOvalOutline(ctx, centerX, centerY, radiusX, radiusY)
    this.drawRadialZone(ctx, centerX, centerY, radiusX, radiusY, guidance)
    this.drawAxisMarker(ctx, centerX, centerY, radiusX, radiusY, 'long', guidance.longAxis)
    this.drawAxisMarker(ctx, centerX, centerY, radiusX, radiusY, 'short', guidance.shortAxis)
  }

  private drawOvalOutline(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
  ): void {
    ctx.beginPath()
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.strokeStyle = OUTLINE_COLOR
    ctx.lineWidth = OUTLINE_WIDTH
    ctx.stroke()
  }

  /**
   * Draws the fundamental's center/edge bias as a filled zone, not a point —
   * see deviation-to-guidance.ts for why precision here would misrepresent
   * an empirically fuzzy hammering technique.
   */
  private drawRadialZone(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    guidance: ToneFieldGuidance,
  ): void {
    if (guidance.hammerBias === 'inTune') return

    const color = severityToColor(guidance.radial.severity)
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = color

    if (guidance.hammerBias === 'center') {
      ctx.beginPath()
      ctx.ellipse(
        centerX,
        centerY,
        radiusX * CENTER_ZONE_RADIUS_RATIO,
        radiusY * CENTER_ZONE_RADIUS_RATIO,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
      ctx.ellipse(
        centerX,
        centerY,
        radiusX * EDGE_ZONE_INNER_RADIUS_RATIO,
        radiusY * EDGE_ZONE_INNER_RADIUS_RATIO,
        0,
        0,
        Math.PI * 2,
        true,
      )
      ctx.fill('evenodd')
    }

    ctx.restore()
  }

  /**
   * Draws an axis's guidance as two short arcs near the oval's outer edge at
   * either end of the axis — a "distributed hits" zone (research doc §2.4),
   * not a precise crosshair.
   */
  private drawAxisMarker(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    axis: 'long' | 'short',
    axisGuidance: AxisGuidance | null,
  ): void {
    if (!axisGuidance) return

    const color = severityToColor(axisGuidance.severity)
    const baseAngle = axis === 'long' ? 0 : Math.PI / 2

    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = AXIS_MARKER_WIDTH
    ctx.lineCap = 'round'

    for (const angle of [baseAngle, baseAngle + Math.PI]) {
      ctx.beginPath()
      ctx.ellipse(
        centerX,
        centerY,
        radiusX,
        radiusY,
        0,
        angle - AXIS_MARKER_HALF_ANGLE,
        angle + AXIS_MARKER_HALF_ANGLE,
      )
      ctx.stroke()
    }

    ctx.restore()
  }
}
