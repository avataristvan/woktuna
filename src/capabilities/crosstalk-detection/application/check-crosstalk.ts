import type { SpectrumAnalyzer } from '../../tone-field-detection/application/ports'
import type { Scale } from '../../scale-configuration/domain/scale'
import { noteToFrequency } from '../../scale-configuration/domain/note'
import type { CrosstalkWarning } from '../domain/crosstalk-warning'
import { detectCrosstalk } from '../domain/detect-crosstalk'

/**
 * Search-band half-width, in cents, used when checking a scale target's own
 * frequency for crosstalk energy. Deliberately tighter than
 * `fft-peak-picking.ts`'s ±250-cent partial-search tolerance — this checks
 * each scale note's own fixed equal-temperament target, not a partial that
 * may be significantly detuned from its expected ratio, so a wide band
 * would just make the heuristic noisier (more likely to catch a
 * neighboring target's own leakage instead of the target being checked).
 */
const DEFAULT_TOLERANCE_CENTS = 50

/**
 * Use case: given a live audio frame and the active `Scale`, flags any
 * scale note (other than the one currently being tuned) whose target
 * frequency shows suspicious spectral energy — see `detectCrosstalk` for
 * the heuristic and its explicit hedging (handpan-stimm-app-recherche.md
 * §2.5's unresolved crosstalk-axis question).
 *
 * Combines the `SpectrumAnalyzer` port (dependency-inversion boundary from
 * `tone-field-detection`, read-only usage per this capability's scope)
 * with `scale-configuration`'s `noteToFrequency` to resolve the active
 * scale's note names to target Hz values, then enriches the pure domain
 * result with the note identity — `detectCrosstalk` itself only knows Hz.
 */
export class CheckCrosstalk {
  private readonly spectrumAnalyzer: SpectrumAnalyzer
  private readonly toleranceCents: number

  constructor(spectrumAnalyzer: SpectrumAnalyzer, toleranceCents: number = DEFAULT_TOLERANCE_CENTS) {
    this.spectrumAnalyzer = spectrumAnalyzer
    this.toleranceCents = toleranceCents
  }

  check(frame: Float32Array, sampleRate: number, currentFundamentalHz: number, scale: Scale, referencePitchHz: number): CrosstalkWarning[] {
    const spectrum = this.spectrumAnalyzer.analyzeSpectrum(frame, sampleRate)

    const targetHzByNote = new Map(scale.notes.map((note) => [noteToFrequency(note, referencePitchHz), note]))
    const allTargetHz = [...targetHzByNote.keys()]

    const warnings = detectCrosstalk(spectrum, currentFundamentalHz, allTargetHz, this.toleranceCents)

    return warnings.map((warning) => ({
      ...warning,
      // Every targetHz here was sourced from targetHzByNote's own keys
      // (detectCrosstalk only ever echoes back values from the array it
      // was given), so the lookup always succeeds.
      suspectedNote: targetHzByNote.get(warning.targetHz),
    }))
  }
}
