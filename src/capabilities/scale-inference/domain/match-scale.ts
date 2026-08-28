import type { Scale } from '../../scale-configuration/domain/scale'
import { nearestTarget } from '../../scale-configuration/domain/nearest-target'

/**
 * A candidate scale is only accepted as "the" match when the collected
 * readings sit, on average, within this many cents of their nearest note in
 * that scale. 50 cents is half a semitone — generous enough that a
 * significantly out-of-tune handpan (the exact situation this app exists to
 * fix) still matches the scale it was *built* as, while still rejecting
 * frequencies that plainly don't correspond to the candidate's note layout
 * at all (see the "no candidate scores well enough" test below).
 */
const MAX_AVERAGE_DEVIATION_CENTS = 50

/**
 * Scores each candidate scale by how well `collectedHz` fits it — for every
 * collected frequency, the absolute cent deviation to its nearest note in
 * that scale (via `nearestTarget`) is averaged across all collected
 * frequencies; a lower average deviation means a better fit. Returns the
 * best-fitting candidate along with a 0-1 confidence derived from that
 * average deviation, or `null` when even the best candidate's average
 * deviation exceeds `MAX_AVERAGE_DEVIATION_CENTS` — i.e. no known scale is a
 * plausible fit for what was actually struck.
 */
export function matchScale(collectedHz: number[], candidates: readonly Scale[], referencePitchHz: number): { scale: Scale; confidence: number } | null {
  let best: { scale: Scale; averageDeviationCents: number } | undefined

  for (const candidate of candidates) {
    if (collectedHz.length === 0 || candidate.notes.length === 0) {
      continue
    }

    const deviations = collectedHz.map((hz) => Math.abs(nearestTarget(hz, candidate, referencePitchHz).centDeviation))
    const averageDeviationCents = deviations.reduce((sum, deviation) => sum + deviation, 0) / deviations.length

    if (best === undefined || averageDeviationCents < best.averageDeviationCents) {
      best = { scale: candidate, averageDeviationCents }
    }
  }

  if (best === undefined || best.averageDeviationCents > MAX_AVERAGE_DEVIATION_CENTS) {
    return null
  }

  const confidence = 1 - best.averageDeviationCents / MAX_AVERAGE_DEVIATION_CENTS
  return { scale: best.scale, confidence }
}
