import type { CentDeviation, Frequency, PartialKind } from './value-objects'
import { createCentDeviation } from './value-objects'

/** Cents between two frequencies (standard equal-temperament formula). */
export function centsBetween(a: Frequency, b: Frequency): CentDeviation {
  return createCentDeviation(1200 * Math.log2(a / b))
}

/**
 * Expected frequency ratio (partial : fundamental) for each non-fundamental
 * partial. Per handpan-stimm-app-recherche.md §2.1: the octave partial sits
 * on the tone field's long axis (~2x the fundamental), the compound fifth
 * sits on the short axis (an octave plus a fifth above the fundamental —
 * a perfect fifth is ~1.5x, so 2 x 1.5 = 3x).
 */
export function expectedPartialRatio(kind: Exclude<PartialKind, 'fundamental'>): number {
  switch (kind) {
    case 'octave':
      return 2
    case 'compoundFifth':
      return 3
  }
}
