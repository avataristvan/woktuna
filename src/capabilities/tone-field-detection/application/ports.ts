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
