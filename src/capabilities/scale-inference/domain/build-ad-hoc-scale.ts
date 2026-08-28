import type { Scale } from '../../scale-configuration/domain/scale'
import { frequencyToNote } from '../../scale-configuration/domain/note'

/**
 * Builds a `Scale` directly from collected strike frequencies, for the case
 * where none of the known scale definitions fit well — the player's handpan
 * simply has whatever notes it has, and the app should still be able to
 * offer tuning guidance against them. Each frequency is resolved to its
 * nearest equal-tempered note via `frequencyToNote`, the notes are sorted by
 * ascending pitch, and duplicates (two collected frequencies resolving to
 * the same note) are dropped.
 */
export function buildAdHocScale(collectedHz: number[], referencePitchHz: number): Scale {
  const ascendingNotes = [...collectedHz].sort((a, b) => a - b).map((hz) => frequencyToNote(hz, referencePitchHz))

  return {
    name: 'Custom (detected)',
    notes: [...new Set(ascendingNotes)],
  }
}
