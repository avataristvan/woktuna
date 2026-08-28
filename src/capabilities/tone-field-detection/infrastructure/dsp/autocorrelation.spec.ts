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

  it('rejects low-frequency rumble instead of reporting it as the pitch', () => {
    const length = Math.floor(SAMPLE_RATE * 0.5)
    const frame = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE
      // Mic-handling-noise-style rumble well below any handpan fundamental,
      // added on top of a clean tone — should not pull the detected pitch
      // toward the rumble frequency.
      frame[i] = Math.sin(2 * Math.PI * 440 * t) + 0.6 * Math.sin(2 * Math.PI * 20 * t)
    }

    const detected = detectPitchByAutocorrelation(frame, SAMPLE_RATE)

    expect(detected).not.toBeNull()
    expect(Math.abs(centsOff(detected as number, 440))).toBeLessThan(10)
  })

  it('detects the fundamental of a multi-partial handpan-like signal, not the octave', () => {
    const f0 = 220
    const frame = sineWave(f0, SAMPLE_RATE, 0.5)
    for (let i = 0; i < frame.length; i++) {
      const t = i / SAMPLE_RATE
      // Research doc §2.1: fundamental + octave + compound fifth ring
      // together on a struck tone field.
      frame[i] += 0.5 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.3 * Math.sin(2 * Math.PI * 3 * f0 * t)
    }

    const detected = detectPitchByAutocorrelation(frame, SAMPLE_RATE)

    expect(detected).not.toBeNull()
    expect(Math.abs(centsOff(detected as number, f0))).toBeLessThan(5)
  })

  it('stays within a rAF-safe time budget for a realistic frame size', () => {
    const sampleRate = 44100
    // Matches the full AnalyserNode frame length (see DEFAULT_FFT_SIZE in
    // web-audio-microphone-source.ts) — the correlation window itself must
    // stay capped regardless of how large this input frame is.
    const frame = sineWave(220, sampleRate, 32768 / sampleRate)

    const start = performance.now()
    detectPitchByAutocorrelation(frame, sampleRate)
    const elapsedMs = performance.now() - start

    // Generous budget for a test environment (browser main thread has a
    // 16.7ms rAF budget); this is here to catch a regression back to
    // O(frameLength × lagRange), which measured ~158ms on this frame size.
    expect(elapsedMs).toBeLessThan(50)
  })
})
