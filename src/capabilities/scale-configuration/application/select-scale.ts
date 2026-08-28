import type { Scale } from '../domain/scale'
import type { NearestTarget } from '../domain/nearest-target'
import { nearestTarget } from '../domain/nearest-target'
import type { NoteName } from '../domain/note'

// 440Hz is an UNVERIFIED PLACEHOLDER default reference pitch, per plan Open
// Item #1 — this repo has no confirmed source for what reference pitch real
// handpans in this project should be tuned to (some makers use 443Hz). It's
// only the starting value: `src/main.ts` exposes a UI control (backed by
// `setReferencePitchHz` below) that lets the user change it at any time, so
// it must never be hardened into a fixed, unconfigurable constant.
const UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ = 440

// Deliberately re-implemented here rather than imported from
// `nearest-target.ts` (which doesn't export it) — same capability-boundary
// reasoning that file already documents for not importing
// tone-field-detection's cents helper: keep each layer's cents math local
// rather than growing a shared-but-private dependency between an
// application-layer file and a domain-layer one.
function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b)
}

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
 * Holds the currently active `Scale` and resolves a detected fundamental
 * (Hz) to its nearest target note within that scale.
 */
export class SelectScale {
  private activeScale: Scale
  private referencePitchHz: number
  private lock: LockedTarget | null = null

  constructor(initialScale: Scale, referencePitchHz: number = UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ) {
    this.activeScale = initialScale
    this.referencePitchHz = referencePitchHz
  }

  getActiveScale(): Scale {
    return this.activeScale
  }

  setActiveScale(scale: Scale): void {
    this.activeScale = scale
    this.lock = null
  }

  getReferencePitchHz(): number {
    return this.referencePitchHz
  }

  setReferencePitchHz(referencePitchHz: number): void {
    this.referencePitchHz = referencePitchHz
    this.lock = null
  }

  /**
   * Resolves `detectedHz` to a `NearestTarget`, but "sticky": once a target
   * note is locked, it keeps being returned as the displayed reference note
   * for as long as `detectedHz` stays within
   * `STICKY_LOCK_RELOCK_THRESHOLD_CENTS` of that locked note's frequency —
   * only `centDeviation` is recomputed fresh against the live `detectedHz`
   * each call.
   *
   * Why: this method used to call `nearestTarget()` fresh on every rAF
   * frame with no memory between calls. Live-hardware testing showed that
   * as a struck note's sound decays (or a nearby tone field's resonance
   * bleeds into the mic), a single noisy/decayed frame's raw pitch reading
   * could flip which note the app reports as the target — usually jumping
   * to the lowest/Ding note — even though the player is still hearing
   * (the decay of) the same struck note. Locking the target and only
   * relocking on a clearly-different reading fixes the displayed reference
   * note while keeping the live tuning feedback (`centDeviation`)
   * responsive. This does not address the underlying autocorrelation
   * octave/subharmonic misdetection that can produce a wrong `detectedHz`
   * in the first place — that's a separate, DSP-layer concern.
   */
  nearestTargetFor(detectedHz: number): NearestTarget {
    if (this.lock !== null) {
      const centDeviation = centsBetween(detectedHz, this.lock.targetHz)
      if (Math.abs(centDeviation) <= STICKY_LOCK_RELOCK_THRESHOLD_CENTS) {
        return { note: this.lock.note, targetHz: this.lock.targetHz, centDeviation }
      }
    }

    const resolved = nearestTarget(detectedHz, this.activeScale, this.referencePitchHz)
    this.lock = { note: resolved.note, targetHz: resolved.targetHz }
    return resolved
  }
}
