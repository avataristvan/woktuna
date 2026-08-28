import { describe, expect, it } from 'vitest'
import type { ToneFieldReading } from '../../tone-field-detection/domain/value-objects'
import { createFrequency } from '../../tone-field-detection/domain/value-objects'
import { buildGuidance } from './build-guidance'

function readingAt(hz: number): ToneFieldReading {
  return { fundamental: { kind: 'fundamental', frequency: createFrequency(hz) } }
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
})
