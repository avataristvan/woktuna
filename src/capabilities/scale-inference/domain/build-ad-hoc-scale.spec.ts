import { describe, expect, it } from 'vitest'
import { buildAdHocScale } from './build-ad-hoc-scale'
import { noteToFrequency } from '../../scale-configuration/domain/note'

const REFERENCE_PITCH_HZ = 440

describe('buildAdHocScale', () => {
  it('names the result "Custom (detected)"', () => {
    const scale = buildAdHocScale([220], REFERENCE_PITCH_HZ)

    expect(scale.name).toBe('Custom (detected)')
  })

  it('resolves each collected frequency to its nearest note, in ascending pitch order', () => {
    const c4Hz = noteToFrequency('C4', REFERENCE_PITCH_HZ)
    const a3Hz = noteToFrequency('A3', REFERENCE_PITCH_HZ)
    const e4Hz = noteToFrequency('E4', REFERENCE_PITCH_HZ)

    // Passed in out of pitch order on purpose.
    const scale = buildAdHocScale([c4Hz, a3Hz, e4Hz], REFERENCE_PITCH_HZ)

    expect(scale.notes).toEqual(['A3', 'C4', 'E4'])
  })

  it('deduplicates collected frequencies that resolve to the same note', () => {
    const a3Hz = noteToFrequency('A3', REFERENCE_PITCH_HZ)
    const slightlyDetunedA3Hz = a3Hz * Math.pow(2, 5 / 1200) // still nearest to A3

    const scale = buildAdHocScale([a3Hz, slightlyDetunedA3Hz], REFERENCE_PITCH_HZ)

    expect(scale.notes).toEqual(['A3'])
  })

  it('returns an empty note list for no collected frequencies', () => {
    const scale = buildAdHocScale([], REFERENCE_PITCH_HZ)

    expect(scale.notes).toEqual([])
  })
})
