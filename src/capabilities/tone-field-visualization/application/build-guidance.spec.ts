import { describe, expect, it } from 'vitest'
import type { ToneFieldReading } from '../../tone-field-detection/domain/value-objects'
import { createFrequency } from '../../tone-field-detection/domain/value-objects'
import { buildGuidance } from './build-guidance'

function readingAt(hz: number, octaveHz?: number, compoundFifthHz?: number): ToneFieldReading {
  return {
    fundamental: { kind: 'fundamental', frequency: createFrequency(hz) },
    octave: octaveHz !== undefined ? { kind: 'octave', frequency: createFrequency(octaveHz) } : undefined,
    compoundFifth:
      compoundFifthHz !== undefined
        ? { kind: 'compoundFifth', frequency: createFrequency(compoundFifthHz) }
        : undefined,
  }
}

describe('buildGuidance', () => {
  it('computes the fundamental cent deviation against the given target and maps it to guidance', () => {
    const guidance = buildGuidance(readingAt(441), 440)

    expect(guidance.radial.centDeviation).toBeCloseTo(1200 * Math.log2(441 / 440), 5)
    expect(guidance.radial.severity).toBe('inTune')
    expect(guidance.hammerBias).toBe('inTune')
  })

  it('biases toward the edge when the fundamental is sharp of the target', () => {
    const guidance = buildGuidance(readingAt(450), 440)

    expect(guidance.hammerBias).toBe('edge')
    expect(guidance.radial.severity).toBe('significant')
  })

  it('biases toward the center when the fundamental is flat of the target', () => {
    const guidance = buildGuidance(readingAt(435), 440)

    expect(guidance.hammerBias).toBe('center')
    expect(guidance.radial.centDeviation).toBeLessThan(0)
  })

  describe('hammerMode', () => {
    it('defaults to outside mode', () => {
      expect(buildGuidance(readingAt(435), 440).hammerBias).toBe('center')
    })

    it('inverts the hammer bias when inside mode is passed through', () => {
      expect(buildGuidance(readingAt(435), 440, 'inside').hammerBias).toBe('edge')
      expect(buildGuidance(readingAt(450), 440, 'inside').hammerBias).toBe('center')
    })
  })

  describe('axis guidance from octave/compound-fifth partials', () => {
    it('leaves longAxis/shortAxis null when the reading has no octave/fifth partial', () => {
      const guidance = buildGuidance(readingAt(440), 440)

      expect(guidance.longAxis).toBeNull()
      expect(guidance.shortAxis).toBeNull()
    })

    it('computes longAxis deviation against 2x the fundamental target', () => {
      // octave target = 440 * 2 = 880; 882 is sharp of that
      const guidance = buildGuidance(readingAt(440, 882), 440)

      expect(guidance.longAxis).not.toBeNull()
      expect(guidance.longAxis?.axis).toBe('long')
      expect(guidance.longAxis?.centDeviation).toBeCloseTo(1200 * Math.log2(882 / 880), 5)
      expect(guidance.shortAxis).toBeNull()
    })

    it('computes shortAxis deviation against 3x the fundamental target', () => {
      // compound-fifth target = 440 * 3 = 1320; 1310 is flat of that
      const guidance = buildGuidance(readingAt(440, undefined, 1310), 440)

      expect(guidance.shortAxis).not.toBeNull()
      expect(guidance.shortAxis?.axis).toBe('short')
      expect(guidance.shortAxis?.centDeviation).toBeCloseTo(1200 * Math.log2(1310 / 1320), 5)
      expect(guidance.longAxis).toBeNull()
    })

    it('populates both axes independently when both partials are present', () => {
      const guidance = buildGuidance(readingAt(440, 880, 1320), 440)

      expect(guidance.longAxis?.severity).toBe('inTune')
      expect(guidance.shortAxis?.severity).toBe('inTune')
    })
  })
})
