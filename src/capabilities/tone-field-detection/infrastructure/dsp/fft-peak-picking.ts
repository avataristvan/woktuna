/**
 * Band-limited FFT peak-picking for the octave and compound-fifth partials,
 * searched relative to an already-detected fundamental (see
 * `autocorrelation.ts`). No library does multi-partial detection relative to
 * a dynamically-detected fundamental — this is hand-rolled, including a
 * small self-contained radix-2 FFT, per the plan's explicit call to avoid a
 * new npm dependency for this.
 *
 * Pure algorithm — no Web Audio dependency, operates on a plain
 * Float32Array + sample rate so it's unit-testable against synthetic
 * multi-partial signals.
 */

/**
 * Search-band half-width, in cents, around each expected partial location
 * (~2×f0 for the octave, ~3×f0 for the compound fifth). TODO/tunable per
 * the plan — real-hardware validation is needed to settle this:
 *  - Too narrow risks missing a badly-detuned partial, which defeats the
 *    purpose of a *pre*-tuning app (the whole point is to find partials that
 *    are NOT yet at the expected ratio).
 *  - Too wide risks the search band locking onto crosstalk energy bleeding
 *    in from a neighboring tone field (handpan-stimm-app-recherche.md §2.5
 *    flags this as an open, unresolved question — not silently resolved
 *    here, just a risk to keep in mind when retuning this constant).
 */
const DEFAULT_TOLERANCE_CENTS = 250

/** Tight band used only to locate the already-known fundamental's own spectral peak, as the amplitude reference below. */
const FUNDAMENTAL_REFERENCE_TOLERANCE_CENTS = 50

/**
 * A candidate peak must be at least this fraction of the fundamental's own
 * peak magnitude to count as a genuine partial rather than spectral leakage
 * (window sidelobes) from a neighboring real peak. Handpan partial
 * amplitudes are all the same order of magnitude as the fundamental (per
 * the domain doc), while Hann-window sidelobe leakage many bins away from a
 * real peak is many orders of magnitude weaker — this ratio is not a tight
 * boundary in practice, but it's still a tunable, not a proof.
 */
const MIN_PARTIAL_TO_FUNDAMENTAL_RATIO = 0.05

export interface FftPeakPickingOptions {
  toleranceCents?: number
}

export interface PartialPeaks {
  octaveHz: number | null
  compoundFifthHz: number | null
}

/**
 * Computes one FFT of `frame` and searches band-limited windows around
 * 2×fundamentalHz (octave) and 3×fundamentalHz (compound fifth) for a clear
 * spectral peak, refined to sub-bin accuracy via parabolic interpolation.
 * Returns `null` for either partial when no clear peak is found in its band
 * — never forces a guess.
 */
export function detectPartialsByFftPeakPicking(
  frame: Float32Array,
  sampleRate: number,
  fundamentalHz: number,
  options: FftPeakPickingOptions = {},
): PartialPeaks {
  const toleranceCents = options.toleranceCents ?? DEFAULT_TOLERANCE_CENTS

  const fftSize = largestPowerOfTwoAtMost(frame.length)
  if (fftSize < 2) {
    return { octaveHz: null, compoundFifthHz: null }
  }

  const magnitude = computeMagnitudeSpectrum(frame, fftSize)

  const fundamentalPeak = bandPeak(magnitude, sampleRate, fftSize, fundamentalHz, FUNDAMENTAL_REFERENCE_TOLERANCE_CENTS)
  const referenceMagnitude = fundamentalPeak?.magnitude ?? 0
  if (referenceMagnitude <= 0) {
    // The given fundamentalHz doesn't correspond to any real energy in this
    // frame's spectrum — no reliable amplitude reference, so no partial
    // search result can be trusted either.
    return { octaveHz: null, compoundFifthHz: null }
  }

  return {
    octaveHz: findPartialPeak(magnitude, sampleRate, fftSize, fundamentalHz * 2, toleranceCents, referenceMagnitude),
    compoundFifthHz: findPartialPeak(magnitude, sampleRate, fftSize, fundamentalHz * 3, toleranceCents, referenceMagnitude),
  }
}

