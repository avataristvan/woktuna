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

  it('treats NaN as inTune rather than a confident significant/edge reading', () => {
    const guidance = deviationToGuidance(NaN)

    expect(guidance.radial.severity).toBe('inTune')
    expect(guidance.hammerBias).toBe('inTune')
  })

  describe('hammerMode', () => {
    it('defaults to outside mode, matching pre-Chunk-8 behavior exactly', () => {
      expect(deviationToGuidance(-10).hammerBias).toBe('center')
      expect(deviationToGuidance(10).hammerBias).toBe('edge')
      expect(deviationToGuidance(0).hammerBias).toBe('inTune')
    })

    it('preserves outside-mode bias when explicitly passed', () => {
      expect(deviationToGuidance(-10, null, null, 'outside').hammerBias).toBe('center')
      expect(deviationToGuidance(10, null, null, 'outside').hammerBias).toBe('edge')
    })

    it('inverts the bias in inside mode per §2.3', () => {
      expect(deviationToGuidance(-10, null, null, 'inside').hammerBias).toBe('edge')
      expect(deviationToGuidance(10, null, null, 'inside').hammerBias).toBe('center')
    })

    it('stays inTune in inside mode regardless of deviation sign within threshold', () => {
      expect(deviationToGuidance(0, null, null, 'inside').hammerBias).toBe('inTune')
      expect(deviationToGuidance(4, null, null, 'inside').hammerBias).toBe('inTune')
    })
  })

  describe('axis guidance', () => {
    it('leaves longAxis/shortAxis null when no octave/fifth deviation is given', () => {
      const guidance = deviationToGuidance(0)

      expect(guidance.longAxis).toBeNull()
      expect(guidance.shortAxis).toBeNull()
    })

    it('populates longAxis from the octave deviation, mapped to the long axis', () => {
      const guidance = deviationToGuidance(0, 12, null)

      expect(guidance.longAxis).toEqual({ axis: 'long', centDeviation: 12, severity: 'slight' })
      expect(guidance.shortAxis).toBeNull()
    })

    it('populates shortAxis from the compound-fifth deviation, mapped to the short axis', () => {
      const guidance = deviationToGuidance(0, null, -35)

      expect(guidance.shortAxis).toEqual({ axis: 'short', centDeviation: -35, severity: 'significant' })
      expect(guidance.longAxis).toBeNull()
    })

    it('populates both axes independently with different severities when both are present', () => {
      const guidance = deviationToGuidance(0, 3, 20)

      expect(guidance.longAxis).toEqual({ axis: 'long', centDeviation: 3, severity: 'inTune' })
      expect(guidance.shortAxis).toEqual({ axis: 'short', centDeviation: 20, severity: 'moderate' })
    })

    it('keeps longAxis/shortAxis independent of the radial/fundamental severity', () => {
      const guidance = deviationToGuidance(45, 0, 0)

      expect(guidance.radial.severity).toBe('significant')
      expect(guidance.longAxis).toEqual({ axis: 'long', centDeviation: 0, severity: 'inTune' })
      expect(guidance.shortAxis).toEqual({ axis: 'short', centDeviation: 0, severity: 'inTune' })
    })
  })
})
