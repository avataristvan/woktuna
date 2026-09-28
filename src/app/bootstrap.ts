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
import { buildTunerPanel } from '../capabilities/tone-field-visualization/domain/partial-meter'
import { TunerPanelView } from '../capabilities/tone-field-visualization/presentation/tuner-panel-view'
import { AppState } from './app-state'
import type { HammerMode } from './app-state'

export interface ToneFieldUiElements {
  canvas: HTMLCanvasElement
  noteName: HTMLElement
  statusText: HTMLElement
  tunerPanelContainer: HTMLElement
  spectrumCanvas: HTMLCanvasElement
}

// A partial hold (400 ms, AnalyzeToneField) is intentionally longer than this:
// the dimmed "silence" state only appears once the held partials have lapsed too.
const STALE_AFTER_MS = 300
const NO_NOTE_TEXT = '—'

type Guidance = ReturnType<typeof buildGuidance>

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

  // Pure DOM (jsdom-safe), so built eagerly: initial "—" rows show before start.
  const tunerPanelView = new TunerPanelView(elements.tunerPanelContainer)
  let renderer: CanvasToneFieldRenderer | null = null
  let lastGuidance: Guidance | null = null
  let lastReadingAtMs = 0
  let showingStale = false
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
      tunerPanelView.render(buildTunerPanel(guidance), { stale: false })
      renderer.render(guidance, { stale: false })
      elements.noteName.textContent = target.note
      elements.statusText.textContent = ''
      lastGuidance = guidance
      lastReadingAtMs = performance.now()
      showingStale = false
    } else if (
      !reading &&
      renderer &&
      lastGuidance &&
      !showingStale &&
      performance.now() - lastReadingAtMs > STALE_AFTER_MS
    ) {
      tunerPanelView.render(buildTunerPanel(lastGuidance), { stale: true })
      renderer.render(lastGuidance, { stale: true })
      elements.statusText.textContent = 'Listening…'
      showingStale = true
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
      elements.noteName.textContent = NO_NOTE_TEXT
      elements.statusText.textContent = 'Play a note'
      tunerPanelView.render(null, { stale: false })
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
