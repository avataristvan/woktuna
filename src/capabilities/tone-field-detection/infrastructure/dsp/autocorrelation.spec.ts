import { describe, expect, it } from 'vitest'
import { detectPitchByAutocorrelation } from './autocorrelation'

const SAMPLE_RATE = 8000

/** Deterministic pseudo-random hash in [-1, 1] — no flaky Math.random(). */
function seededNoise(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453
  return 2 * (x - Math.floor(x)) - 1
}

function sineWave(frequencyHz: number, sampleRate: number, durationSeconds: number, noiseAmplitude = 0): Float32Array {
  const length = Math.floor(sampleRate * durationSeconds)
  const frame = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    frame[i] = Math.sin(2 * Math.PI * frequencyHz * t) + noiseAmplitude * seededNoise(i)
  }
  return frame
}

function centsOff(detectedHz: number, expectedHz: number): number {
  return 1200 * Math.log2(detectedHz / expectedHz)
}

describe('detectPitchByAutocorrelation', () => {
  it.each([110, 220, 440])('detects a pure %dHz sine within a few cents', (frequencyHz) => {
    const frame = sineWave(frequencyHz, SAMPLE_RATE, 0.5)

    const detected = detectPitchByAutocorrelation(frame, SAMPLE_RATE)

    expect(detected).not.toBeNull()
    expect(Math.abs(centsOff(detected as number, frequencyHz))).toBeLessThan(5)
  })

  it.each([110, 220, 440])('detects a %dHz sine with added noise within a few cents', (frequencyHz) => {
    const frame = sineWave(frequencyHz, SAMPLE_RATE, 0.5, 0.05)

    const detected = detectPitchByAutocorrelation(frame, SAMPLE_RATE)

    expect(detected).not.toBeNull()
    expect(Math.abs(centsOff(detected as number, frequencyHz))).toBeLessThan(10)
  })

  it('returns null for silence', () => {
    const frame = new Float32Array(4000)

    expect(detectPitchByAutocorrelation(frame, SAMPLE_RATE)).toBeNull()
  })

  it('returns null for noise with no periodicity', () => {
    const frame = new Float32Array(4000)
    for (let i = 0; i < frame.length; i++) {
      frame[i] = seededNoise(i)
    }

    expect(detectPitchByAutocorrelation(frame, SAMPLE_RATE)).toBeNull()
  })
})
