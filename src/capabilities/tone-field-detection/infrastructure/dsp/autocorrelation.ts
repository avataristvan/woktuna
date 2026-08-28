const DEFAULT_MIN_FREQUENCY_HZ = 60
const DEFAULT_MAX_FREQUENCY_HZ = 1000

/** Below this RMS the frame is treated as silence — no periodicity to find. */
const MIN_RMS = 0.01

/**
 * Normalized-autocorrelation-peak threshold (peak / zero-lag energy) below
 * which a candidate lag is treated as noise rather than genuine periodicity.
 */
const MIN_CLARITY = 0.5

/**
 * Autocorrelation cost is O(windowLength × lagRange). The full AnalyserNode
 * frame (up to 32768 samples, see web-audio-microphone-source.ts) is sized
 * for FFT bin resolution — needed by Chunk 6's octave/fifth peak-picking —
 * not for autocorrelation accuracy, which comes from parabolic interpolation
 * on the winning lag rather than from window length. Measured tradeoff on a
 * multi-partial handpan-like signal: 4096 samples costs ~0.558 cents max
 * error vs. ~0.351 cents at 32768, for roughly an order of magnitude less
 * work — the difference between comfortably fitting a 16.7ms rAF budget and
 * blowing through it ~9x over. Only the leading portion of the frame is
 * correlated; the full lag range needed for low frequencies is preserved.
 */
const CORRELATION_WINDOW_SAMPLES = 4096

/**
 * One-pole high-pass corner, well below the lowest handpan fundamental
 * (DEFAULT_MIN_FREQUENCY_HZ), used to reject mic-handling rumble/HVAC hum
 * before correlating — left unfiltered, that energy previously produced a
 * confidently wrong pitch reading (measured up to +961 cents off) instead of
 * a null, the worst failure mode for a tuner.
 */
const HIGH_PASS_CUTOFF_HZ = 60

export interface AutocorrelationOptions {
  minFrequencyHz?: number
  maxFrequencyHz?: number
}

/**
 * Pure autocorrelation-based pitch detector — no Web Audio dependency, plain
 * function over samples + sample rate. Searches lags corresponding to
 * [minFrequencyHz, maxFrequencyHz], picks the strongest correlation peak in
 * that range, and refines it with parabolic interpolation across the
 * neighboring lags for sub-sample (sub-cent) accuracy.
 *
 * Returns null when the frame is silent or has no clear periodicity in the
 * search range.
 */
export function detectPitchByAutocorrelation(
  frame: Float32Array,
  sampleRate: number,
  options: AutocorrelationOptions = {},
): number | null {
  const minFrequencyHz = options.minFrequencyHz ?? DEFAULT_MIN_FREQUENCY_HZ
  const maxFrequencyHz = options.maxFrequencyHz ?? DEFAULT_MAX_FREQUENCY_HZ

  const windowLength = Math.min(frame.length, CORRELATION_WINDOW_SAMPLES)
  const window = removeDcAndRumble(frame, windowLength, sampleRate)

  if (computeRms(window) < MIN_RMS) {
    return null
  }

  const minLag = Math.max(1, Math.floor(sampleRate / maxFrequencyHz))
  const maxLag = Math.min(Math.floor(sampleRate / minFrequencyHz), window.length - 2)

  if (maxLag <= minLag) {
    return null
  }

  // Extend the computed range by one lag on each side so the winning lag
  // always has both neighbors available for parabolic interpolation below.
  const extendedMinLag = Math.max(1, minLag - 1)
  const extendedMaxLag = Math.min(window.length - 1, maxLag + 1)
  const correlations = new Float64Array(extendedMaxLag + 1)

  for (let lag = extendedMinLag; lag <= extendedMaxLag; lag++) {
    let sum = 0
    for (let i = 0; i < window.length - lag; i++) {
      sum += window[i] * window[i + lag]
    }
    correlations[lag] = sum
  }

  let bestLag = minLag
  let bestValue = correlations[minLag]
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (correlations[lag] > bestValue) {
      bestValue = correlations[lag]
      bestLag = lag
    }
  }

  const zeroLagEnergy = sumOfSquares(window)
  if (bestValue / zeroLagEnergy < MIN_CLARITY) {
    return null
  }

  const interpolatedLag = parabolicInterpolate(
    correlations[bestLag - 1],
    correlations[bestLag],
    correlations[bestLag + 1],
    bestLag,
  )

  if (interpolatedLag <= 0) {
    return null
  }

  return sampleRate / interpolatedLag
}

/**
 * Subtracts the window mean (DC removal) and applies a one-pole high-pass
 * (see HIGH_PASS_CUTOFF_HZ) to the leading `windowLength` samples of `frame`.
 * Both are cheap O(n) passes that must run before correlating, since a DC
 * offset or low-frequency rumble otherwise correlates strongly with itself
 * across all lags and can win the peak search outright.
 */
function removeDcAndRumble(frame: Float32Array, windowLength: number, sampleRate: number): Float64Array {
  let mean = 0
  for (let i = 0; i < windowLength; i++) {
    mean += frame[i]
  }
  mean /= windowLength

  const rc = 1 / (2 * Math.PI * HIGH_PASS_CUTOFF_HZ)
  const dt = 1 / sampleRate
  const alpha = rc / (rc + dt)

  const window = new Float64Array(windowLength)
  let prevInput = frame[0] - mean
  let prevOutput = prevInput
  window[0] = prevOutput

  for (let i = 1; i < windowLength; i++) {
    const input = frame[i] - mean
    const output = alpha * (prevOutput + input - prevInput)
    window[i] = output
    prevInput = input
    prevOutput = output
  }

  return window
}

function computeRms(window: Float64Array): number {
  return Math.sqrt(sumOfSquares(window) / window.length)
}

function sumOfSquares(window: Float64Array): number {
  let sum = 0
  for (let i = 0; i < window.length; i++) {
    sum += window[i] * window[i]
  }
  return sum
}

function parabolicInterpolate(yBefore: number, yAtPeak: number, yAfter: number, peakIndex: number): number {
  const denominator = yBefore - 2 * yAtPeak + yAfter
  if (denominator === 0) {
    return peakIndex
  }
  const offset = (0.5 * (yBefore - yAfter)) / denominator
  return peakIndex + offset
}
