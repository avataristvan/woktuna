/**
 * Shared vocabulary for handpan tone-field partials — the vocabulary both
 * `tone-field-detection` (what gets measured) and `tone-field-visualization`
 * (what gets drawn) need to agree on, per research doc §2.1: each tone field
 * resonates at a fundamental (center/dimple), an octave (long axis of the
 * oval), and a compound fifth (short axis).
 *
 * The ratio constants here deliberately duplicate
 * `tone-field-detection/domain/tuning-rules.ts`'s `expectedPartialRatio`
 * (same domain constants — octave ~2x, compound fifth ~3x the fundamental)
 * rather than importing it: shared-kernel sits *below* capabilities in the
 * dependency graph (capabilities may depend on shared-kernel, never the
 * reverse), so reaching up into a capability's domain module from here would
 * invert that direction. Keep both definitions in sync if this domain
 * constant ever changes.
 */

export type PartialKind = 'fundamental' | 'octave' | 'compoundFifth'

/** Which axis of the oval tone-field graphic a non-fundamental partial maps to. */
export type Axis = 'long' | 'short'

/** Per research doc §2.1: octave → long axis, compound fifth → short axis. */
export function axisForPartial(kind: Exclude<PartialKind, 'fundamental'>): Axis {
  switch (kind) {
    case 'octave':
      return 'long'
    case 'compoundFifth':
      return 'short'
  }
}

/**
 * Expected frequency ratio (partial : fundamental). A perfect fifth is
 * ~1.5x; the compound fifth is an octave above that, so 2 x 1.5 = 3x.
 */
export function expectedPartialRatio(kind: Exclude<PartialKind, 'fundamental'>): number {
  switch (kind) {
    case 'octave':
      return 2
    case 'compoundFifth':
      return 3
  }
}
