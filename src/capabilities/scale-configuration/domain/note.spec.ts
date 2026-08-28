import { describe, expect, it } from 'vitest'
import { noteToFrequency } from './note'

describe('noteToFrequency', () => {
  it('resolves A4 to the reference pitch itself, by definition', () => {
    expect(noteToFrequency('A4', 440)).toBeCloseTo(440, 6)
  })

  it('resolves A4 to a non-440 reference pitch unchanged', () => {
    expect(noteToFrequency('A4', 443)).toBeCloseTo(443, 6)
  })

  it('resolves A3 to half the reference pitch (one octave down)', () => {
    expect(noteToFrequency('A3', 440)).toBeCloseTo(220, 6)
  })

  it('resolves A5 to double the reference pitch (one octave up)', () => {
    expect(noteToFrequency('A5', 440)).toBeCloseTo(880, 6)
  })

  it('throws on an invalid note name', () => {
    expect(() => noteToFrequency('H4' as never, 440)).toThrow()
  })
})
