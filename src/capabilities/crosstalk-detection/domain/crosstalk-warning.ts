import type { NoteName } from '../../scale-configuration/domain/note'

/**
 * How much to trust a crosstalk flag. Deliberately has no 'high' option —
 * per handpan-stimm-app-recherche.md §2.5, whether/how strongly energy
 * couples between neighboring tone fields (and along which axis) is an
 * explicitly UNRESOLVED open question, not a solved problem this app can
 * claim certainty about. 'medium' here still only means "clears the local
 * noise floor by a wide margin", never "confirmed crosstalk".
 */
export type CrosstalkConfidence = 'low' | 'medium'

/**
 * A heuristic flag that a scale note NOT currently being tuned shows
 * suspicious spectral energy near its target frequency — possibly leakage
 * from a neighboring tone field bleeding into this frame's spectrum
 * (§2.5), possibly something else entirely (a harmonic of the struck
 * field, room noise, a mis-set tolerance). This is a hint worth a damped
 * re-check, never an assertion that crosstalk occurred.
 *
 * `suspectedNote` is filled in by the application layer (`CheckCrosstalk`),
 * which is the layer that actually knows the mapping from target
 * frequency to scale note (see `note.ts`'s `noteToFrequency`) — the pure
 * domain detector (`detectCrosstalk`) works only in Hz and has no notion
 * of note identity, so it leaves this unset.
 */
export interface CrosstalkWarning {
  readonly suspectedNote?: NoteName
  readonly targetHz: number
  readonly magnitude: number
  readonly confidence: CrosstalkConfidence
}
