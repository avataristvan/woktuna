import { describe, expect, it } from 'vitest'
import { createFrequency } from '../domain/value-objects'
import { FftPartialDetector } from './partial-detector'

const SAMPLE_RATE = 48000
const FRAME_LENGTH = 32768

/**
 * Detuned 270 cents beyond the octave — per fft-peak-picking.spec.ts, this
 * sits just past the default (250-cent) tolerance's real cutoff but well
 * inside a 350-cent tolerance, so it's a reliable way to prove the option is
 * actually threaded through rather than silently ignored.
 */
function synthesizeDetunedOctaveFrame(f0: number): Float32Array {
  const detunedOctaveHz = f0 * 2 * Math.pow(2, 270 / 1200)
  const frame = new Float32Array(FRAME_LENGTH)
  for (let i = 0; i < FRAME_LENGTH; i++) {
    const t = i / SAMPLE_RATE
    frame[i] = Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * detunedOctaveHz * t)
  }
  return frame
}

describe('FftPartialDetector', () => {
  it('uses the default tolerance when none is configured, missing a partial detuned beyond it', () => {
    const detector = new FftPartialDetector()
    const frame = synthesizeDetunedOctaveFrame(220)

    const result = detector.detectPartials(frame, SAMPLE_RATE, createFrequency(220))

    expect(result.octave).toBeNull()
  })

  it('threads a constructor-supplied toleranceCents through to the underlying algorithm', () => {
    const detector = new FftPartialDetector(350)
    const frame = synthesizeDetunedOctaveFrame(220)

    const result = detector.detectPartials(frame, SAMPLE_RATE, createFrequency(220))

    expect(result.octave).not.toBeNull()
  })

  it('threads a runtime setToleranceCents change through to the next detectPartials call', () => {
    const detector = new FftPartialDetector()
    const frame = synthesizeDetunedOctaveFrame(220)

    expect(detector.detectPartials(frame, SAMPLE_RATE, createFrequency(220)).octave).toBeNull()

    detector.setToleranceCents(350)

    expect(detector.detectPartials(frame, SAMPLE_RATE, createFrequency(220)).octave).not.toBeNull()
  })
})
