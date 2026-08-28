import type { NoteName } from './note'
import { noteToFrequency } from './note'
import type { Scale } from './scale'

export interface NearestTarget {
  note: NoteName
  targetHz: number
  centDeviation: number
}

// Deliberately re-implemented here rather than imported from
// tone-field-detection/domain/tuning-rules.ts — capabilities must stay
// decoupled from each other's domains (see plan's capability boundaries).
function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b)
}

/**
 * Resolves every note in `scale` to a frequency (via `noteToFrequency` and
 * `referencePitchHz`) and returns whichever is closest to `detectedHz`,
 * along with the cent deviation between the two (positive = detected is
 * sharp relative to the target, negative = flat).
 */
export function nearestTarget(detectedHz: number, scale: Scale, referencePitchHz: number): NearestTarget {
  let closest: NearestTarget | undefined

  for (const note of scale.notes) {
    const targetHz = noteToFrequency(note, referencePitchHz)
    const centDeviation = centsBetween(detectedHz, targetHz)

    if (closest === undefined || Math.abs(centDeviation) < Math.abs(closest.centDeviation)) {
      closest = { note, targetHz, centDeviation }
    }
  }

  if (closest === undefined) {
    throw new Error('Cannot resolve nearest target for an empty scale')
  }

  return closest
}
