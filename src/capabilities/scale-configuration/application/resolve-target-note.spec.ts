import { describe, expect, it } from 'vitest'
import { ResolveTargetNote } from './resolve-target-note'
import { noteToFrequency } from '../domain/note'

const REFERENCE_PITCH_HZ = 440

function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

describe('ResolveTargetNote.resolveTarget', () => {
  it('resolves fresh on the first call to the nearest chromatic note', () => {
    const resolveTargetNote = new ResolveTargetNote(REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    const result = resolveTargetNote.resolveTarget(a4Hz)

    expect(result.note).toBe('A4')
    expect(result.targetHz).toBe(a4Hz)
    expect(result.centDeviation).toBeCloseTo(0, 6)
  })

  it('resolves any semitone, not just notes belonging to a particular scale', () => {
    const resolveTargetNote = new ResolveTargetNote(REFERENCE_PITCH_HZ)
    const bHz = noteToFrequency('B4', REFERENCE_PITCH_HZ)

    const result = resolveTargetNote.resolveTarget(bHz)

    expect(result.note).toBe('B4')
  })

  it('keeps the locked note on a small drift, but recomputes centDeviation live', () => {
    const resolveTargetNote = new ResolveTargetNote(REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    const first = resolveTargetNote.resolveTarget(a4Hz)
    expect(first.note).toBe('A4')

    // A few cents of drift/decay noise — well under the relock threshold.
    const driftedHz = a4Hz * centsToRatio(8)
    const second = resolveTargetNote.resolveTarget(driftedHz)

    expect(second.note).toBe('A4')
    expect(second.targetHz).toBe(first.targetHz)
    expect(second.centDeviation).toBeCloseTo(8, 6)
    expect(second.centDeviation).not.toBeCloseTo(first.centDeviation, 6)
  })

  it('relocks to a different note once detectedHz drifts past the threshold', () => {
    const resolveTargetNote = new ResolveTargetNote(REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    const first = resolveTargetNote.resolveTarget(a4Hz)
    expect(first.note).toBe('A4')

    const d5Hz = noteToFrequency('D5', REFERENCE_PITCH_HZ)
    const result = resolveTargetNote.resolveTarget(d5Hz)

    expect(result.note).toBe('D5')
    expect(result.centDeviation).toBeCloseTo(0, 6)
  })

  it('forces a fresh resolution when setReferencePitchHz() is called between reads', () => {
    const resolveTargetNote = new ResolveTargetNote(REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    resolveTargetNote.resolveTarget(a4Hz)
    resolveTargetNote.setReferencePitchHz(443)

    const driftedHz = a4Hz * centsToRatio(8)
    const result = resolveTargetNote.resolveTarget(driftedHz)

    expect(result.note).toBe('A4')
    expect(result.targetHz).toBe(noteToFrequency('A4', 443))
  })

  it('getReferencePitchHz reflects the constructor default and later updates', () => {
    const resolveTargetNote = new ResolveTargetNote(REFERENCE_PITCH_HZ)
    expect(resolveTargetNote.getReferencePitchHz()).toBe(REFERENCE_PITCH_HZ)

    resolveTargetNote.setReferencePitchHz(443)
    expect(resolveTargetNote.getReferencePitchHz()).toBe(443)
  })
})
