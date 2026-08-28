import { describe, expect, it } from 'vitest'
import { severityToColor } from './color-scale'
import type { Severity } from '../domain/guidance-model'

describe('severityToColor', () => {
  it('returns a distinct hex color for every severity', () => {
    const severities: Severity[] = ['inTune', 'slight', 'moderate', 'significant']
    const colors = severities.map(severityToColor)

    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(new Set(colors).size).toBe(severities.length)
  })

  it('is deterministic', () => {
    expect(severityToColor('significant')).toBe(severityToColor('significant'))
  })
})
