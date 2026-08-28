import { describe, expect, it } from 'vitest'
import { createFrequency } from './value-objects'

describe('createFrequency', () => {
  it('accepts a positive Hz value', () => {
    expect(createFrequency(440)).toBe(440)
  })

  it.each([0, -1, -440])('rejects a non-positive Hz value (%d)', (hz) => {
    expect(() => createFrequency(hz)).toThrow(RangeError)
  })
})
