import { describe, expect, it } from 'vitest'
import { BAR_COUNT, MAX_FREQUENCY_HZ, MIN_FREQUENCY_HZ, barsFromSpectrum } from './spectrum-to-bars'
import type { SpectrumMagnitudes } from './spectrum-to-bars'

const SAMPLE_RATE = 44100
const FFT_SIZE = 4096
const BIN_HZ = SAMPLE_RATE / FFT_SIZE

function makeSpectrum(magnitudes: Float32Array): SpectrumMagnitudes {
  return {
    magnitudes,
    binToHz: (bin) => bin * BIN_HZ,
    hzToBin: (hz) => hz / BIN_HZ,
  }
}

function silentSpectrum(binCount = FFT_SIZE / 2): SpectrumMagnitudes {
  return makeSpectrum(new Float32Array(binCount))
}

describe('barsFromSpectrum', () => {
  it('produces BAR_COUNT bars spanning MIN_FREQUENCY_HZ to MAX_FREQUENCY_HZ', () => {
    const bars = barsFromSpectrum(silentSpectrum())

    expect(bars).toHaveLength(BAR_COUNT)
    expect(bars[0].frequencyHz).toBeGreaterThanOrEqual(MIN_FREQUENCY_HZ)
    expect(bars[bars.length - 1].frequencyHz).toBeLessThanOrEqual(MAX_FREQUENCY_HZ)
  })

  it('orders bar frequencies strictly ascending (log-spaced bands)', () => {
    const bars = barsFromSpectrum(silentSpectrum())

    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].frequencyHz).toBeGreaterThan(bars[i - 1].frequencyHz)
    }
  })

  it('normalizes an all-silent frame to all-zero bars without NaN', () => {
    const bars = barsFromSpectrum(silentSpectrum())

    for (const bar of bars) {
      expect(bar.magnitude).toBe(0)
      expect(bar.normalizedHeight).toBe(0)
    }
  })

  it('normalizes the loudest bar in the frame to 1.0', () => {
    const magnitudes = new Float32Array(FFT_SIZE / 2)
    const peakBin = Math.round(440 / BIN_HZ)
    magnitudes[peakBin] = 5

    const bars = barsFromSpectrum(makeSpectrum(magnitudes))
    const maxHeight = Math.max(...bars.map((bar) => bar.normalizedHeight))

    expect(maxHeight).toBeCloseTo(1, 6)
    for (const bar of bars) {
      expect(bar.normalizedHeight).toBeGreaterThanOrEqual(0)
      expect(bar.normalizedHeight).toBeLessThanOrEqual(1)
    }
  })

  it('places a strong peak near its true frequency in the resulting bars', () => {
    const magnitudes = new Float32Array(FFT_SIZE / 2)
    const peakBin = Math.round(440 / BIN_HZ)
    magnitudes[peakBin] = 5

    const bars = barsFromSpectrum(makeSpectrum(magnitudes))
    const loudestBar = bars.reduce((max, bar) => (bar.magnitude > max.magnitude ? bar : max))

    expect(loudestBar.frequencyHz).toBeGreaterThan(300)
    expect(loudestBar.frequencyHz).toBeLessThan(600)
  })

  it('keeps a second, quieter peak visible rather than flattened by averaging', () => {
    const magnitudes = new Float32Array(FFT_SIZE / 2)
    magnitudes[Math.round(220 / BIN_HZ)] = 10
    magnitudes[Math.round(880 / BIN_HZ)] = 2

    const bars = barsFromSpectrum(makeSpectrum(magnitudes))
    const quietPeakBar = bars.find(
      (bar) => bar.frequencyHz > 700 && bar.frequencyHz < 1000 && bar.magnitude > 0,
    )

    expect(quietPeakBar).toBeDefined()
  })
})
