import type { Severity, ToneFieldGuidance } from './guidance-model'

/**
 * Severity thresholds in absolute cents. Deliberately coarse — this is a
 * hammering-technique hint, not a precision tuner readout.
 */
const SLIGHT_THRESHOLD_CENTS = 5
const MODERATE_THRESHOLD_CENTS = 15
const SIGNIFICANT_THRESHOLD_CENTS = 30

function centDeviationToSeverity(centDeviation: number): Severity {
  const magnitude = Math.abs(centDeviation)
  if (Number.isNaN(magnitude)) return 'inTune'
  if (magnitude <= SLIGHT_THRESHOLD_CENTS) return 'inTune'
  if (magnitude <= MODERATE_THRESHOLD_CENTS) return 'slight'
  if (magnitude <= SIGNIFICANT_THRESHOLD_CENTS) return 'moderate'
  return 'significant'
}

/**
 * Maps a fundamental's cent deviation from its target to hammer guidance.
 *
 * Per research doc §2.2: hammering the center raises pitch, hammering the
 * edge lowers it. So a flat (too-low, negative deviation) fundamental needs
 * a center-biased hit to bring it up, and a sharp (too-high, positive
 * deviation) fundamental needs an edge-biased hit to bring it down.
 *
 * `longAxis`/`shortAxis` are not populated by this chunk — octave/compound-
 * fifth partial detection lands in a later chunk. The signature already
 * carries their type so that later chunk only has to fill in real values,
 * not restructure this function or its callers.
 *
 * IMPORTANT — do not "upgrade" this into a precise crosshair. Per research
 * doc §2.4, real hammering technique is several distributed blows around
 * the field edge with a directional bias toward one axis, not a single
 * exact strike point. Any renderer consuming this guidance (radial bias,
 * axis markers) must draw a general highlighted arc/zone, never a precise
 * dot/crosshair — that would misrepresent an empirically fuzzy technique
 * (§5: no source has an exact, reproducible strike-path diagram) as more
 * precise than it is.
 *
 * This function assumes hammering from the outside/playing side of the
 * shell. Per research doc §2.3, hammering from the inside through the Gu
 * (sound hole) inverts the center/edge direction — that inversion is not
 * implemented here; Chunk 8's `hammer-direction.ts` will handle it.
 */
export function deviationToGuidance(fundamentalCentDeviation: number): ToneFieldGuidance {
  const severity = centDeviationToSeverity(fundamentalCentDeviation)
  const hammerBias =
    severity === 'inTune' ? 'inTune' : fundamentalCentDeviation < 0 ? 'center' : 'edge'

  return {
    radial: {
      centDeviation: fundamentalCentDeviation,
      severity,
    },
    longAxis: null,
    shortAxis: null,
    hammerBias,
  }
}
