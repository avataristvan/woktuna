import { WebAudioMicrophoneSource } from '../capabilities/tone-field-detection/infrastructure/browser/web-audio-microphone-source'
import { AutocorrelationPitchDetector } from '../capabilities/tone-field-detection/infrastructure/pitch-detector'
import { FftPartialDetector } from '../capabilities/tone-field-detection/infrastructure/partial-detector'
import { FftSpectrumAnalyzer } from '../capabilities/tone-field-detection/infrastructure/spectrum-analyzer'
import { AnalyzeToneField } from '../capabilities/tone-field-detection/application/analyze-tone-field'
import { SelectScale } from '../capabilities/scale-configuration/application/select-scale'
import { KNOWN_SCALES } from '../capabilities/scale-configuration/infrastructure/known-scales'
import { CanvasToneFieldRenderer } from '../capabilities/tone-field-visualization/presentation/canvas-tone-field-renderer'
import { SpectrumViewRenderer } from '../capabilities/tone-field-visualization/presentation/spectrum-view-renderer'
import { barsFromSpectrum } from '../capabilities/tone-field-visualization/domain/spectrum-to-bars'
import { buildGuidance } from '../capabilities/tone-field-visualization/application/build-guidance'
import { DetectScaleFromStrikes } from '../capabilities/scale-inference/application/detect-scale-from-strikes'
import type { InferredScale } from '../capabilities/scale-inference/application/detect-scale-from-strikes'
import { CheckCrosstalk } from '../capabilities/crosstalk-detection/application/check-crosstalk'
import type { CrosstalkWarning } from '../capabilities/crosstalk-detection/domain/crosstalk-warning'
import { AppState } from './app-state'
import type { HammerMode } from './app-state'

/**
 * How often (in rAF frames) the crosstalk heuristic re-checks the spectrum.
 * `CheckCrosstalk` runs its own FFT (`SpectrumAnalyzer.analyzeSpectrum`),
 * separate from `FftPartialDetector`'s internal one — doing that on every
 * frame would double the FFT cost paid inside `analyzeToneField.analyze()`
 * for what is explicitly a heuristic "possible crosstalk" hint (see
 * `crosstalk-warning.ts`), not a precision measurement. Every 15 frames is
 * ~4 checks/sec at 60fps — far more often than a player can react to a
 * warning, while capping the double-FFT cost to a small fraction of frames.
 */
const CROSSTALK_CHECK_INTERVAL_FRAMES = 15

export interface ToneFieldUiElements {
  canvas: HTMLCanvasElement
  noteReadout: HTMLElement
  crosstalkReadout: HTMLElement
  scaleDetectionReadout: HTMLElement
  spectrumCanvas: HTMLCanvasElement
}

export interface ToneFieldApp {
  start(): Promise<void>
  selectScale(scaleName: string): void
  setHammerMode(mode: HammerMode): void
  startScaleDetection(): void
  finishScaleDetection(): InferredScale
  setSpectrumVisible(visible: boolean): void
  setReferencePitchHz(hz: number): void
  setToleranceCents(cents: number): void
}

/**
 * Composition root: wires mic capture → fundamental detection → scale
 * lookup → guidance mapping → canvas rendering into a running
 * requestAnimationFrame loop. Also wires the three post-MVP capabilities
 * (scale auto-detection, crosstalk warnings, spectrum view) into the same
 * loop — this is the one place they're allowed to share files.
 *
 * `CanvasToneFieldRenderer` and `SpectrumViewRenderer` are both constructed
 * lazily (inside `start()` / `setSpectrumVisible()` respectively) rather
 * than here — acquiring a 2D canvas context has no reason to wait on the mic
 * gesture, but deferring it keeps this function free of Canvas setup until
 * the app is actually running (and keeps it constructible in environments,
 * like jsdom, where a live canvas context isn't available).
 */
