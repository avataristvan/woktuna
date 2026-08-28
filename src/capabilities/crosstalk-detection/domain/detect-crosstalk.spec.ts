import { describe, expect, it } from 'vitest'
import type { SpectrumReading } from '../../tone-field-detection/application/ports'
import { detectCrosstalk } from './detect-crosstalk'

// Fine enough that a ±50-cent band around a few-hundred-Hz target spans
// several bins — coarser resolution collapsed the band to 0-1 bins, which
// made bandPeak's binHigh<=binLow guard reject every candidate outright.
const BIN_RESOLUTION_HZ = 1
const SPECTRUM_LENGTH = 700

/** Deterministic PRNG (mulberry32) so the pure-noise test is reproducible across runs. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Builds a synthetic `SpectrumReading` with a flat noise floor everywhere
 * and, optionally, sharp peaks injected at given Hz values — avoids
 * depending on the real FFT for these pure-domain tests, matching how
 * `fft-peak-picking.spec.ts` synthesizes time-domain signals but one layer
 * further up (directly as a spectrum, since `detectCrosstalk` never
 * touches raw audio).
 */
function makeSpectrum(peaksHz: readonly { hz: number; magnitude: number }[]): SpectrumReading {
  const random = mulberry32(20260828)
  const magnitudes = new Float32Array(SPECTRUM_LENGTH)
  for (let bin = 0; bin < SPECTRUM_LENGTH; bin++) {
    magnitudes[bin] = 0.5 + random() * 0.2
  }
  for (const { hz, magnitude } of peaksHz) {
    const bin = Math.round(hz / BIN_RESOLUTION_HZ)
    magnitudes[bin] = magnitude
  }

  return {
    magnitudes,
    binToHz: (bin: number) => bin * BIN_RESOLUTION_HZ,
    hzToBin: (hz: number) => hz / BIN_RESOLUTION_HZ,
  }
}

const TOLERANCE_CENTS = 50

describe('detectCrosstalk', () => {
  it('flags a non-tuned scale target that shows a genuine spectral peak', () => {
    const tunedHz = 200
    const otherTargetHz = 300
    const spectrum = makeSpectrum([{ hz: otherTargetHz, magnitude: 20 }])

    const warnings = detectCrosstalk(spectrum, tunedHz, [tunedHz, otherTargetHz, 500], TOLERANCE_CENTS)

    expect(warnings).toHaveLength(1)
    expect(warnings[0].targetHz).toBe(otherTargetHz)
    expect(warnings[0].magnitude).toBeCloseTo(20, 3)
  })

  it('returns no warnings for a spectrum that is only noise', () => {
    const tunedHz = 200
    const spectrum = makeSpectrum([])

    const warnings = detectCrosstalk(spectrum, tunedHz, [tunedHz, 300, 500], TOLERANCE_CENTS)

    expect(warnings).toHaveLength(0)
  })

  it('excludes the currently-tuned target even when it has the strongest peak', () => {
    const tunedHz = 200
    const otherTargetHz = 300
    const spectrum = makeSpectrum([
      { hz: tunedHz, magnitude: 50 },
      { hz: otherTargetHz, magnitude: 20 },
    ])

    const warnings = detectCrosstalk(spectrum, tunedHz, [tunedHz, otherTargetHz, 500], TOLERANCE_CENTS)

    expect(warnings.some((warning) => warning.targetHz === tunedHz)).toBe(false)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].targetHz).toBe(otherTargetHz)
  })

  it('sorts multiple warnings by magnitude descending', () => {
    const tunedHz = 200
    const spectrum = makeSpectrum([
      { hz: 300, magnitude: 15 },
      { hz: 500, magnitude: 30 },
    ])

    const warnings = detectCrosstalk(spectrum, tunedHz, [tunedHz, 300, 500], TOLERANCE_CENTS)

    expect(warnings).toHaveLength(2)
    expect(warnings[0].targetHz).toBe(500)
    expect(warnings[1].targetHz).toBe(300)
  })
})
