/**
 * Band-limited FFT peak-picking for the octave and compound-fifth partials,
 * searched relative to an already-detected fundamental (see
 * `autocorrelation.ts`). No library does multi-partial detection relative to
 * a dynamically-detected fundamental — this is hand-rolled, including a
 * small self-contained radix-2 FFT, per the plan's explicit call to avoid a
 * new npm dependency for this. The FFT/windowing/magnitude computation
 * itself lives in `fft.ts` and is shared with the general-purpose
 * `SpectrumAnalyzer` port — not duplicated here.
 *
 * Pure algorithm — no Web Audio dependency, operates on a plain
 * Float32Array + sample rate so it's unit-testable against synthetic
 * multi-partial signals.
 */

import { computeMagnitudeSpectrumF64, largestPowerOfTwoAtMost } from './fft'

/**
 * Default search-band half-width, in cents, around each expected partial
 * location (~2×f0 for the octave, ~3×f0 for the compound fifth), used when
 * no `toleranceCents` option is passed. User-adjustable at runtime via the
 * `#tolerance-cents-input` UI control in `main.ts` (threaded through
 * `FftPartialDetector.setToleranceCents`) — this default itself is still
 * TODO/tunable per the plan, real-hardware validation is needed to settle
 * it:
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
 * peak magnitude to count as a genuine partial. This used to be the primary
 * discriminator (5%) but that caused real false negatives: the domain doc
 * (handpan-stimm-app-recherche.md §2.1) describes tapping specifically
 * *along an axis* to isolate the octave/compound-fifth partial, which
 * implies these partials are routinely much quieter than the fundamental
 * during normal play, not comparable in magnitude to it. A measured octave
 * at 4.5% of the fundamental's magnitude was being missed under the old 5%
 * gate. The primary false-positive guard is now `NOISE_FLOOR_MARGIN` below
 * (a peak must clearly stand out from its own local noise floor); this
 * ratio is kept only as a low secondary sanity floor, generous enough to
 * admit a genuinely quiet-but-real partial. This is a real trade-off
 * without a single obviously-correct answer (see also §5's crosstalk
 * question — the two risks pull in opposite directions: too permissive
 * here also makes it easier to false-positive on a neighboring tone
 * field's leakage bleeding into this one's search band).
 */
const MIN_PARTIAL_TO_FUNDAMENTAL_RATIO = 0.02

/**
 * A candidate peak's magnitude must be at least this many times its local
 * noise floor (see `localNoiseFloor`) to count as genuine spectral
 * structure rather than the flat, directionless magnitude of a search band
 * that contains no real tone at all. This is the primary false-positive
 * guard (see CLAUDE.md's Chunk 6.5 DSP gotcha): it replaces a dead
 * `referenceMagnitude <= 0` check that almost never fired, since
 * `Math.hypot` over FFT bins is essentially never exactly zero for real
 * input — a pure-noise frame used to sail through that check and produce
 * confident false-positive partials. Calibrated empirically (see
 * fft-peak-picking.spec.ts) so a pure-noise band reliably fails and a
 * clean synthetic partial at a few percent of the fundamental's magnitude
 * reliably passes.
 */
const NOISE_FLOOR_MARGIN = 6

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

  const magnitude = computeMagnitudeSpectrumF64(frame, fftSize)

  const fundamentalPeak = bandPeak(magnitude, sampleRate, fftSize, fundamentalHz, FUNDAMENTAL_REFERENCE_TOLERANCE_CENTS)
  if (fundamentalPeak === null || !isGenuineSpectralPeak(magnitude, fundamentalPeak)) {
    // The given fundamentalHz doesn't correspond to genuine spectral
    // structure in this frame — either the search band collapsed to too
    // few bins, or (the case this used to miss) the band is just noise
    // with no real tone in it. Without a trustworthy amplitude reference,
    // no partial search result can be trusted either.
    return { octaveHz: null, compoundFifthHz: null }
  }
  const referenceMagnitude = fundamentalPeak.magnitude

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
  if (found === null || !isGenuineSpectralPeak(magnitude, found)) {
    return null
  }
  if (found.magnitude < MIN_PARTIAL_TO_FUNDAMENTAL_RATIO * referenceMagnitude) {
    return null
  }

  const { bin: peakBin } = found
  const interpolatedBin = parabolicInterpolate(magnitude[peakBin - 1], magnitude[peakBin], magnitude[peakBin + 1], peakBin)
  return (interpolatedBin * sampleRate) / fftSize
}

interface BandPeak {
  bin: number
  magnitude: number
  binLow: number
  binHigh: number
}

