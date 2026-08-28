/**
 * Maps a raw magnitude spectrum into a small, renderable set of frequency
 * bars for a spectrum/equalizer diagnostic view.
 *
 * Deliberately duplicates `tone-field-detection/application/ports.ts`'s
 * `SpectrumReading` shape as a local structural type instead of importing
 * it — this capability's domain must not import another capability's
 * types (see `scale-configuration`'s domain, which does the same for its
 * own compatible shapes). Any real `SpectrumReading` satisfies this type
 * structurally, so no adapter is needed at the call site.
 */
export interface SpectrumMagnitudes {
  readonly magnitudes: Float32Array
  readonly binToHz: (bin: number) => number
  readonly hzToBin: (hz: number) => number
}

export interface FrequencyBar {
  readonly frequencyHz: number
  readonly magnitude: number
  readonly normalizedHeight: number
}

// Handpan tone fields put the fundamental down around 100-450Hz depending
// on scale/size, with octave (2x) and compound-fifth (3x) partials landing
// well under 2kHz for any realistically tuned instrument — 60Hz-2kHz gives
// headroom below the lowest fundamental and covers a few partials above the
// highest one without wasting bars on empty high-frequency spectrum.
export const MIN_FREQUENCY_HZ = 60
export const MAX_FREQUENCY_HZ = 2000

// Wide enough to show peak shape, narrow enough to read as a bar chart
// rather than a raw FFT plot (a few thousand raw bins would be unreadable).
export const BAR_COUNT = 96

/**
 * Downsamples a magnitude spectrum into `BAR_COUNT` bars spaced
 * logarithmically across [`MIN_FREQUENCY_HZ`, `MAX_FREQUENCY_HZ`] — log
 * spacing because musical partials (octave = 2x, compound fifth = 3x) are
 * multiplicative relationships, so equal-ratio bands read more naturally
 * than equal-Hz bands for this content.
 *
 * Each bar's magnitude is the *peak* raw-bin magnitude within its frequency
 * band, not the average — averaging would flatten narrow spectral peaks
 * (real tone-field partials are narrow), especially in the lower bars where
 * a band can span only a handful of raw FFT bins.
 *
 * `normalizedHeight` is each bar's magnitude relative to the *loudest bar
 * in this frame* (not a fixed reference level), so the tallest bar always
 * reaches 1.0 regardless of overall input level. A silent frame (all-zero
 * magnitudes) normalizes to all-zero bars rather than dividing by zero.
 */
export function barsFromSpectrum(spectrum: SpectrumMagnitudes): FrequencyBar[] {
  const maxBinIndex = spectrum.magnitudes.length - 1
  const logMin = Math.log(MIN_FREQUENCY_HZ)
  const logMax = Math.log(MAX_FREQUENCY_HZ)
  const logStep = (logMax - logMin) / BAR_COUNT

  const bars: FrequencyBar[] = []

  for (let i = 0; i < BAR_COUNT; i++) {
    const lowHz = Math.exp(logMin + i * logStep)
    const highHz = Math.exp(logMin + (i + 1) * logStep)
    const centerHz = Math.sqrt(lowHz * highHz)

    const lowBin = clamp(Math.floor(spectrum.hzToBin(lowHz)), 0, maxBinIndex)
    const highBin = clamp(Math.ceil(spectrum.hzToBin(highHz)), lowBin, maxBinIndex)

    let peakMagnitude = 0
    for (let bin = lowBin; bin <= highBin; bin++) {
      const magnitude = spectrum.magnitudes[bin]
      if (magnitude > peakMagnitude) {
        peakMagnitude = magnitude
      }
    }

    bars.push({ frequencyHz: centerHz, magnitude: peakMagnitude, normalizedHeight: 0 })
  }

  const framePeak = bars.reduce((max, bar) => Math.max(max, bar.magnitude), 0)
  if (framePeak === 0) {
    return bars
  }

  return bars.map((bar) => ({ ...bar, normalizedHeight: bar.magnitude / framePeak }))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