export function bootstrap(elements: ToneFieldUiElements): ToneFieldApp {
  const appState = new AppState(KNOWN_SCALES[0])
  const selectScale = new SelectScale(appState.activeScale)
  const microphoneSource = new WebAudioMicrophoneSource()
  const pitchDetector = new AutocorrelationPitchDetector()
  const partialDetector = new FftPartialDetector()
  const analyzeToneField = new AnalyzeToneField(
    microphoneSource,
    pitchDetector,
    { partialDetector },
  )
  const spectrumAnalyzer = new FftSpectrumAnalyzer()
  const checkCrosstalk = new CheckCrosstalk(spectrumAnalyzer)

  let renderer: CanvasToneFieldRenderer | null = null
  let spectrumRenderer: SpectrumViewRenderer | null = null
  let showSpectrum = false
  let detectScaleFromStrikes: DetectScaleFromStrikes | null = null
  let frameCount = 0

  function tick(): void {
    frameCount++
    const reading = analyzeToneField.analyze()

    if (reading && renderer) {
      const target = selectScale.nearestTargetFor(reading.fundamental.frequency)
      const guidance = buildGuidance(
        reading,
        target.targetHz,
        appState.hammerMode,
      )
      renderer.render(guidance)
      elements.noteReadout.textContent = `${target.note} — ${guidance.radial.centDeviation.toFixed(1)} cents`

      if (detectScaleFromStrikes) {
        detectScaleFromStrikes.recordStrike(reading.fundamental.frequency)
        const count = detectScaleFromStrikes.getCollectedCount()
        elements.scaleDetectionReadout.textContent = `Listening for strikes… ${count} distinct note${count === 1 ? '' : 's'} collected so far.`
      }
    }

    if (showSpectrum && spectrumRenderer) {
      const frame = microphoneSource.getFrame()
      spectrumRenderer.render(
        barsFromSpectrum(
          spectrumAnalyzer.analyzeSpectrum(frame, microphoneSource.sampleRate),
        ),
      )
    }

    if (reading && frameCount % CROSSTALK_CHECK_INTERVAL_FRAMES === 0) {
      const frame = microphoneSource.getFrame()
      const warnings = checkCrosstalk.check(
        frame,
        microphoneSource.sampleRate,
        reading.fundamental.frequency,
        appState.activeScale,
        selectScale.getReferencePitchHz(),
      )
      elements.crosstalkReadout.textContent =
        describeCrosstalkWarnings(warnings)
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

    setHammerMode(mode: HammerMode) {
      appState.setHammerMode(mode)
    },

    startScaleDetection() {
      detectScaleFromStrikes = new DetectScaleFromStrikes()
      elements.scaleDetectionReadout.textContent =
        'Listening for strikes… 0 distinct notes collected so far.'
    },

    finishScaleDetection(): InferredScale {
      if (!detectScaleFromStrikes) {
        throw new Error(
          'finishScaleDetection called before startScaleDetection',
        )
      }
      const result = detectScaleFromStrikes.inferScale(
        KNOWN_SCALES,
        selectScale.getReferencePitchHz(),
      )
      detectScaleFromStrikes = null

      appState.activeScale = result.scale
      selectScale.setActiveScale(result.scale)

      return result
    },

    setSpectrumVisible(visible: boolean) {
      showSpectrum = visible
      if (visible && !spectrumRenderer) {
        spectrumRenderer = new SpectrumViewRenderer(elements.spectrumCanvas)
      }
    },

    setReferencePitchHz(hz: number) {
      selectScale.setReferencePitchHz(hz)
    },

    setToleranceCents(cents: number) {
      partialDetector.setToleranceCents(cents)
    },
  }
}

/**
 * Renders crosstalk warnings with the same explicit hedging language used
 * elsewhere in this codebase for research doc §2.5's unresolved
 * crosstalk-axis question (see `crosstalk-warning.ts`) — "possible", never
 * "detected", since `CheckCrosstalk` never claims certainty.
 */
function describeCrosstalkWarnings(warnings: CrosstalkWarning[]): string {
  if (warnings.length === 0) {
    return ''
  }
  const descriptions = warnings.map(
    (warning) => warning.suspectedNote ?? `~${warning.targetHz.toFixed(0)}Hz`,
  )
  return `Possible crosstalk from: ${descriptions.join(', ')}`
}