/** Finds the strongest bin within ±toleranceCents of targetHz, without any threshold/local-max judgement — that's layered on by the caller. */
function bandPeak(magnitude: Float64Array, sampleRate: number, fftSize: number, targetHz: number, toleranceCents: number): BandPeak | null {
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

  return { bin: peakBin, magnitude: peakMag, binLow, binHigh }
}

/**
 * A band's winning bin only counts as a genuine partial/fundamental peak —
 * as opposed to the flat, directionless magnitude of a band with no real
 * tone in it — if it's a local maximum AND clears its own local noise
 * floor by `NOISE_FLOOR_MARGIN`. Both checks matter: local-max alone
 * doesn't distinguish "the biggest bump in an otherwise flat noise band"
 * from a real peak; the margin check alone can't tell a genuine peak from
 * a wide plateau.
 */
function isGenuineSpectralPeak(magnitude: Float64Array, peak: BandPeak): boolean {
  const { bin: peakBin, magnitude: peakMag, binLow, binHigh } = peak
  // A literally-silent frame (magnitude 0 everywhere) makes the floor 0
  // too, and 0 >= margin * 0 is trivially true — guard it explicitly
  // rather than relying on the margin check alone.
  if (peakMag <= 0) {
    return false
  }
  const isLocalMax = peakMag >= magnitude[peakBin - 1] && peakMag >= magnitude[peakBin + 1]
  if (!isLocalMax) {
    return false
  }
  return peakMag >= NOISE_FLOOR_MARGIN * localNoiseFloor(magnitude, binLow, binHigh)
}

/**
 * How many bins beyond a search band's own edges to sample when estimating
 * that band's noise floor. Needed because a narrow band (the ±50-cent
 * fundamental reference band collapses to as few as 2 bins at low handpan
 * fundamentals) can be *entirely* occupied by a single real peak's Hann
 * main lobe, leaving no genuinely-noise bins inside the band itself to
 * measure against — excluding just the winning bin isn't enough in that
 * case, the whole band has to be excluded and the floor sampled from just
 * outside it. 6 bins is comfortably safe against pulling in a neighboring
 * partial's real energy: even in the tightest case this file supports
 * (16384-point FFT, ~110Hz fundamental — see fft-peak-picking.spec.ts's
 * low-fundamental edge-case test), the gap between the octave band's edge
 * and the compound-fifth band's edge is still ~10 bins.
 */
const FLOOR_SAMPLE_EXTRA_BINS = 6

/**
 * Estimates the noise floor local to a search band as the median magnitude
 * of bins just outside the band (the whole band is excluded, not just the
 * winning bin — see `FLOOR_SAMPLE_EXTRA_BINS`, a real peak's main lobe can
 * occupy an entire narrow band). Deliberately scoped to a small fixed
 * neighborhood rather than a wide frequency range — a search band this
 * close to another expected partial (octave vs. compound fifth are only a
 * factor of 1.5 apart) risks that neighbor's real energy leaking into the
 * floor estimate, undermining the whole point of the check. A
 * global/spectrum-wide median was tried in Chunk 6 and rejected for the
 * opposite reason: most of a mostly-silent synthetic spectrum sits at
 * exactly zero, so it clears trivially and stops distinguishing anything
 * (see CLAUDE.md's Chunk 6 DSP gotcha).
 */
function localNoiseFloor(magnitude: Float64Array, binLow: number, binHigh: number): number {
  const floorLow = Math.max(1, binLow - FLOOR_SAMPLE_EXTRA_BINS)
  const floorHigh = Math.min(magnitude.length - 2, binHigh + FLOOR_SAMPLE_EXTRA_BINS)

  const samples: number[] = []
  for (let bin = floorLow; bin <= floorHigh; bin++) {
    if (bin < binLow || bin > binHigh) {
      samples.push(magnitude[bin])
    }
  }
  if (samples.length === 0) {
    // The spectrum is too short (tiny fftSize) to find any bins outside
    // the band at all — fall back to the band's own edge bins instead of
    // claiming a floor of zero, which would make any positive magnitude
    // trivially "genuine".
    samples.push(magnitude[binLow], magnitude[binHigh])
  }

  samples.sort((a, b) => a - b)
  const mid = Math.floor(samples.length / 2)
  return samples.length % 2 === 0 ? (samples[mid - 1] + samples[mid]) / 2 : samples[mid]
}

function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

function parabolicInterpolate(yBefore: number, yAtPeak: number, yAfter: number, peakIndex: number): number {
  const denominator = yBefore - 2 * yAtPeak + yAfter
  if (denominator === 0) {
    return peakIndex
  }
  const offset = (0.5 * (yBefore - yAfter)) / denominator
  return peakIndex + offset
}
