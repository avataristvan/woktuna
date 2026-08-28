import { describe, expect, it } from 'vitest'
import { noteToFrequency } from './note'
import { nearestTarget } from './nearest-target'
import type { Scale } from './scale'

const REFERENCE_PITCH_HZ = 440

function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200)
}

describe('nearestTarget', () => {
  it('reports 0 cent deviation on an exact match', () => {
    const scale: Scale = { name: 'test', notes: ['C4', 'A4', 'E5'] }
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    const result = nearestTarget(a4Hz, scale, REFERENCE_PITCH_HZ)

    expect(result.note).toBe('A4')
    expect(result.centDeviation).toBeCloseTo(0, 6)
  })

  it('reports a positive cent deviation when the detected pitch is sharp', () => {
    const scale: Scale = { name: 'test', notes: ['A4'] }
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)
    const sharpHz = a4Hz * centsToRatio(15)

    const result = nearestTarget(sharpHz, scale, REFERENCE_PITCH_HZ)

    expect(result.note).toBe('A4')
    expect(result.centDeviation).toBeCloseTo(15, 6)
  })

  it('reports a negative cent deviation when the detected pitch is flat', () => {
    const scale: Scale = { name: 'test', notes: ['A4'] }
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)
    const flatHz = a4Hz * centsToRatio(-15)

    const result = nearestTarget(flatHz, scale, REFERENCE_PITCH_HZ)

    expect(result.note).toBe('A4')
    expect(result.centDeviation).toBeCloseTo(-15, 6)
  })

  it('picks whichever of two adjacent notes is closer, near the midpoint', () => {
    const scale: Scale = { name: 'test', notes: ['A4', 'A#4'] }
    const a4Hz = noteToFrequency('A4', REFERENCE_PITCH_HZ)

    // A4 and A#4 are 100 cents apart; the midpoint is 50 cents from each.
    const justBelowMidpoint = a4Hz * centsToRatio(49)
    const justAboveMidpoint = a4Hz * centsToRatio(51)

    expect(nearestTarget(justBelowMidpoint, scale, REFERENCE_PITCH_HZ).note).toBe('A4')
    expect(nearestTarget(justAboveMidpoint, scale, REFERENCE_PITCH_HZ).note).toBe('A#4')
  })
})
