import type { SpectrumAnalyzer, SpectrumReading } from '../application/ports'
import { computeMagnitudeSpectrum } from './dsp/fft'

/** Thin adapter binding the `SpectrumAnalyzer` port to the shared FFT magnitude-spectrum computation. */
export class FftSpectrumAnalyzer implements SpectrumAnalyzer {
  analyzeSpectrum(frame: Float32Array, sampleRate: number): SpectrumReading {
    return computeMagnitudeSpectrum(frame, sampleRate)
  }
}
