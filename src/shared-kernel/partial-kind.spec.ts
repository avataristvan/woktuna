import { describe, expect, it } from 'vitest'
import { axisForPartial, expectedPartialRatio } from './partial-kind'

describe('axisForPartial', () => {
  it('maps octave to the long axis', () => {
    expect(axisForPartial('octave')).toBe('long')
  })

  it('maps compoundFifth to the short axis', () => {
    expect(axisForPartial('compoundFifth')).toBe('short')
  })
})

describe('expectedPartialRatio', () => {
  it('is 2x for the octave', () => {
    expect(expectedPartialRatio('octave')).toBe(2)
  })

  it('is 3x for the compound fifth', () => {
    expect(expectedPartialRatio('compoundFifth')).toBe(3)
  })
})
