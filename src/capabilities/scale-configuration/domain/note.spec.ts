import { describe, expect, it } from 'vitest'
import { frequencyToNote, noteToFrequency, type NoteName } from './note'

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

describe('frequencyToNote', () => {
  const REFERENCE_PITCHES = [440, 443]
  const SAMPLE_NOTES: NoteName[] = ['C0', 'A3', 'A4', 'A5', 'D#4', 'F#2', 'B6', 'G#5']

  it.each(REFERENCE_PITCHES)('round-trips every sample note through noteToFrequency at reference %sHz', (referencePitchHz) => {
    for (const note of SAMPLE_NOTES) {
      expect(frequencyToNote(noteToFrequency(note, referencePitchHz), referencePitchHz)).toBe(note)
    }
  })

  it('resolves the reference pitch itself to A4, by definition', () => {
    expect(frequencyToNote(440, 440)).toBe('A4')
    expect(frequencyToNote(443, 443)).toBe('A4')
  })

  it('resolves exactly double the reference pitch to A5 (one octave up, defined as a frequency doubling)', () => {
    expect(frequencyToNote(880, 440)).toBe('A5')
  })

  it('resolves exactly half the reference pitch to A3 (one octave down, defined as a frequency halving)', () => {
    expect(frequencyToNote(220, 440)).toBe('A3')
  })

  it('rounds a frequency just below an exact note to that note, not its lower neighbor', () => {
    const exact = noteToFrequency('D4', 440)
    expect(frequencyToNote(exact * 0.999, 440)).toBe('D4')
  })

  it('rounds a frequency just above an exact note to that note, not its upper neighbor', () => {
    const exact = noteToFrequency('D4', 440)
    expect(frequencyToNote(exact * 1.001, 440)).toBe('D4')
  })

  it('rounds a frequency just below the exact midpoint between two semitones down to the lower note', () => {
    // Each equal-tempered semitone step is a factor of 2^(1/12), so the
    // midpoint between two adjacent semitones is a factor of 2^(1/24) —
    // this follows directly from the equal-temperament definition, not an
    // invented pitch table.
    const lower = noteToFrequency('D4', 440)
    const halfStepUp = Math.pow(2, 1 / 24)
    expect(frequencyToNote(lower * halfStepUp - 1e-6, 440)).toBe('D4')
  })

  it('rounds a frequency just above the exact midpoint between two semitones up to the upper note', () => {
    const lower = noteToFrequency('D4', 440)
    const halfStepUp = Math.pow(2, 1 / 24)
    expect(frequencyToNote(lower * halfStepUp + 1e-6, 440)).toBe('D#4')
  })
})
