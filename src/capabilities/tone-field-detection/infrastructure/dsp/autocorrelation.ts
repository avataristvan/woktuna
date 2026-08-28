const DEFAULT_MIN_FREQUENCY_HZ = 60
const DEFAULT_MAX_FREQUENCY_HZ = 1000

/** Below this RMS the frame is treated as silence — no periodicity to find. */
const MIN_RMS = 0.01

/**
 * Normalized-autocorrelation-peak threshold (peak / zero-lag energy) below
 * which a candidate lag is treated as noise rather than genuine periodicity.
 */
const MIN_CLARITY = 0.5

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

  if (computeRms(frame) < MIN_RMS) {
    return null
  }

  const minLag = Math.max(1, Math.floor(sampleRate / maxFrequencyHz))
  const maxLag = Math.min(Math.floor(sampleRate / minFrequencyHz), frame.length - 2)

  if (maxLag <= minLag) {
    return null
  }

  // Extend the computed range by one lag on each side so the winning lag
  // always has both neighbors available for parabolic interpolation below.
  const extendedMinLag = Math.max(1, minLag - 1)
  const extendedMaxLag = Math.min(frame.length - 1, maxLag + 1)
  const correlations = new Float64Array(extendedMaxLag + 1)

  for (let lag = extendedMinLag; lag <= extendedMaxLag; lag++) {
    let sum = 0
    for (let i = 0; i < frame.length - lag; i++) {
      sum += frame[i] * frame[i + lag]
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

  const zeroLagEnergy = sumOfSquares(frame)
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

function computeRms(frame: Float32Array): number {
  return Math.sqrt(sumOfSquares(frame) / frame.length)
}

function sumOfSquares(frame: Float32Array): number {
  let sum = 0
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i] * frame[i]
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
