import { describe, expect, it } from 'vitest'
import { resolveHammerBias } from './hammer-direction'

describe('resolveHammerBias', () => {
  describe('outside mode (pre-Chunk-8 default behavior)', () => {
    it('returns inTune regardless of deviation sign when severity is inTune', () => {
      expect(resolveHammerBias(0, 'inTune', 'outside')).toBe('inTune')
      expect(resolveHammerBias(-4, 'inTune', 'outside')).toBe('inTune')
      expect(resolveHammerBias(4, 'inTune', 'outside')).toBe('inTune')
    })

    it('biases toward center for a flat (negative) deviation', () => {
      expect(resolveHammerBias(-10, 'slight', 'outside')).toBe('center')
      expect(resolveHammerBias(-45, 'significant', 'outside')).toBe('center')
    })

    it('biases toward edge for a sharp (positive) deviation', () => {
      expect(resolveHammerBias(10, 'slight', 'outside')).toBe('edge')
      expect(resolveHammerBias(45, 'significant', 'outside')).toBe('edge')
    })
  })

  describe('inside mode (§2.3 inversion)', () => {
    it('returns inTune regardless of deviation sign when severity is inTune', () => {
      expect(resolveHammerBias(0, 'inTune', 'inside')).toBe('inTune')
      expect(resolveHammerBias(-4, 'inTune', 'inside')).toBe('inTune')
      expect(resolveHammerBias(4, 'inTune', 'inside')).toBe('inTune')
    })

    it('biases toward edge for a flat (negative) deviation — inverted from outside mode', () => {
      expect(resolveHammerBias(-10, 'slight', 'inside')).toBe('edge')
      expect(resolveHammerBias(-45, 'significant', 'inside')).toBe('edge')
    })

    it('biases toward center for a sharp (positive) deviation — inverted from outside mode', () => {
      expect(resolveHammerBias(10, 'slight', 'inside')).toBe('center')
      expect(resolveHammerBias(45, 'significant', 'inside')).toBe('center')
    })
  })
})
