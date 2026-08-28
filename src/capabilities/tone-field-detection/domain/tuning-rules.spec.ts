import { describe, expect, it } from 'vitest'
import { createFrequency } from './value-objects'
import { centsBetween, expectedPartialRatio } from './tuning-rules'

describe('centsBetween', () => {
  it('is 0 for equal frequencies', () => {
    expect(centsBetween(createFrequency(440), createFrequency(440))).toBeCloseTo(0, 6)
  })

  it('is +1200 cents for exactly one octave up', () => {
    expect(centsBetween(createFrequency(880), createFrequency(440))).toBeCloseTo(1200, 6)
  })

  it('is -1200 cents for exactly one octave down', () => {
    expect(centsBetween(createFrequency(220), createFrequency(440))).toBeCloseTo(-1200, 6)
  })

  it('is +100 cents for one equal-tempered semitone up', () => {
    const semitoneUp = 440 * 2 ** (1 / 12)
    expect(centsBetween(createFrequency(semitoneUp), createFrequency(440))).toBeCloseTo(100, 6)
  })
})

describe('expectedPartialRatio', () => {
  it('is 2 for the octave partial', () => {
    expect(expectedPartialRatio('octave')).toBe(2)
  })

  it('is 3 for the compound fifth partial', () => {
    expect(expectedPartialRatio('compoundFifth')).toBe(3)
  })
})
