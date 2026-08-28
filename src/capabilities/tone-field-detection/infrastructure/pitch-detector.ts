import type { Frequency } from '../domain/value-objects'
import { createFrequency } from '../domain/value-objects'
import type { PitchDetector } from '../application/ports'
import { detectPitchByAutocorrelation } from './dsp/autocorrelation'

/** Thin adapter binding the `PitchDetector` port to the autocorrelation DSP algorithm. */
export class AutocorrelationPitchDetector implements PitchDetector {
  detectFundamental(frame: Float32Array, sampleRate: number): Frequency | null {
    const hz = detectPitchByAutocorrelation(frame, sampleRate)
    return hz === null ? null : createFrequency(hz)
  }
}
