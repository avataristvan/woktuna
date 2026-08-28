import { WebAudioMicrophoneSource } from '../capabilities/tone-field-detection/infrastructure/browser/web-audio-microphone-source'
import { AutocorrelationPitchDetector } from '../capabilities/tone-field-detection/infrastructure/pitch-detector'
import { FftPartialDetector } from '../capabilities/tone-field-detection/infrastructure/partial-detector'
import { FftSpectrumAnalyzer } from '../capabilities/tone-field-detection/infrastructure/spectrum-analyzer'
import { AnalyzeToneField } from '../capabilities/tone-field-detection/application/analyze-tone-field'
import { ResolveTargetNote } from '../capabilities/scale-configuration/application/resolve-target-note'
import { CanvasToneFieldRenderer } from '../capabilities/tone-field-visualization/presentation/canvas-tone-field-renderer'
import { SpectrumViewRenderer } from '../capabilities/tone-field-visualization/presentation/spectrum-view-renderer'
import { barsFromSpectrum } from '../capabilities/tone-field-visualization/domain/spectrum-to-bars'
import { buildGuidance } from '../capabilities/tone-field-visualization/application/build-guidance'
import { AppState } from './app-state'
import type { HammerMode } from './app-state'

export interface ToneFieldUiElements {
  canvas: HTMLCanvasElement
  noteReadout: HTMLElement
  spectrumCanvas: HTMLCanvasElement
}

export interface ToneFieldApp {
  start(): Promise<void>
  setHammerMode(mode: HammerMode): void
  setSpectrumVisible(visible: boolean): void
  setReferencePitchHz(hz: number): void
  setToleranceCents(cents: number): void
}

/**
 * Composition root: wires mic capture → fundamental detection → chromatic
 * nearest-note resolution → guidance mapping → canvas rendering into a
 * running requestAnimationFrame loop.
 *
 * `CanvasToneFieldRenderer` and `SpectrumViewRenderer` are both constructed
 * lazily (inside `start()` / `setSpectrumVisible()` respectively) rather
 * than here — acquiring a 2D canvas context has no reason to wait on the mic
 * gesture, but deferring it keeps this function free of Canvas setup until
 * the app is actually running (and keeps it constructible in environments,
 * like jsdom, where a live canvas context isn't available).
 */
export function bootstrap(elements: ToneFieldUiElements): ToneFieldApp {
  const appState = new AppState()
  const resolveTargetNote = new ResolveTargetNote()
  const microphoneSource = new WebAudioMicrophoneSource()
  const pitchDetector = new AutocorrelationPitchDetector()
  const partialDetector = new FftPartialDetector()
  const analyzeToneField = new AnalyzeToneField(
    microphoneSource,
    pitchDetector,
    { partialDetector },
  )
  const spectrumAnalyzer = new FftSpectrumAnalyzer()

  let renderer: CanvasToneFieldRenderer | null = null
  let spectrumRenderer: SpectrumViewRenderer | null = null
  let showSpectrum = false

  function tick(): void {
    const reading = analyzeToneField.analyze()

    if (reading && renderer) {
      const target = resolveTargetNote.resolveTarget(reading.fundamental.frequency)
      const guidance = buildGuidance(
        reading,
        target.targetHz,
        appState.hammerMode,
      )
      renderer.render(guidance)
      elements.noteReadout.textContent = `${target.note} — ${guidance.radial.centDeviation.toFixed(1)} cents`
    }

    if (showSpectrum && spectrumRenderer) {
      const frame = microphoneSource.getFrame()
      spectrumRenderer.render(
        barsFromSpectrum(
          spectrumAnalyzer.analyzeSpectrum(frame, microphoneSource.sampleRate),
        ),
      )
    }

    requestAnimationFrame(tick)
  }

  return {
    async start() {
      await microphoneSource.start()
      renderer = new CanvasToneFieldRenderer(elements.canvas)
      requestAnimationFrame(tick)
    },

    setHammerMode(mode: HammerMode) {
      appState.setHammerMode(mode)
    },

    setSpectrumVisible(visible: boolean) {
      showSpectrum = visible
      if (visible && !spectrumRenderer) {
        spectrumRenderer = new SpectrumViewRenderer(elements.spectrumCanvas)
      }
    },

    setReferencePitchHz(hz: number) {
      resolveTargetNote.setReferencePitchHz(hz)
    },

    setToleranceCents(cents: number) {
      partialDetector.setToleranceCents(cents)
    },
  }
}
