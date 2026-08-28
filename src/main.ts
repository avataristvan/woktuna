import './style.css'
import { bootstrap } from './app/bootstrap'
import type { HammerMode } from './app/app-state'
import { KNOWN_SCALES } from './capabilities/scale-configuration/infrastructure/known-scales'

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
    <h1>WokTuna</h1>
    <p class="subtitle">Handpan tuning guidance</p>
    <div class="controls">
      <label for="scale-select">Scale</label>
      <select id="scale-select"></select>
      <button id="start-button" type="button">Start tuning</button>
    </div>
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
    <canvas id="tone-field-canvas"></canvas>
    <p id="readout">Press "Start tuning" and allow microphone access.</p>
    <p id="crosstalk-readout" class="crosstalk-readout" aria-live="polite"></p>

    <div class="scale-detection">
      <button id="detect-scale-button" type="button" disabled>Detect scale from strikes</button>
      <p id="scale-detection-readout"></p>
    </div>

    <div class="spectrum-panel">
      <label><input type="checkbox" id="spectrum-toggle" /> Show spectrum</label>
      <canvas id="spectrum-canvas" hidden></canvas>
    </div>
  </main>
`

const scaleSelect = document.querySelector<HTMLSelectElement>('#scale-select')!
const startButton = document.querySelector<HTMLButtonElement>('#start-button')!
const canvas = document.querySelector<HTMLCanvasElement>('#tone-field-canvas')!
const readout = document.querySelector<HTMLParagraphElement>('#readout')!
const crosstalkReadout =
  document.querySelector<HTMLParagraphElement>('#crosstalk-readout')!
const hammerModeInputs = document.querySelectorAll<HTMLInputElement>(
  'input[name="hammer-mode"]',
)
const detectScaleButton = document.querySelector<HTMLButtonElement>(
  '#detect-scale-button',
)!
const scaleDetectionReadout = document.querySelector<HTMLParagraphElement>(
  '#scale-detection-readout',
)!
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

for (const scale of KNOWN_SCALES) {
  const option = document.createElement('option')
  option.value = scale.name
  option.textContent = scale.name
  scaleSelect.append(option)
}

const app = bootstrap({
  canvas,
  noteReadout: readout,
  crosstalkReadout,
  scaleDetectionReadout,
  spectrumCanvas,
})

scaleSelect.addEventListener('change', () => {
  app.selectScale(scaleSelect.value)
})

// Sane instrument-tuning range, not a claim about a correct value — see
// `UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ` in `select-scale.ts`.
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
  app
    .start()
    .then(() => {
      detectScaleButton.disabled = false
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      readout.textContent = `Microphone access failed: ${message}`
      startButton.disabled = false
    })
})

let isDetectingScale = false

detectScaleButton.addEventListener('click', () => {
  if (!isDetectingScale) {
    isDetectingScale = true
    detectScaleButton.textContent = 'Finish detecting'
    app.startScaleDetection()
    return
  }

  isDetectingScale = false
  detectScaleButton.textContent = 'Detect scale from strikes'
  const result = app.finishScaleDetection()

  if (result.isKnownScale) {
    scaleDetectionReadout.textContent = `Detected known scale: ${result.scale.name} (${Math.round(result.confidence * 100)}% confidence).`
  } else {
    scaleDetectionReadout.textContent = `No known scale matched confidently — built a custom scale from the ${result.scale.notes.length} note(s) struck.`
  }

  let option = [...scaleSelect.options].find(
    (candidate) => candidate.value === result.scale.name,
  )
  if (!option) {
    option = document.createElement('option')
    option.value = result.scale.name
    option.textContent = result.scale.name
    scaleSelect.append(option)
  }
  scaleSelect.value = result.scale.name
})

spectrumToggle.addEventListener('change', () => {
  spectrumCanvas.hidden = !spectrumToggle.checked
  app.setSpectrumVisible(spectrumToggle.checked)
})
