import type { SpectrumReading } from '../../tone-field-detection/application/ports'
import type { CrosstalkWarning } from './crosstalk-warning'

/**
 * A candidate target's winning bin must be at least this many times its own
 * local noise floor (see `localNoiseFloor`) to count as suspicious spectral
 * structure rather than the flat, directionless magnitude of a band with no
 * real energy in it. Mirrors `fft-peak-picking.ts`'s `NOISE_FLOOR_MARGIN` —
 * deliberately duplicated rather than imported (that check is private to
 * its file, and this is a different, capability-external judgement: "is
 * there suspicious energy at this OTHER field's target", not "is this a
 * genuine partial of the field we're actively measuring"). See the plan's
 * established precedent for this kind of small cross-capability-boundary
 * duplication.
 */
const NOISE_FLOOR_MARGIN = 6

/**
 * A peak clearing the noise floor by this much beyond the base margin is
 * reported as 'medium' confidence instead of 'low'. Still never 'high' —
 * see `crosstalk-warning.ts` for why. Chosen so a peak has to be
 * unambiguously well above the floor (not just barely past the pass/fail
 * line) before this heuristic upgrades its own confidence in itself.
 */
const MEDIUM_CONFIDENCE_MARGIN_MULTIPLIER = 3

/** How many bins beyond a search band's own edges to sample when estimating that band's noise floor — see `fft-peak-picking.ts`'s identical constant/rationale. */
const FLOOR_SAMPLE_EXTRA_BINS = 6

/**
 * Scans `allScaleTargetHz` for any target — other than the one currently
 * being tuned — whose spectral neighborhood shows a genuine peak rather
 * than flat noise. Per handpan-stimm-app-recherche.md §2.5, energy showing
 * up near a neighboring tone field's target is an acknowledged phenomenon
 * (crosstalk between adjacent fields) but the exact axis-relationship
 * governing it is explicitly unresolved — this function does not attempt
 * to model *why* the energy is there, only that it is, and reports it as a
 * heuristic worth a damped re-check, never as a confirmed diagnosis.
 *
 * The target closest (in cents) to `currentlyTunedNoteHz` is always
 * excluded, even if it has the strongest peak in the spectrum — that's the
 * field actually being struck/tuned, not crosstalk from a neighbor.
 *
 * Pure function: takes a pre-computed `SpectrumReading` (see
 * `tone-field-detection/application/ports.ts`) rather than raw audio, so
 * it's unit-testable against synthetic spectra without an FFT dependency.
 */
export function detectCrosstalk(
  spectrum: SpectrumReading,
  currentlyTunedNoteHz: number,
  allScaleTargetHz: readonly number[],
  toleranceCents: number,
): CrosstalkWarning[] {
  const tunedTargetHz = closestByCents(currentlyTunedNoteHz, allScaleTargetHz)

  const warnings: CrosstalkWarning[] = []
  for (const targetHz of allScaleTargetHz) {
    if (targetHz === tunedTargetHz) continue

    const peak = bandPeak(spectrum, targetHz, toleranceCents)
    if (peak === null) continue

    const floor = localNoiseFloor(spectrum.magnitudes, peak.binLow, peak.binHigh)
    if (!isGenuinePeak(spectrum.magnitudes, peak, floor)) continue

    warnings.push({
      targetHz,
      magnitude: peak.magnitude,
      confidence: peak.magnitude >= MEDIUM_CONFIDENCE_MARGIN_MULTIPLIER * NOISE_FLOOR_MARGIN * floor ? 'medium' : 'low',
    })
  }

  return warnings.sort((a, b) => b.magnitude - a.magnitude)
}

function closestByCents(referenceHz: number, candidatesHz: readonly number[]): number | null {
  let closest: number | null = null
  let smallestAbsCents = Infinity
  for (const candidate of candidatesHz) {
    const absCents = Math.abs(1200 * Math.log2(candidate / referenceHz))
    if (absCents < smallestAbsCents) {
      smallestAbsCents = absCents
      closest = candidate
    }
  }
  return closest
}

