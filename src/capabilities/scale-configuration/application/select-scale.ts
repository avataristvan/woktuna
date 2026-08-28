import type { Scale } from '../domain/scale'
import type { NearestTarget } from '../domain/nearest-target'
import { nearestTarget } from '../domain/nearest-target'

// 440Hz is an UNVERIFIED PLACEHOLDER default reference pitch, per plan Open
// Item #1 — this repo has no confirmed source for what reference pitch real
// handpans in this project should be tuned to (some makers use 443Hz). It
// must remain overridable, never treated as a confirmed constant.
const UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ = 440

/**
 * Holds the currently active `Scale` and resolves a detected fundamental
 * (Hz) to its nearest target note within that scale.
 */
export class SelectScale {
  private activeScale: Scale
  private referencePitchHz: number

  constructor(initialScale: Scale, referencePitchHz: number = UNVERIFIED_DEFAULT_REFERENCE_PITCH_HZ) {
    this.activeScale = initialScale
    this.referencePitchHz = referencePitchHz
  }

  getActiveScale(): Scale {
    return this.activeScale
  }

  setActiveScale(scale: Scale): void {
    this.activeScale = scale
  }

  getReferencePitchHz(): number {
    return this.referencePitchHz
  }

  setReferencePitchHz(referencePitchHz: number): void {
    this.referencePitchHz = referencePitchHz
  }

  nearestTargetFor(detectedHz: number): NearestTarget {
    return nearestTarget(detectedHz, this.activeScale, this.referencePitchHz)
  }
}
