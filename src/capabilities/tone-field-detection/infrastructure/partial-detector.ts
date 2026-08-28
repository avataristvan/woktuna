import type { Frequency } from '../domain/value-objects'
import { createFrequency } from '../domain/value-objects'
import type { PartialDetectionResult, PartialDetector } from '../application/ports'
import { detectPartialsByFftPeakPicking } from './dsp/fft-peak-picking'

/** Thin adapter binding the `PartialDetector` port to the FFT peak-picking DSP algorithm. */
export class FftPartialDetector implements PartialDetector {
  detectPartials(frame: Float32Array, sampleRate: number, fundamental: Frequency): PartialDetectionResult {
    const { octaveHz, compoundFifthHz } = detectPartialsByFftPeakPicking(frame, sampleRate, fundamental)
    return {
      octave: octaveHz === null ? null : createFrequency(octaveHz),
      compoundFifth: compoundFifthHz === null ? null : createFrequency(compoundFifthHz),
    }
  }
}
