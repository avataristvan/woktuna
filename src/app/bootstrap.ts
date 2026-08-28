import { WebAudioMicrophoneSource } from '../capabilities/tone-field-detection/infrastructure/browser/web-audio-microphone-source'
import { AutocorrelationPitchDetector } from '../capabilities/tone-field-detection/infrastructure/pitch-detector'
import { AnalyzeToneField } from '../capabilities/tone-field-detection/application/analyze-tone-field'
import { SelectScale } from '../capabilities/scale-configuration/application/select-scale'
import { KNOWN_SCALES } from '../capabilities/scale-configuration/infrastructure/known-scales'
import { CanvasToneFieldRenderer } from '../capabilities/tone-field-visualization/presentation/canvas-tone-field-renderer'
import { buildGuidance } from '../capabilities/tone-field-visualization/application/build-guidance'
import { AppState } from './app-state'

export interface ToneFieldUiElements {
  canvas: HTMLCanvasElement
  noteReadout: HTMLElement
}

export interface ToneFieldApp {
  start(): Promise<void>
  selectScale(scaleName: string): void
}

/**
 * Composition root: wires mic capture → fundamental detection → scale
 * lookup → guidance mapping → canvas rendering into a running
 * requestAnimationFrame loop.
 *
 * The renderer is constructed lazily inside `start()` rather than here —
 * acquiring the 2D canvas context has no reason to wait on the mic gesture,
 * but deferring it keeps this function free of Canvas setup until the app
 * is actually running (and keeps it constructible in environments, like
 * jsdom, where a live canvas context isn't available).
 */
export function bootstrap(elements: ToneFieldUiElements): ToneFieldApp {
  const appState = new AppState(KNOWN_SCALES[0])
  const selectScale = new SelectScale(appState.activeScale)
  const microphoneSource = new WebAudioMicrophoneSource()
  const pitchDetector = new AutocorrelationPitchDetector()
  const analyzeToneField = new AnalyzeToneField(microphoneSource, pitchDetector)

  let renderer: CanvasToneFieldRenderer | null = null

  function tick(): void {
    const reading = analyzeToneField.analyze()
    if (reading && renderer) {
      const target = selectScale.nearestTargetFor(reading.fundamental.frequency)
      const guidance = buildGuidance(reading, target.targetHz)
      renderer.render(guidance)
      elements.noteReadout.textContent = `${target.note} — ${guidance.radial.centDeviation.toFixed(1)} cents`
    }
    requestAnimationFrame(tick)
  }

  return {
    async start() {
      await microphoneSource.start()
      renderer = new CanvasToneFieldRenderer(elements.canvas)
      requestAnimationFrame(tick)
    },

    selectScale(scaleName: string) {
      const scale = KNOWN_SCALES.find((known) => known.name === scaleName)
      if (!scale) return
      appState.activeScale = scale
      selectScale.setActiveScale(scale)
    },
  }
}
