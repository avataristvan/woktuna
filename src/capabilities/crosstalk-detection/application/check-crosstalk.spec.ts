import { describe, expect, it } from 'vitest'
import type { SpectrumAnalyzer, SpectrumReading } from '../../tone-field-detection/application/ports'
import type { Scale } from '../../scale-configuration/domain/scale'
import { noteToFrequency } from '../../scale-configuration/domain/note'
import { CheckCrosstalk } from './check-crosstalk'

const REFERENCE_PITCH_HZ = 440
const BIN_RESOLUTION_HZ = 5
const SPECTRUM_LENGTH = 2000

/** Deterministic PRNG (mulberry32) so the pure-noise baseline is reproducible across runs. */
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
 * A test-double `SpectrumAnalyzer` that ignores the frame/sampleRate it's
 * given and returns a fixed synthetic spectrum — the `AudioFrameSource`
 * fake pattern used elsewhere in this codebase, applied to the
 * `SpectrumAnalyzer` port instead (see `ports.ts`).
 */
class FakeSpectrumAnalyzer implements SpectrumAnalyzer {
  private readonly reading: SpectrumReading

  constructor(reading: SpectrumReading) {
    this.reading = reading
  }

  analyzeSpectrum(): SpectrumReading {
    return this.reading
  }
}

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

const scale: Scale = { name: 'D Kurd', notes: ['D3', 'A3', 'A#3', 'C4', 'D4', 'E4', 'F4', 'A4'] }

describe('CheckCrosstalk', () => {
  it('resolves a warning to its suspected note name', () => {
    const tunedNote = 'D3'
    const crosstalkNote = 'A3'
    const tunedHz = noteToFrequency(tunedNote, REFERENCE_PITCH_HZ)
    const crosstalkHz = noteToFrequency(crosstalkNote, REFERENCE_PITCH_HZ)

    const spectrum = makeSpectrum([{ hz: crosstalkHz, magnitude: 25 }])
    const useCase = new CheckCrosstalk(new FakeSpectrumAnalyzer(spectrum))

    const warnings = useCase.check(new Float32Array(1024), 48000, tunedHz, scale, REFERENCE_PITCH_HZ)

    expect(warnings).toHaveLength(1)
    expect(warnings[0].suspectedNote).toBe(crosstalkNote)
    expect(warnings[0].targetHz).toBeCloseTo(crosstalkHz, 5)
  })

  it('returns no warnings when the spectrum is only noise', () => {
    const tunedHz = noteToFrequency('D3', REFERENCE_PITCH_HZ)
    const spectrum = makeSpectrum([])
    const useCase = new CheckCrosstalk(new FakeSpectrumAnalyzer(spectrum))

    const warnings = useCase.check(new Float32Array(1024), 48000, tunedHz, scale, REFERENCE_PITCH_HZ)

    expect(warnings).toHaveLength(0)
  })

  it('never flags the note currently being tuned', () => {
    const tunedNote = 'D3'
    const tunedHz = noteToFrequency(tunedNote, REFERENCE_PITCH_HZ)

    const spectrum = makeSpectrum([{ hz: tunedHz, magnitude: 40 }])
    const useCase = new CheckCrosstalk(new FakeSpectrumAnalyzer(spectrum))

    const warnings = useCase.check(new Float32Array(1024), 48000, tunedHz, scale, REFERENCE_PITCH_HZ)

    expect(warnings.some((warning) => warning.suspectedNote === tunedNote)).toBe(false)
  })
})
