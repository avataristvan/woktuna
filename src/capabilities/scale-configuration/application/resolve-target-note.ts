import type { NoteName } from '../domain/note'
import { frequencyToNote, noteToFrequency } from '../domain/note'

export interface ResolvedTarget {
  note: NoteName
  targetHz: number
  centDeviation: number
}

// Deliberately re-implemented here rather than imported from `note.ts`
// (which doesn't export it) — keeps this application-layer file's cents
// math local rather than growing a shared-but-private dependency between
// an application-layer file and a domain-layer one.
function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b)
}

// 440Hz is an UNVERIFIED PLACEHOLDER default reference pitch, per plan Open
// Item #1 — this repo has no confirmed source for what reference pitch real
// handpans in this project should be tuned to (some makers use 443Hz). It's
// only the starting value: `src/main.ts` exposes a UI control (backed by
// `setReferencePitchHz` below) that lets the user change it at any time, so
// it must never be hardened into a fixed, unconfigurable constant.
const UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ = 440

// How far (in cents) a fresh `detectedHz` reading may drift from the
// currently-locked target before it's treated as a genuinely different note
// being struck, rather than noise/decay/vibrato on the same note. This is an
// UNVERIFIED HEURISTIC, not a measured constant (same status as this repo's
// other DSP-adjacent tunables, e.g. `fft-peak-picking.ts`'s
// `DEFAULT_TOLERANCE_CENTS`) — needs real-hardware validation. 175 cents was
// chosen as roughly one scale-step (adjacent handpan scale degrees are
// commonly a whole tone, ~200 cents, or a semitone, ~100 cents, apart): wide
// enough to absorb normal pitch drift, vibrato, and decay-phase noise around
// the struck note without relocking, narrow enough to still catch a strike
// on a clearly different note (which lands close to 0 cents from its own,
// different, target rather than near the edge of this window).
const STICKY_LOCK_RELOCK_THRESHOLD_CENTS = 175

interface LockedTarget {
  note: NoteName
  targetHz: number
}

/**
 * Resolves a detected fundamental (Hz) to its nearest equal-tempered note —
 * pure chromatic resolution via `frequencyToNote`/`noteToFrequency`, not
 * constrained to any named scale's note list. Whatever tone field is
 * currently struck is compared against the nearest correct pitch, full
 * stop.
 */
export class ResolveTargetNote {
  private referencePitchHz: number
  private lock: LockedTarget | null = null

  constructor(referencePitchHz: number = UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ) {
    this.referencePitchHz = referencePitchHz
  }

  getReferencePitchHz(): number {
    return this.referencePitchHz
  }

  setReferencePitchHz(referencePitchHz: number): void {
    this.referencePitchHz = referencePitchHz
    this.lock = null
  }

  /**
   * Resolves `detectedHz` to a `ResolvedTarget`, but "sticky": once a target
   * note is locked, it keeps being returned as the displayed reference note
   * for as long as `detectedHz` stays within
   * `STICKY_LOCK_RELOCK_THRESHOLD_CENTS` of that locked note's frequency —
   * only `centDeviation` is recomputed fresh against the live `detectedHz`
   * each call.
   *
   * Why: calling `frequencyToNote` fresh on every rAF frame with no memory
   * lets a single noisy/decayed frame's raw pitch reading flip which note is
   * reported as the target — usually jumping to a neighboring semitone —
   * even though the player is still hearing (the decay of) the same struck
   * note. Locking the target and only relocking on a clearly-different
   * reading fixes the displayed reference note while keeping the live
   * tuning feedback (`centDeviation`) responsive. This does not fix the
   * underlying autocorrelation octave/subharmonic misdetection that can
   * produce a wrong `detectedHz` in the first place (`autocorrelation.ts`)
   * — that's a separate, not-yet-scoped DSP concern; this only mitigates
   * the symptom at the scale-configuration layer.
   */
  resolveTarget(detectedHz: number): ResolvedTarget {
    if (this.lock !== null) {
      const centDeviation = centsBetween(detectedHz, this.lock.targetHz)
      if (Math.abs(centDeviation) <= STICKY_LOCK_RELOCK_THRESHOLD_CENTS) {
        return { note: this.lock.note, targetHz: this.lock.targetHz, centDeviation }
      }
    }

    const note = frequencyToNote(detectedHz, this.referencePitchHz)
    const targetHz = noteToFrequency(note, this.referencePitchHz)
    const centDeviation = centsBetween(detectedHz, targetHz)
    this.lock = { note, targetHz }
    return { note, targetHz, centDeviation }
  }
}
