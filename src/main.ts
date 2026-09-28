import './style.css'
import { bootstrap } from './app/bootstrap'
import type { HammerMode } from './app/app-state'

// Defensive dev-mode cleanup: vite-plugin-pwa's devOptions.enabled stays at
// its default false (see CLAUDE.md's PWA policy), so this build never
// registers a service worker itself in dev. This only guards against a
// stale SW left behind in a browser profile from an earlier session where
// devOptions.enabled was manually flipped on for local debugging — without
// it, that stale SW would keep serving a cached build indefinitely.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister()
    }
  })
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <header class="app-header"><h1>WokTuna</h1></header>
    <section class="status-area">
      <p id="status-text" role="status" aria-live="polite">Tap Start, then allow microphone access</p>
      <p id="note-name">—</p>
      <p id="error-text" role="alert" hidden></p>
    </section>
    <button id="start-button" type="button" class="primary">Start</button>
    <div id="tuner-panel"></div>
    <canvas id="tone-field-canvas"></canvas>
    <details class="settings">
      <summary>Settings</summary>
      <div class="controls">
        <label for="reference-pitch-input">Reference pitch (Hz)</label>
        <input
          type="number"
          id="reference-pitch-input"
          list="reference-pitch-presets"
          value="440"
          min="400"
          max="480"
          step="0.1"
        />
        <datalist id="reference-pitch-presets">
          <option value="440"></option>
          <option value="442"></option>
          <option value="443"></option>
        </datalist>
      </div>
      <div class="controls">
        <label for="tolerance-cents-input">Partial search tolerance (cents)</label>
        <input
          type="number"
          id="tolerance-cents-input"
          list="tolerance-cents-presets"
          value="250"
          min="50"
          max="500"
          step="1"
        />
        <datalist id="tolerance-cents-presets">
          <option value="150"></option>
          <option value="250"></option>
          <option value="350"></option>
        </datalist>
      </div>
      <fieldset class="hammer-mode">
        <legend>Hammering from</legend>
        <label><input type="radio" name="hammer-mode" value="outside" checked /> Outside</label>
        <label><input type="radio" name="hammer-mode" value="inside" /> Inside</label>
      </fieldset>
      <div class="spectrum-panel">
        <label><input type="checkbox" id="spectrum-toggle" /> Show spectrum</label>
        <canvas id="spectrum-canvas" hidden></canvas>
      </div>
    </details>
  </main>
`

const startButton = document.querySelector<HTMLButtonElement>('#start-button')!
const canvas = document.querySelector<HTMLCanvasElement>('#tone-field-canvas')!
const statusText = document.querySelector<HTMLElement>('#status-text')!
const noteName = document.querySelector<HTMLElement>('#note-name')!
const errorText = document.querySelector<HTMLElement>('#error-text')!
const tunerPanelContainer = document.querySelector<HTMLElement>('#tuner-panel')!
const hammerModeInputs = document.querySelectorAll<HTMLInputElement>(
  'input[name="hammer-mode"]',
)
const spectrumToggle =
  document.querySelector<HTMLInputElement>('#spectrum-toggle')!
const spectrumCanvas =
  document.querySelector<HTMLCanvasElement>('#spectrum-canvas')!
const referencePitchInput = document.querySelector<HTMLInputElement>(
  '#reference-pitch-input',
)!
const toleranceCentsInput = document.querySelector<HTMLInputElement>(
  '#tolerance-cents-input',
)!

const app = bootstrap({
  canvas,
  noteName,
  statusText,
  tunerPanelContainer,
  spectrumCanvas,
})

// Sane instrument-tuning range, not a claim about a correct value — see
// `UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ` in `resolve-target-note.ts`.
const MIN_REFERENCE_PITCH_HZ = 400
const MAX_REFERENCE_PITCH_HZ = 480
let lastValidReferencePitchHz = referencePitchInput.valueAsNumber

referencePitchInput.addEventListener('change', () => {
  const hz = referencePitchInput.valueAsNumber
  if (
    !Number.isFinite(hz) ||
    hz < MIN_REFERENCE_PITCH_HZ ||
    hz > MAX_REFERENCE_PITCH_HZ
  ) {
    referencePitchInput.value = String(lastValidReferencePitchHz)
    return
  }
  lastValidReferencePitchHz = hz
  app.setReferencePitchHz(hz)
})

// DEFAULT_TOLERANCE_CENTS in fft-peak-picking.ts is 250; 50-500 keeps the
// field within an instrument-tuning-sane range without asserting a correct
// value — see the doc comment on that constant for the narrow-vs-wide
// tradeoff this controls.
const MIN_TOLERANCE_CENTS = 50
const MAX_TOLERANCE_CENTS = 500
let lastValidToleranceCents = toleranceCentsInput.valueAsNumber

toleranceCentsInput.addEventListener('change', () => {
  const cents = toleranceCentsInput.valueAsNumber
  if (
    !Number.isFinite(cents) ||
    cents < MIN_TOLERANCE_CENTS ||
    cents > MAX_TOLERANCE_CENTS
  ) {
    toleranceCentsInput.value = String(lastValidToleranceCents)
    return
  }
  lastValidToleranceCents = cents
  app.setToleranceCents(cents)
})

for (const input of hammerModeInputs) {
  input.addEventListener('change', () => {
    if (input.checked) app.setHammerMode(input.value as HammerMode)
  })
}

startButton.addEventListener('click', () => {
  startButton.disabled = true
  errorText.hidden = true
  app
    .start()
    .then(() => {
      startButton.hidden = true
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      errorText.textContent = `Microphone access failed: ${message}`
      errorText.hidden = false
      statusText.textContent = 'Could not start'
      startButton.textContent = 'Try again'
      startButton.disabled = false
    })
})

spectrumToggle.addEventListener('change', () => {
  spectrumCanvas.hidden = !spectrumToggle.checked
  app.setSpectrumVisible(spectrumToggle.checked)
})
