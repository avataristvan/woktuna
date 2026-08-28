import { describe, expect, it } from 'vitest'
import { StrikeCollector } from './strike-collector'

describe('StrikeCollector', () => {
  it('starts with no collected frequencies', () => {
    const collector = new StrikeCollector()

    expect(collector.getCollectedFrequencies()).toEqual([])
  })

  it('records the first reading unconditionally', () => {
    const collector = new StrikeCollector()

    collector.recordReading(220)

    expect(collector.getCollectedFrequencies()).toEqual([220])
  })

  it('collapses near-identical repeated readings of the same ringing note', () => {
    const collector = new StrikeCollector()

    collector.recordReading(220)
    collector.recordReading(220.5)
    collector.recordReading(219.7)
    collector.recordReading(220.2)

    expect(collector.getCollectedFrequencies()).toEqual([220])
  })

  it('records a new strike once the reading is more than ~a semitone from the last recorded one', () => {
    const collector = new StrikeCollector()
    const wellAboveThresholdHz = 220 * Math.pow(2, 105 / 1200)

    collector.recordReading(220)
    collector.recordReading(wellAboveThresholdHz)

    expect(collector.getCollectedFrequencies()).toEqual([220, wellAboveThresholdHz])
  })

  it('does not record a strike within the dedup threshold, even just under it', () => {
    const collector = new StrikeCollector()
    const justUnderThresholdHz = 220 * Math.pow(2, 99 / 1200)

    collector.recordReading(220)
    collector.recordReading(justUnderThresholdHz)

    expect(collector.getCollectedFrequencies()).toEqual([220])
  })

  it('compares each new reading against the last recorded strike, not the raw previous reading', () => {
    const collector = new StrikeCollector()
    const wellAboveThresholdHz = 220 * Math.pow(2, 105 / 1200)

    collector.recordReading(220) // recorded: A3
    collector.recordReading(220.5) // within threshold of 220 -> not recorded
    collector.recordReading(wellAboveThresholdHz) // well above threshold from the *recorded* 220, not the raw 220.5 -> recorded

    expect(collector.getCollectedFrequencies()).toEqual([220, wellAboveThresholdHz])
  })
})
