import { describe, expect, it } from 'vitest'
import { DetectScaleFromStrikes } from './detect-scale-from-strikes'
import { noteToFrequency } from '../../scale-configuration/domain/note'
import { KNOWN_SCALES } from '../../scale-configuration/infrastructure/known-scales'

const REFERENCE_PITCH_HZ = 440

describe('DetectScaleFromStrikes', () => {
  it('identifies a known scale once strikes matching it have been recorded', () => {
    const targetScale = KNOWN_SCALES[0]
    const detector = new DetectScaleFromStrikes()

    for (const note of targetScale.notes) {
      detector.recordStrike(noteToFrequency(note, REFERENCE_PITCH_HZ))
    }

    const result = detector.inferScale(KNOWN_SCALES, REFERENCE_PITCH_HZ)

    expect(result.isKnownScale).toBe(true)
    expect(result.scale.name).toBe(targetScale.name)
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('falls back to an ad-hoc scale when the recorded strikes match no known scale', () => {
    const detector = new DetectScaleFromStrikes()
    const unrelatedFrequencies = [233.7, 391.2, 512.9, 677.4]

    for (const hz of unrelatedFrequencies) {
      detector.recordStrike(hz)
    }

    const result = detector.inferScale(KNOWN_SCALES, REFERENCE_PITCH_HZ)

    expect(result.isKnownScale).toBe(false)
    expect(result.confidence).toBe(0)
    expect(result.scale.name).toBe('Custom (detected)')
    expect(result.scale.notes.length).toBeGreaterThan(0)
  })

  it('deduplicates repeated readings of the same ringing note before inferring', () => {
    const detector = new DetectScaleFromStrikes()
    // Same 4 well-separated, unmatched frequencies as the "falls back to an
    // ad-hoc scale" test above (verified there to produce a 4-note ad-hoc
    // scale); the first one gets two near-identical extra readings right
    // after it, which must collapse away rather than appear as extra notes.
    const firstStrikeHz = 233.7

    detector.recordStrike(firstStrikeHz)
    detector.recordStrike(firstStrikeHz * 1.0005)
    detector.recordStrike(firstStrikeHz * 0.9995)
    detector.recordStrike(391.2)
    detector.recordStrike(512.9)
    detector.recordStrike(677.4)

    const result = detector.inferScale(KNOWN_SCALES, REFERENCE_PITCH_HZ)

    expect(result.isKnownScale).toBe(false)
    expect(result.scale.notes).toHaveLength(4)
  })
})