function findPartialPeak(
  magnitude: Float64Array,
  sampleRate: number,
  fftSize: number,
  targetHz: number,
  toleranceCents: number,
  referenceMagnitude: number,
): number | null {
  const found = bandPeak(magnitude, sampleRate, fftSize, targetHz, toleranceCents)
  if (found === null) {
    return null
  }

  const { bin: peakBin, magnitude: peakMag } = found
  const isLocalMax = peakMag >= magnitude[peakBin - 1] && peakMag >= magnitude[peakBin + 1]
  if (!isLocalMax || peakMag < MIN_PARTIAL_TO_FUNDAMENTAL_RATIO * referenceMagnitude) {
    return null
  }

  const interpolatedBin = parabolicInterpolate(magnitude[peakBin - 1], magnitude[peakBin], magnitude[peakBin + 1], peakBin)
  return (interpolatedBin * sampleRate) / fftSize
}

/** Finds the strongest bin within ±toleranceCents of targetHz, without any threshold/local-max judgement — that's layered on by the caller. */
function bandPeak(
  magnitude: Float64Array,
  sampleRate: number,
  fftSize: number,
  targetHz: number,
  toleranceCents: number,
): { bin: number; magnitude: number } | null {
  const ratio = centsToRatio(toleranceCents)
  const lowHz = targetHz / ratio
  const highHz = targetHz * ratio

  // Bins 1 before/after the search range must exist for parabolic
  // interpolation and the local-max check on the winning bin.
  const binLow = Math.max(1, Math.ceil((lowHz * fftSize) / sampleRate))
  const binHigh = Math.min(magnitude.length - 2, Math.floor((highHz * fftSize) / sampleRate))

  if (binHigh <= binLow) {
    return null
  }

  let peakBin = binLow
  let peakMag = magnitude[binLow]
  for (let bin = binLow + 1; bin <= binHigh; bin++) {
    if (magnitude[bin] > peakMag) {
      peakMag = magnitude[bin]
      peakBin = bin
    }
  }

  return { bin: peakBin, magnitude: peakMag }
}

function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

/** Largest power of 2 that fits within `n` samples — the FFT below is radix-2 and needs one. */
function largestPowerOfTwoAtMost(n: number): number {
  let power = 1
  while (power * 2 <= n) {
    power *= 2
  }
  return power
}

/**
 * Applies a Hann window (reduces spectral leakage so a real partial's
 * energy doesn't smear across bins and mask/mimic a neighboring band) and
 * returns the magnitude spectrum (bins 0..fftSize/2 inclusive) via an
 * in-place radix-2 FFT.
 */
function computeMagnitudeSpectrum(frame: Float32Array, fftSize: number): Float64Array {
  const real = new Float64Array(fftSize)
  const imag = new Float64Array(fftSize)

  for (let i = 0; i < fftSize; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1))
    real[i] = frame[i] * hann
  }

  fft(real, imag)

  const magnitude = new Float64Array(fftSize / 2 + 1)
  for (let bin = 0; bin < magnitude.length; bin++) {
    magnitude[bin] = Math.hypot(real[bin], imag[bin])
  }
  return magnitude
}

/**
 * In-place iterative radix-2 Cooley-Tukey FFT (decimation-in-time). `real`
 * and `imag` must be the same power-of-2 length. Self-contained rather than
 * an npm dependency, per the plan — this is a standard, well-known
 * algorithm, not novel IP.
 */
function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; (j & bit) !== 0; bit >>= 1) {
      j ^= bit
    }
    j ^= bit
    if (i < j) {
      ;[real[i], real[j]] = [real[j], real[i]]
      ;[imag[i], imag[j]] = [imag[j], imag[i]]
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wLenReal = Math.cos(angle)
    const wLenImag = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let wReal = 1
      let wImag = 0

      for (let j = 0; j < len / 2; j++) {
        const uReal = real[i + j]
        const uImag = imag[i + j]
        const vReal = real[i + j + len / 2] * wReal - imag[i + j + len / 2] * wImag
        const vImag = real[i + j + len / 2] * wImag + imag[i + j + len / 2] * wReal

        real[i + j] = uReal + vReal
        imag[i + j] = uImag + vImag
        real[i + j + len / 2] = uReal - vReal
        imag[i + j + len / 2] = uImag - vImag

        const nextWReal = wReal * wLenReal - wImag * wLenImag
        const nextWImag = wReal * wLenImag + wImag * wLenReal
        wReal = nextWReal
        wImag = nextWImag
      }
    }
  }
}

function parabolicInterpolate(yBefore: number, yAtPeak: number, yAfter: number, peakIndex: number): number {
  const denominator = yBefore - 2 * yAtPeak + yAfter
  if (denominator === 0) {
    return peakIndex
  }
  const offset = (0.5 * (yBefore - yAfter)) / denominator
  return peakIndex + offset
}
