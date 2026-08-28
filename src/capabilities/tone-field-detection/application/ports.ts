import type { Frequency } from '../domain/value-objects'

/**
 * Dependency-inversion boundary for where raw audio samples come from — lets
 * infrastructure (live mic vs. a test fake) be swapped without touching the
 * use-case.
 */
export interface AudioFrameSource {
  getFrame(): Float32Array
  readonly sampleRate: number
}

/** Dependency-inversion boundary for fundamental-pitch detection. */
export interface PitchDetector {
  detectFundamental(frame: Float32Array, sampleRate: number): Frequency | null
}

export interface PartialDetectionResult {
  readonly octave: Frequency | null
  readonly compoundFifth: Frequency | null
}

/**
 * Dependency-inversion boundary for octave/compound-fifth detection,
 * separate from `PitchDetector` since it searches relative to an
 * already-detected fundamental rather than finding a pitch from scratch.
 */
export interface PartialDetector {
  detectPartials(frame: Float32Array, sampleRate: number, fundamental: Frequency): PartialDetectionResult
}

export interface SpectrumReading {
  readonly magnitudes: Float32Array
  readonly binToHz: (bin: number) => number
  readonly hzToBin: (hz: number) => number
}

/**
 * Dependency-inversion boundary for whole-spectrum analysis, as opposed to
 * `PartialDetector`'s band-limited peak search — for callers (a future
 * crosstalk display or spectrum/equalizer view) that need the full
 * magnitude spectrum rather than a specific partial's frequency.
 */
export interface SpectrumAnalyzer {
  analyzeSpectrum(frame: Float32Array, sampleRate: number): SpectrumReading
}
