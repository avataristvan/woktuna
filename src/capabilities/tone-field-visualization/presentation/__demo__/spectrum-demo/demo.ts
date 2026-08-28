import { barsFromSpectrum } from '../../../domain/spectrum-to-bars'
import type { SpectrumMagnitudes } from '../../../domain/spectrum-to-bars'
import { SpectrumViewRenderer } from '../../spectrum-view-renderer'

/**
 * Manual/browser-only verification page for the spectrum/equalizer view —
 * not part of the production app (wiring into `src/app/**` is a later
 * chunk). Feeds hardcoded synthetic `SpectrumMagnitudes` into
 * `barsFromSpectrum` + `SpectrumViewRenderer` so DPI handling and bar
 * rendering can be visually inspected. Lives in its own subfolder so it
 * doesn't touch the existing `__demo__/index.html` page.
 */

const SAMPLE_RATE = 44100
const FFT_SIZE = 16384
const BIN_HZ = SAMPLE_RATE / FFT_SIZE
const BIN_COUNT = FFT_SIZE / 2

function makeSpectrum(peaks: Array<{ hz: number; magnitude: number }>): SpectrumMagnitudes {
  const magnitudes = new Float32Array(BIN_COUNT)
  for (const { hz, magnitude } of peaks) {
    const bin = Math.round(hz / BIN_HZ)
    if (bin >= 0 && bin < BIN_COUNT) {
      magnitudes[bin] = magnitude
    }
  }
  return {
    magnitudes,
    binToHz: (bin) => bin * BIN_HZ,
    hzToBin: (hz) => hz / BIN_HZ,
  }
}

function noisySpectrum(): SpectrumMagnitudes {
  const magnitudes = new Float32Array(BIN_COUNT)
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    magnitudes[bin] = Math.random() * 0.6
  }
  const fundamentalBin = Math.round(196 / BIN_HZ)
  magnitudes[fundamentalBin] = 8
  return {
    magnitudes,
    binToHz: (bin) => bin * BIN_HZ,
    hzToBin: (hz) => hz / BIN_HZ,
  }
}

const samples: Array<{ label: string; spectrum: SpectrumMagnitudes }> = [
  { label: 'silence', spectrum: makeSpectrum([]) },
  {
    label: 'clean tone field: fundamental (196Hz G3) + octave + compound fifth',
    spectrum: makeSpectrum([
      { hz: 196, magnitude: 10 },
      { hz: 392, magnitude: 6 },
      { hz: 588, magnitude: 3 },
    ]),
  },
  {
    label: 'strong low fundamental (110Hz A2) only',
    spectrum: makeSpectrum([{ hz: 110, magnitude: 9 }]),
  },
  { label: 'fundamental with noise floor', spectrum: noisySpectrum() },
]

const grid = document.querySelector<HTMLDivElement>('#grid')!

for (const { label, spectrum } of samples) {
  const figure = document.createElement('figure')
  const caption = document.createElement('figcaption')
  caption.textContent = label
  const canvas = document.createElement('canvas')

  figure.append(caption, canvas)
  grid.append(figure)

  const renderer = new SpectrumViewRenderer(canvas)
  renderer.render(barsFromSpectrum(spectrum))
}
