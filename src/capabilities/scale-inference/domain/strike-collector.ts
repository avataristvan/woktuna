// Deliberately re-implemented here rather than imported from
// tone-field-detection/application/analyze-tone-field.ts — capabilities must
// stay decoupled from each other's internals (same precedent as
// scale-configuration/domain/nearest-target.ts duplicating `centsBetween`
// instead of importing tuning-rules.ts). A raw reading further than this
// from the *last recorded* struck note is treated as a genuinely new strike
// rather than a re-reading of the same one — roughly a semitone, matching
// analyze-tone-field.ts's JUMP_RESET_THRESHOLD_CENTS convention.
const STRIKE_DEDUP_THRESHOLD_CENTS = 100

function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b)
}

/**
 * Deduplicates a stream of raw fundamental-Hz readings (e.g. one per frame
 * while a tone field rings out after a strike) into distinct struck notes.
 * A reading is only recorded as a new struck note when it lies more than
 * `STRIKE_DEDUP_THRESHOLD_CENTS` away from the last *recorded* struck note —
 * so the many near-identical readings produced while one note rings collapse
 * into a single entry, while striking a genuinely different tone field adds
 * a new one.
 */
export class StrikeCollector {
  private readonly collectedHz: number[] = []

  recordReading(hz: number): void {
    const lastRecordedHz = this.collectedHz[this.collectedHz.length - 1]

    if (lastRecordedHz === undefined || Math.abs(centsBetween(hz, lastRecordedHz)) > STRIKE_DEDUP_THRESHOLD_CENTS) {
      this.collectedHz.push(hz)
    }
  }

  getCollectedFrequencies(): number[] {
    return [...this.collectedHz]
  }
}
