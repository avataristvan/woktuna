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

function synthesizeNoise(amplitude: number): Float32Array {
  const random = mulberry32(20260828)
  const frame = new Float32Array(FRAME_LENGTH)
  for (let i = 0; i < FRAME_LENGTH; i++) {
    frame[i] = (random() * 2 - 1) * amplitude
  }
  return frame
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

  it('finds a partial deliberately detuned by 240 cents, close to but inside the tolerance boundary', () => {
    // DEFAULT_TOLERANCE_CENTS is 250; the real cutoff (measured empirically,
    // see the sibling "beyond tolerance" test) sits between 248 and 250
    // cents. 240 cents actually constrains the tolerance constant, unlike
    // the previous 100-cent value which was ~150 cents away from the real
    // boundary and wouldn't catch a regression to it.
    const f0 = 220
    const detunedOctaveHz = f0 * 2 * Math.pow(2, 240 / 1200)
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

  it('returns null for a partial detuned just beyond the tolerance boundary, rather than a wrong value', () => {
    // 270 cents sits just past the measured real cutoff (between 248 and
    // 250 cents for DEFAULT_TOLERANCE_CENTS=250), unlike the previous
    // 400-cent value which was far enough away that a regression to the
    // tolerance constant wouldn't have failed this test.
    const f0 = 220
    const detunedFifthHz = f0 * 3 * Math.pow(2, 270 / 1200)

    const frame = synthesize([
      { freqHz: f0, amplitude: 1 },
      { freqHz: f0 * 2, amplitude: 0.5 },
      { freqHz: detunedFifthHz, amplitude: 0.3 },
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

  it('returns null for both partials on a pure-noise frame with no real tone at all', () => {
    // Regression test for the Chunk 6.5 fix: the old `referenceMagnitude <=
    // 0` guard almost never fired against real (non-zero) noise, since
    // Math.hypot over FFT bins is essentially never exactly zero -- a
    // noise-only reference band used to confidently anchor two
    // false-positive partials instead of returning null.
    const noiseFrame = synthesizeNoise(0.05)

    const { octaveHz, compoundFifthHz } = detectPartialsByFftPeakPicking(noiseFrame, SAMPLE_RATE, 220)

    expect(octaveHz).toBeNull()
    expect(compoundFifthHz).toBeNull()
  })

  it('finds a genuinely quiet-but-real octave at 5% of the fundamental amplitude, in a clean low-noise signal', () => {
    // Regression test for the false-negative side of the same fix: tapping
    // along an axis to isolate a partial (handpan-stimm-app-recherche.md
    // §2.1) implies real partials aren't generally comparable in magnitude
    // to the fundamental. The old 5%-of-fundamental gate missed a measured
    // 4.5%-amplitude octave; the redesigned local-noise-floor check (the
    // primary discriminator now) should find a clean, quiet partial like
    // this one even though the old ratio gate sat right at its edge.
    const f0 = 220
    const frame = synthesize([
      { freqHz: f0, amplitude: 1 },
      { freqHz: f0 * 2, amplitude: 0.05 },
    ])

    const { octaveHz } = detectPartialsByFftPeakPicking(frame, SAMPLE_RATE, f0)

    expect(octaveHz).not.toBeNull()
    expect(Math.abs(centsBetween(octaveHz as number, f0 * 2))).toBeLessThan(10)
  })

  it('finds real partials at a low handpan-range fundamental with a smaller FFT window (16384)', () => {
    // Regression test for the low-f0 edge case flagged during the Chunk 6.5
    // review: a very low fundamental combined with a small FFT window can
    // make the tight ±50-cent fundamental-reference band collapse to just
    // 1-2 bins, which (before FLOOR_SAMPLE_EXTRA_BINS widened the noise
    // floor sampling beyond the band itself) made a real fundamental's own
    // Hann main lobe indistinguishable from its own "noise floor" and
    // wrongly returned null even for a clean signal.
    const f0 = 110
    const frameLength = 16384
    const frame = new Float32Array(frameLength)
    for (let i = 0; i < frameLength; i++) {
      const t = i / SAMPLE_RATE
      frame[i] = Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * f0 * 2 * t) + 0.3 * Math.sin(2 * Math.PI * f0 * 3 * t)
    }

    const { octaveHz, compoundFifthHz } = detectPartialsByFftPeakPicking(frame, SAMPLE_RATE, f0)

    expect(octaveHz).not.toBeNull()
    expect(Math.abs(centsBetween(octaveHz as number, f0 * 2))).toBeLessThan(10)
    expect(compoundFifthHz).not.toBeNull()
    expect(Math.abs(centsBetween(compoundFifthHz as number, f0 * 3))).toBeLessThan(10)
  })
})
