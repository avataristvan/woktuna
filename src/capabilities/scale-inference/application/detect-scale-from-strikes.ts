import type { Scale } from '../../scale-configuration/domain/scale'
import { StrikeCollector } from '../domain/strike-collector'
import { matchScale } from '../domain/match-scale'
import { buildAdHocScale } from '../domain/build-ad-hoc-scale'

export interface InferredScale {
  scale: Scale
  confidence: number
  isKnownScale: boolean
}

/**
 * Collects strikes (via `StrikeCollector`) while the player works through
 * their handpan, then infers which scale it is: `matchScale` is tried first
 * against `candidates`, falling back to an ad-hoc `Scale` built directly
 * from the collected notes (`buildAdHocScale`) when no candidate fits well
 * enough. The ad-hoc fallback carries `confidence: 0` — it is an exact fit
 * to the collected data by construction, so "confidence" in the matching
 * sense doesn't apply; 0 signals to callers that this wasn't validated
 * against any known scale, unlike a genuine `matchScale` result.
 */
export class DetectScaleFromStrikes {
  private readonly strikeCollector = new StrikeCollector()

  recordStrike(hz: number): void {
    this.strikeCollector.recordReading(hz)
  }

  inferScale(candidates: readonly Scale[], referencePitchHz: number): InferredScale {
    const collectedHz = this.strikeCollector.getCollectedFrequencies()
    const matched = matchScale(collectedHz, candidates, referencePitchHz)

    if (matched !== null) {
      return { scale: matched.scale, confidence: matched.confidence, isKnownScale: true }
    }

    return { scale: buildAdHocScale(collectedHz, referencePitchHz), confidence: 0, isKnownScale: false }
  }
}
