import type { AxisGuidance, ToneFieldGuidance } from '../domain/guidance-model'
import { deviationDirection } from '../domain/partial-meter'
import { severityToColor } from './color-scale'

const OUTLINE_COLOR = '#888888'
const OUTLINE_WIDTH = 2

// Fraction of the oval's radius used for the "hit near center" zone and the
// inner edge of the "hit near edge" band. These are illustrative, not
// measured — see deviation-to-guidance.ts's comment on why this must stay a
// general zone, never a precise point.
const CENTER_ZONE_RADIUS_RATIO = 0.32
const EDGE_ZONE_INNER_RADIUS_RATIO = 0.8

// Deliberately smaller than CENTER_ZONE_RADIUS_RATIO and drawn fully opaque
// (not the translucent hammer-bias fill) so "in tune, no more hammering
// needed" reads unmistakably differently from "hammer toward center" —
// see drawInTuneIndicator.
const IN_TUNE_INDICATOR_RADIUS_RATIO = 0.12

// Angular half-width (radians) of an axis marker arc, drawn at each end of
// the axis to represent the "several distributed blows" pattern from
// research doc §2.4 rather than a single strike point.
const AXIS_MARKER_HALF_ANGLE = Math.PI / 7
const AXIS_MARKER_WIDTH = 10

// Font size for the "+"/"-" direction glyph, relative to the oval's short
// radius. The edge-band glyph sits at this angle (45°, diagonal) rather than
// a cardinal direction so it never overlaps the axis marker arcs, which are
// centered on the cardinal angles (0/π for long axis, π/2/3π/2 for short).
const DIRECTION_MARKER_FONT_RATIO = 0.45
const EDGE_DIRECTION_MARKER_ANGLE = -Math.PI / 4
const EDGE_DIRECTION_MARKER_RADIUS_RATIO = 0.85

// Axis glyphs sit just inside the oval at each axis end, inside the arc's
// inner edge and clear of the 45° fundamental glyph.
const AXIS_DIRECTION_MARKER_FONT_RATIO = 0.28
const LONG_AXIS_GLYPH_RADIUS_RATIO = 0.78
const SHORT_AXIS_GLYPH_RADIUS_RATIO = 0.7

const STALE_ALPHA = 0.45

export interface RenderOptions {
  stale?: boolean
}

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
  private latestStale = false
  private dprMediaQuery: MediaQueryList | null = null
  private readonly onDprChange = (): void => this.resizeToDisplaySize()
  private cssWidth = 0
  private cssHeight = 0

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

  render(guidance: ToneFieldGuidance, options?: RenderOptions): void {
    this.latestGuidance = guidance
    this.latestStale = options?.stale ?? false
    this.draw(guidance, this.latestStale)
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

    if (this.latestGuidance) {
      this.draw(this.latestGuidance, this.latestStale)
    }
  }

  private draw(guidance: ToneFieldGuidance, stale: boolean): void {
    const cssWidth = this.cssWidth
    const cssHeight = this.cssHeight
    const ctx = this.context
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const centerX = cssWidth / 2
    const centerY = cssHeight / 2
    // Long axis (octave, research doc §2.1) drawn horizontal, short axis
    // (compound fifth) vertical — an arbitrary but consistent screen
    // orientation; nothing in the physics constrains which way is "up".
    const radiusX = Math.min(cssWidth, cssHeight * 1.6) * 0.42
    const radiusY = radiusX * 0.62

    ctx.save()
    if (stale) ctx.globalAlpha = STALE_ALPHA
    this.drawOvalOutline(ctx, centerX, centerY, radiusX, radiusY)
    this.drawRadialZone(ctx, centerX, centerY, radiusX, radiusY, guidance)
    this.drawAxisMarker(ctx, centerX, centerY, radiusX, radiusY, 'long', guidance.longAxis)
    this.drawAxisMarker(ctx, centerX, centerY, radiusX, radiusY, 'short', guidance.shortAxis)
    ctx.restore()
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
    if (guidance.hammerBias === 'inTune') {
      this.drawInTuneIndicator(ctx, centerX, centerY, radiusX, radiusY)
      return
    }

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

    this.drawDirectionMarker(
      ctx,
      centerX,
      centerY,
      radiusX,
      radiusY,
      guidance.hammerBias,
      deviationDirection(guidance.radial.centDeviation, guidance.radial.severity),
      color,
    )
  }

  /**
   * Draws a "+"/"-" glyph for the fundamental. Two independent facts are
   * encoded: POSITION is where to hammer (`hammerBias`, center vs edge —
   * mode-dependent, inverted in inside hammer mode), while the GLYPH is the
   * pitch direction (sign of the cent deviation, "+" sharp / "-" flat —
   * mode-independent). Drawn at full opacity with a dark outline
   * (independent of the zone fill's 0.35 alpha) so it stays legible against
   * the translucent fill.
   */
  private drawDirectionMarker(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    hammerBias: 'center' | 'edge',
    direction: 'low' | 'high' | 'inTune',
    color: string,
  ): void {
    if (direction === 'inTune') return
    const symbol = direction === 'high' ? '+' : '-'
    const [markerX, markerY] =
      hammerBias === 'center'
        ? [centerX, centerY]
        : [
            centerX + radiusX * EDGE_DIRECTION_MARKER_RADIUS_RATIO * Math.cos(EDGE_DIRECTION_MARKER_ANGLE),
            centerY + radiusY * EDGE_DIRECTION_MARKER_RADIUS_RATIO * Math.sin(EDGE_DIRECTION_MARKER_ANGLE),
          ]
    const fontSize = Math.round(radiusY * DIRECTION_MARKER_FONT_RATIO)

    ctx.save()
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = Math.max(2, fontSize * 0.12)
    ctx.strokeStyle = '#000000'
    ctx.strokeText(symbol, markerX, markerY)
    ctx.fillStyle = color
    ctx.fillText(symbol, markerX, markerY)
    ctx.restore()
  }

  /**
   * Draws the "in tune, no more hammering needed" indicator: a small, fully
   * opaque dot — deliberately smaller and solid (not the translucent
   * CENTER_ZONE_RADIUS_RATIO fill used for "hit center") so it reads as
   * "done" rather than as a hammering instruction, and never gets a +/-
   * direction glyph since neither "too high" nor "too low" applies here.
   */
  private drawInTuneIndicator(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
  ): void {
    ctx.save()
    ctx.fillStyle = severityToColor('inTune')
    ctx.beginPath()
    ctx.ellipse(
      centerX,
      centerY,
      radiusX * IN_TUNE_INDICATOR_RADIUS_RATIO,
      radiusY * IN_TUNE_INDICATOR_RADIUS_RATIO,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
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

    const direction = deviationDirection(axisGuidance.centDeviation, axisGuidance.severity)
    if (direction === 'inTune') return
    const symbol = direction === 'high' ? '+' : '-'
    const fontSize = Math.round(radiusY * AXIS_DIRECTION_MARKER_FONT_RATIO)
    const offsets =
      axis === 'long'
        ? [radiusX * LONG_AXIS_GLYPH_RADIUS_RATIO, 0]
        : [0, radiusY * SHORT_AXIS_GLYPH_RADIUS_RATIO]

    ctx.save()
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = Math.max(2, fontSize * 0.12)
    for (const sign of [1, -1]) {
      const x = centerX + sign * offsets[0]
      const y = centerY + sign * offsets[1]
      ctx.strokeStyle = '#000000'
      ctx.strokeText(symbol, x, y)
      ctx.fillStyle = color
      ctx.fillText(symbol, x, y)
    }
    ctx.restore()
  }
}
