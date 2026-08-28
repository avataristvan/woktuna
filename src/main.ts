import './style.css'
import { bootstrap } from './app/bootstrap'
import type { HammerMode } from './app/app-state'
import { KNOWN_SCALES } from './capabilities/scale-configuration/infrastructure/known-scales'

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
  </main>
`

const scaleSelect = document.querySelector<HTMLSelectElement>('#scale-select')!
const startButton = document.querySelector<HTMLButtonElement>('#start-button')!
const canvas = document.querySelector<HTMLCanvasElement>('#tone-field-canvas')!
const readout = document.querySelector<HTMLParagraphElement>('#readout')!
const hammerModeInputs = document.querySelectorAll<HTMLInputElement>('input[name="hammer-mode"]')

for (const scale of KNOWN_SCALES) {
  const option = document.createElement('option')
  option.value = scale.name
  option.textContent = scale.name
  scaleSelect.append(option)
}

const app = bootstrap({ canvas, noteReadout: readout })

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
  app.start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    readout.textContent = `Microphone access failed: ${message}`
    startButton.disabled = false
  })
})
