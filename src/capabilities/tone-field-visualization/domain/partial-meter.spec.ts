import { describe, expect, it } from 'vitest'
import {
  centDeviationToSeverity,
  deviationToGuidance,
} from './deviation-to-guidance'
import {
  buildTunerPanel,
  deviationDirection,
  METER_RANGE_CENTS,
  toPartialMeter,
} from './partial-meter'

describe('deviationDirection', () => {
  it.each([
    [0.1, 'inTune'],
    [-0.1, 'inTune'],
    [5, 'inTune'],
    [-5, 'inTune'],
    [5.1, 'high'],
    [-5.1, 'low'],
    [15.1, 'high'],
    [-15.1, 'low'],
    [30.1, 'high'],
    [-30.1, 'low'],
  ] as const)('%f cents -> %s', (cents, expected) => {
    expect(deviationDirection(cents, centDeviationToSeverity(cents))).toBe(
      expected,
    )
  })
})

describe('toPartialMeter', () => {
  it('maps position linearly within range', () => {
    const meter = toPartialMeter(25)
    expect(meter.position).toBe(0.5)
    expect(meter.clamped).toBe(false)
    expect(meter.state).toBe('high')
    expect(meter.wordLabel).toBe('too high')
    expect(meter.severity).toBe('moderate')
  })

  it('does not clamp exactly at the range boundary', () => {
    const meter = toPartialMeter(METER_RANGE_CENTS)
    expect(meter.position).toBe(1)
    expect(meter.clamped).toBe(false)
    expect(toPartialMeter(-METER_RANGE_CENTS).position).toBe(-1)
  })

  it('clamps beyond the range while keeping the raw value in the text', () => {
    const high = toPartialMeter(73.4)
    expect(high.position).toBe(1)
    expect(high.clamped).toBe(true)
    expect(high.signedText).toBe('+73 ¢')
    const low = toPartialMeter(-200)
    expect(low.position).toBe(-1)
    expect(low.clamped).toBe(true)
    expect(low.state).toBe('low')
  })

  it('returns noReading for null', () => {
    expect(toPartialMeter(null)).toEqual({
      state: 'noReading',
      position: 0,
      clamped: false,
      severity: null,
      signedText: '—',
      wordLabel: '—',
    })
  })

  it('returns noReading for NaN instead of a fabricated in-tune meter', () => {
    const meter = toPartialMeter(NaN)
    expect(meter.state).toBe('noReading')
    expect(meter.severity).toBeNull()
    expect(meter.wordLabel).toBe('—')
  })

  it('formats signed text with ASCII signs and never signed zero', () => {
    expect(toPartialMeter(12).signedText).toBe('+12 ¢')
    expect(toPartialMeter(-12).signedText).toBe('-12 ¢')
    expect(toPartialMeter(-0.4).signedText).toBe('0 ¢')
    expect(toPartialMeter(0.4).signedText).toBe('0 ¢')
    expect(toPartialMeter(0).signedText).toBe('0 ¢')
  })

  it('uses a provided severity instead of recomputing', () => {
    expect(toPartialMeter(40, 'inTune').state).toBe('inTune')
  })
})

describe('buildTunerPanel', () => {
  it('orders rows fundamental, octave, fifth and maps axes', () => {
    const panel = buildTunerPanel(deviationToGuidance(-10, 20, -35))
    expect(panel.rows.map((r) => r.kind)).toEqual([
      'fundamental',
      'octave',
      'compoundFifth',
    ])
    expect(panel.rows.map((r) => r.title)).toEqual([
      'Fundamental',
      'Octave (long axis)',
      'Fifth (short axis)',
    ])
    expect(panel.rows[0].meter.signedText).toBe('-10 ¢')
    expect(panel.rows[1].meter.signedText).toBe('+20 ¢')
    expect(panel.rows[2].meter.signedText).toBe('-35 ¢')
  })

  it('yields noReading rows for null axes', () => {
    const panel = buildTunerPanel(deviationToGuidance(3))
    expect(panel.rows[0].meter.state).toBe('inTune')
    expect(panel.rows[1].meter.state).toBe('noReading')
    expect(panel.rows[2].meter.state).toBe('noReading')
  })

  it('is identical for inside and outside hammer modes', () => {
    for (const cents of [-40, -12, 0, 4, 12, 40]) {
      const outside = buildTunerPanel(
        deviationToGuidance(cents, cents / 2, -cents, 'outside'),
      )
      const inside = buildTunerPanel(
        deviationToGuidance(cents, cents / 2, -cents, 'inside'),
      )
      expect(inside).toEqual(outside)
    }
  })
})
