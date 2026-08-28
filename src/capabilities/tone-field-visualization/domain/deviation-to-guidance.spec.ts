import { describe, expect, it } from 'vitest'
import { deviationToGuidance } from './deviation-to-guidance'

describe('deviationToGuidance', () => {
  it('reports inTune with no hammer bias at 0 cents', () => {
    const guidance = deviationToGuidance(0)

    expect(guidance.radial.severity).toBe('inTune')
    expect(guidance.hammerBias).toBe('inTune')
    expect(guidance.longAxis).toBeNull()
    expect(guidance.shortAxis).toBeNull()
  })

  it('stays inTune within the slight-deviation threshold', () => {
    const guidance = deviationToGuidance(4)

    expect(guidance.radial.severity).toBe('inTune')
    expect(guidance.hammerBias).toBe('inTune')
  })

  it('biases toward the edge for a sharp (too-high) fundamental, scaling severity', () => {
    expect(deviationToGuidance(10).hammerBias).toBe('edge')
    expect(deviationToGuidance(10).radial.severity).toBe('slight')

    expect(deviationToGuidance(20).hammerBias).toBe('edge')
    expect(deviationToGuidance(20).radial.severity).toBe('moderate')

    expect(deviationToGuidance(45).hammerBias).toBe('edge')
    expect(deviationToGuidance(45).radial.severity).toBe('significant')
  })

  it('biases toward the center for a flat (too-low) fundamental, scaling severity', () => {
    expect(deviationToGuidance(-10).hammerBias).toBe('center')
    expect(deviationToGuidance(-10).radial.severity).toBe('slight')

    expect(deviationToGuidance(-20).hammerBias).toBe('center')
    expect(deviationToGuidance(-20).radial.severity).toBe('moderate')

    expect(deviationToGuidance(-45).hammerBias).toBe('center')
    expect(deviationToGuidance(-45).radial.severity).toBe('significant')
  })

  it('preserves the raw cent deviation on the radial signal', () => {
    expect(deviationToGuidance(-17.5).radial.centDeviation).toBe(-17.5)
  })
})
