/**
 * Shared low-level FFT primitives (windowing, magnitude-spectrum
 * computation, the radix-2 FFT itself). Extracted from
 * `fft-peak-picking.ts` so the octave/compound-fifth peak search and the
 * general-purpose spectrum analyzer (used by later crosstalk/spectrum-view
 * features) share one FFT implementation instead of duplicating it.
 *
 * `computeMagnitudeSpectrumF64` is the internal building block — it's what
 * `fft-peak-picking.ts` calls directly, unchanged from before this file was
 * split out, so its noise-floor gating logic keeps operating on exactly the
 * same Float64Array precision it always has. `computeMagnitudeSpectrum` is
 * the public, capability-external entry point (returned via the
 * `SpectrumAnalyzer` port): same underlying computation, cast to
 * Float32Array at the boundary and paired with bin/Hz conversion helpers.
 */

/** Largest power of 2 that fits within `n` samples — the FFT below is radix-2 and needs one. */
export function largestPowerOfTwoAtMost(n: number): number {
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
export function computeMagnitudeSpectrumF64(frame: Float32Array, fftSize: number): Float64Array {
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

/** A magnitude spectrum paired with its bin↔Hz conversion, for callers outside the DSP layer. */
export interface Spectrum {
  readonly magnitudes: Float32Array
  readonly binToHz: (bin: number) => number
  readonly hzToBin: (hz: number) => number
}

/**
 * Computes the magnitude spectrum of `frame` (Hann-windowed radix-2 FFT,
 * same computation `fft-peak-picking.ts` uses internally for its
 * octave/compound-fifth search) and exposes it generically, with bin↔Hz
 * conversion helpers, for callers that need the whole spectrum rather than
 * a band-limited peak search (e.g. a future spectrum/equalizer view or
 * crosstalk display).
 *
 * Defaults `fftSize` to the largest power of 2 that fits in `frame`, same
 * truncation rule `fft-peak-picking.ts` applies.
 */
export function computeMagnitudeSpectrum(frame: Float32Array, sampleRate: number, fftSize?: number): Spectrum {
  const size = fftSize ?? largestPowerOfTwoAtMost(frame.length)
  const magnitudes = Float32Array.from(computeMagnitudeSpectrumF64(frame, size))

  return {
    magnitudes,
    binToHz: (bin: number) => (bin * sampleRate) / size,
    hzToBin: (hz: number) => (hz * size) / sampleRate,
  }
}