interface BandPeak {
  bin: number
  magnitude: number
  binLow: number
  binHigh: number
}

/** Finds the strongest bin within ±toleranceCents of targetHz, without any threshold/local-max judgement — that's layered on by the caller. */
function bandPeak(spectrum: SpectrumReading, targetHz: number, toleranceCents: number): BandPeak | null {
  const { magnitudes } = spectrum
  const ratio = Math.pow(2, toleranceCents / 1200)
  const lowHz = targetHz / ratio
  const highHz = targetHz * ratio

  // Bins 1 before/after the search range must exist for the local-max check on the winning bin.
  const binLow = Math.max(1, Math.ceil(spectrum.hzToBin(lowHz)))
  const binHigh = Math.min(magnitudes.length - 2, Math.floor(spectrum.hzToBin(highHz)))

  if (binHigh <= binLow) {
    return null
  }

  let peakBin = binLow
  let peakMag = magnitudes[peakBin]
  for (let bin = binLow + 1; bin <= binHigh; bin++) {
    if (magnitudes[bin] > peakMag) {
      peakMag = magnitudes[bin]
      peakBin = bin
    }
  }

  return { bin: peakBin, magnitude: peakMag, binLow, binHigh }
}

/**
 * A band's winning bin only counts as genuine spectral structure — as
 * opposed to the flat, directionless magnitude of a band with no real
 * energy in it — if it's a local maximum AND clears its own local noise
 * floor by `NOISE_FLOOR_MARGIN`. See `fft-peak-picking.ts`'s
 * `isGenuineSpectralPeak` for the identical reasoning (a dead `<= 0` check
 * almost never fires against real/synthetic input).
 */
function isGenuinePeak(magnitudes: Float32Array, peak: BandPeak, floor: number): boolean {
  const { bin: peakBin, magnitude: peakMag } = peak
  if (peakMag <= 0) {
    return false
  }
  const isLocalMax = peakMag >= magnitudes[peakBin - 1] && peakMag >= magnitudes[peakBin + 1]
  if (!isLocalMax) {
    return false
  }
  return peakMag >= NOISE_FLOOR_MARGIN * floor
}

/**
 * Estimates the noise floor local to a search band as the median magnitude
 * of bins just outside the band (the whole band is excluded, not just the
 * winning bin — a real peak's main lobe can occupy an entire narrow band).
 * See `fft-peak-picking.ts`'s `localNoiseFloor` for the full rationale
 * against both a global/spectrum-wide floor (rejected: mostly-zero
 * synthetic spectra clear it trivially) and an anchor-relative-only floor
 * (not applicable here — unlike partial detection, there is no single
 * "already known genuine" anchor to compare every candidate against; each
 * OTHER target is itself an independent, unconfirmed candidate).
 */
function localNoiseFloor(magnitudes: Float32Array, binLow: number, binHigh: number): number {
  const floorLow = Math.max(1, binLow - FLOOR_SAMPLE_EXTRA_BINS)
  const floorHigh = Math.min(magnitudes.length - 2, binHigh + FLOOR_SAMPLE_EXTRA_BINS)

  const samples: number[] = []
  for (let bin = floorLow; bin <= floorHigh; bin++) {
    if (bin < binLow || bin > binHigh) {
      samples.push(magnitudes[bin])
    }
  }
  if (samples.length === 0) {
    // The spectrum is too short (tiny fftSize) to find any bins outside the
    // band at all — fall back to the band's own edge bins instead of
    // claiming a floor of zero, which would make any positive magnitude
    // trivially "genuine".
    samples.push(magnitudes[binLow], magnitudes[binHigh])
  }

  samples.sort((a, b) => a - b)
  const mid = Math.floor(samples.length / 2)
  return samples.length % 2 === 0 ? (samples[mid - 1] + samples[mid]) / 2 : samples[mid]
}
