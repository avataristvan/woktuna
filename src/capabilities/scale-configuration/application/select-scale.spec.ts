import { describe, expect, it } from 'vitest'
import { SelectScale } from './select-scale'
import { noteToFrequency } from '../domain/note'
import { nearestTarget } from '../domain/nearest-target'
import type { Scale } from '../domain/scale'

const REFERENCE_PITCH_HZ = 440

function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

// A#4/D5 are a compound-fifth-ish spread apart so a "genuinely different
// note" reading in these tests lands nowhere near the D5 lock's threshold.
const scale: Scale = { name: 'test', notes: ['A4', 'A#4', 'D5'] }

describe('SelectScale.nearestTargetFor', () => {
  it('resolves fresh on the first call, matching nearestTarget() directly', () => {
    const selectScale = new SelectScale(scale, REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    const result = selectScale.nearestTargetFor(a4Hz)
    const expected = nearestTarget(a4Hz, scale, REFERENCE_PITCH_HZ)

    expect(result).toEqual(expected)
  })

  it('keeps the locked note on a small drift, but recomputes centDeviation live', () => {
    const selectScale = new SelectScale(scale, REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    const first = selectScale.nearestTargetFor(a4Hz)
    expect(first.note).toBe('A4')

    // A few cents of drift/decay noise — well under the relock threshold.
    const driftedHz = a4Hz * centsToRatio(8)
    const second = selectScale.nearestTargetFor(driftedHz)

    expect(second.note).toBe('A4')
    expect(second.targetHz).toBe(first.targetHz)
    expect(second.centDeviation).toBeCloseTo(8, 6)
    expect(second.centDeviation).not.toBeCloseTo(first.centDeviation, 6)
  })

  it('relocks to a different note once detectedHz drifts past the threshold', () => {
    const selectScale = new SelectScale(scale, REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    const first = selectScale.nearestTargetFor(a4Hz)
    expect(first.note).toBe('A4')

    const d5Hz = noteToFrequency('D5', REFERENCE_PITCH_HZ)
    const result = selectScale.nearestTargetFor(d5Hz)

    expect(result.note).toBe('D5')
    expect(result.centDeviation).toBeCloseTo(0, 6)
  })

  it('forces a fresh resolution when setActiveScale() is called between reads', () => {
    const selectScale = new SelectScale(scale, REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    selectScale.nearestTargetFor(a4Hz)

    const otherScale: Scale = { name: 'other', notes: ['A#4'] }
    selectScale.setActiveScale(otherScale)

    // Small drift that would have stayed within the old A4 lock's threshold.
    const driftedHz = a4Hz * centsToRatio(8)
    const result = selectScale.nearestTargetFor(driftedHz)

    expect(result.note).toBe('A#4')
  })

  it('forces a fresh resolution when setReferencePitchHz() is called between reads', () => {
    const selectScale = new SelectScale(scale, REFERENCE_PITCH_HZ)
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    selectScale.nearestTargetFor(a4Hz)
    selectScale.setReferencePitchHz(443)

    const driftedHz = a4Hz * centsToRatio(8)
    const result = selectScale.nearestTargetFor(driftedHz)
    const expected = nearestTarget(driftedHz, scale, 443)

    expect(result).toEqual(expected)
  })
})
