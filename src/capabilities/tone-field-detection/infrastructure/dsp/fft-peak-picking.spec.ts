import { describe, expect, it } from 'vitest'
import { detectPartialsByFftPeakPicking } from './fft-peak-picking'

const SAMPLE_RATE = 48000
const FRAME_LENGTH = 32768

function synthesize(components: readonly { freqHz: number; amplitude: number }[]): Float32Array {
  const frame = new Float32Array(FRAME_LENGTH)
  for (let i = 0; i < FRAME_LENGTH; i++) {
    const t = i / SAMPLE_RATE
    let sample = 0
    for (const { freqHz, amplitude } of components) {
      sample += amplitude * Math.sin(2 * Math.PI * freqHz * t)
    }
    frame[i] = sample
  }
  return frame
}

function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b)
}

describe('detectPartialsByFftPeakPicking', () => {
  it.each([110, 220, 330])('finds the octave and compound fifth for f0=%iHz', (f0) => {
    const frame = synthesize([
      { freqHz: f0, amplitude: 1 },
      { freqHz: f0 * 2, amplitude: 0.5 },
      { freqHz: f0 * 3, amplitude: 0.3 },
    ])

    const { octaveHz, compoundFifthHz } = detectPartialsByFftPeakPicking(frame, SAMPLE_RATE, f0)

    expect(octaveHz).not.toBeNull()
    expect(Math.abs(centsBetween(octaveHz as number, f0 * 2))).toBeLessThan(10)

    expect(compoundFifthHz).not.toBeNull()
    expect(Math.abs(centsBetween(compoundFifthHz as number, f0 * 3))).toBeLessThan(10)
  })

  it('finds a partial deliberately detuned by 100 cents (tolerance window works)', () => {
    const f0 = 220
    const detunedOctaveHz = f0 * 2 * Math.pow(2, 100 / 1200)
    const frame = synthesize([
      { freqHz: f0, amplitude: 1 },
      { freqHz: detunedOctaveHz, amplitude: 0.5 },
    ])

    const { octaveHz } = detectPartialsByFftPeakPicking(frame, SAMPLE_RATE, f0)

    expect(octaveHz).not.toBeNull()
    expect(Math.abs(centsBetween(octaveHz as number, detunedOctaveHz))).toBeLessThan(10)
  })

  it('returns null for a partial that is missing entirely, rather than a false peak', () => {
    const f0 = 220
    const frame = synthesize([
      { freqHz: f0, amplitude: 1 },
      { freqHz: f0 * 2, amplitude: 0.5 },
      // no compound-fifth component at all
    ])

    const { compoundFifthHz } = detectPartialsByFftPeakPicking(frame, SAMPLE_RATE, f0)

    expect(compoundFifthHz).toBeNull()
  })

  it('returns null for a partial detuned beyond the tolerance window, rather than a wrong value', () => {
    const f0 = 220
    const wildlyDetunedFifthHz = f0 * 3 * Math.pow(2, 400 / 1200) // 400 cents, beyond the default ±250

    const frame = synthesize([
      { freqHz: f0, amplitude: 1 },
      { freqHz: f0 * 2, amplitude: 0.5 },
      { freqHz: wildlyDetunedFifthHz, amplitude: 0.3 },
    ])

    const { compoundFifthHz } = detectPartialsByFftPeakPicking(frame, SAMPLE_RATE, f0)

    expect(compoundFifthHz).toBeNull()
  })

  it('returns null for both partials on a silent frame (no fundamental energy to anchor the search)', () => {
    const silentFrame = new Float32Array(FRAME_LENGTH)

    const { octaveHz, compoundFifthHz } = detectPartialsByFftPeakPicking(silentFrame, SAMPLE_RATE, 220)

    expect(octaveHz).toBeNull()
    expect(compoundFifthHz).toBeNull()
  })
})
