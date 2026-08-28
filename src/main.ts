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
