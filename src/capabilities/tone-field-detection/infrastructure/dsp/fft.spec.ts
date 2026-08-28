import { describe, expect, it } from 'vitest'
import { computeMagnitudeSpectrum } from './fft'

const SAMPLE_RATE = 48000
const FRAME_LENGTH = 4096

function synthesizeSine(freqHz: number, amplitude = 1): Float32Array {
  const frame = new Float32Array(FRAME_LENGTH)
  for (let i = 0; i < FRAME_LENGTH; i++) {
    frame[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE)
  }
  return frame
}

describe('computeMagnitudeSpectrum', () => {
  it('produces a clear peak at the bin closest to a known single frequency', () => {
    const freqHz = 440
    const frame = synthesizeSine(freqHz)

    const { magnitudes, hzToBin } = computeMagnitudeSpectrum(frame, SAMPLE_RATE)

    let peakBin = 0
    let peakMag = magnitudes[0]
    for (let bin = 1; bin < magnitudes.length; bin++) {
      if (magnitudes[bin] > peakMag) {
        peakMag = magnitudes[bin]
        peakBin = bin
      }
    }

    const expectedBin = Math.round(hzToBin(freqHz))
    expect(peakBin).toBe(expectedBin)

    // The peak should tower over the rest of the spectrum, not just be the
    // biggest of many comparable bins.
    const otherBinsMax = Math.max(...Array.from(magnitudes).filter((_, bin) => Math.abs(bin - peakBin) > 2))
    expect(peakMag).toBeGreaterThan(otherBinsMax * 5)
  })

  it('round-trips binToHz and hzToBin', () => {
    const frame = synthesizeSine(220)
    const { binToHz, hzToBin } = computeMagnitudeSpectrum(frame, SAMPLE_RATE)

    const bin = 37
    expect(hzToBin(binToHz(bin))).toBeCloseTo(bin, 9)

    const hz = 880
    expect(binToHz(hzToBin(hz))).toBeCloseTo(hz, 9)
  })

  it('defaults fftSize to the largest power of two that fits the frame', () => {
    const frame = synthesizeSine(220)
    const { magnitudes } = computeMagnitudeSpectrum(frame, SAMPLE_RATE)

    // FRAME_LENGTH (4096) is already a power of two, so the spectrum should
    // have fftSize/2 + 1 bins.
    expect(magnitudes.length).toBe(FRAME_LENGTH / 2 + 1)
  })

  it('honors an explicit fftSize smaller than the frame', () => {
    const frame = synthesizeSine(220)
    const fftSize = 2048
    const { magnitudes } = computeMagnitudeSpectrum(frame, SAMPLE_RATE, fftSize)

    expect(magnitudes.length).toBe(fftSize / 2 + 1)
  })
})
