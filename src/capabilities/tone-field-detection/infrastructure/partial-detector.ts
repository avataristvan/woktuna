import type { Frequency } from '../domain/value-objects'
import { createFrequency } from '../domain/value-objects'
import type { PartialDetectionResult, PartialDetector } from '../application/ports'
import { detectPartialsByFftPeakPicking } from './dsp/fft-peak-picking'

/**
 * Thin adapter binding the `PartialDetector` port to the FFT peak-picking DSP
 * algorithm. `toleranceCents` is mutable at runtime (not just constructor
 * config) because the app already has a live mic session running by the time
 * a user might adjust it via the UI — see `setToleranceCents`.
 */
export class FftPartialDetector implements PartialDetector {
  private toleranceCents: number | undefined

  constructor(toleranceCents?: number) {
    this.toleranceCents = toleranceCents
  }

  setToleranceCents(cents: number): void {
    this.toleranceCents = cents
  }

  detectPartials(frame: Float32Array, sampleRate: number, fundamental: Frequency): PartialDetectionResult {
    const { octaveHz, compoundFifthHz } = detectPartialsByFftPeakPicking(frame, sampleRate, fundamental, {
      toleranceCents: this.toleranceCents,
    })
    return {
      octave: octaveHz === null ? null : createFrequency(octaveHz),
      compoundFifth: compoundFifthHz === null ? null : createFrequency(compoundFifthHz),
    }
  }
}
