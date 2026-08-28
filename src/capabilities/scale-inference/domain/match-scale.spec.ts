import { describe, expect, it } from 'vitest'
import { matchScale } from './match-scale'
import { noteToFrequency } from '../../scale-configuration/domain/note'
import { KNOWN_SCALES } from '../../scale-configuration/infrastructure/known-scales'

const REFERENCE_PITCH_HZ = 440

function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

describe('matchScale', () => {
  it('identifies a known scale with high confidence when collected frequencies closely match it', () => {
    const targetScale = KNOWN_SCALES[0]
    const collectedHz = targetScale.notes.map((note, i) => noteToFrequency(note, REFERENCE_PITCH_HZ) * centsToRatio(i % 2 === 0 ? 3 : -3))

    const result = matchScale(collectedHz, KNOWN_SCALES, REFERENCE_PITCH_HZ)

    expect(result).not.toBeNull()
    expect(result?.scale.name).toBe(targetScale.name)
    expect(result?.confidence).toBeGreaterThan(0.9)
  })

  it('returns null when collected frequencies do not fit any known scale well', () => {
    const collectedHz = [233.7, 391.2, 512.9, 677.4] // arbitrary, not aligned to any KNOWN_SCALES layout

    const result = matchScale(collectedHz, KNOWN_SCALES, REFERENCE_PITCH_HZ)

    expect(result).toBeNull()
  })

  it('returns null for an empty candidate list', () => {
    expect(matchScale([220], [], REFERENCE_PITCH_HZ)).toBeNull()
  })

  it('returns null for empty collected frequencies', () => {
    expect(matchScale([], KNOWN_SCALES, REFERENCE_PITCH_HZ)).toBeNull()
  })
})
