import type { ToneFieldReading } from '../../tone-field-detection/domain/value-objects'
import { createFrequency } from '../../tone-field-detection/domain/value-objects'
import { centsBetween } from '../../tone-field-detection/domain/tuning-rules'
import { expectedPartialRatio } from '../../../shared-kernel/partial-kind'
import { deviationToGuidance } from '../domain/deviation-to-guidance'
import type { ToneFieldGuidance } from '../domain/guidance-model'
import type { HammerMode } from '../domain/hammer-direction'

/**
 * Composition-level use-case: resolves a struck tone field's fundamental,
 * octave, and compound-fifth partials against an externally-supplied
 * fundamental target frequency (from scale-configuration's
 * `nearestTargetFor`) and maps the resulting cent deviations to hammer
 * guidance. The octave/fifth targets aren't looked up separately — they're
 * derived from the fundamental's target via shared-kernel's expected ratios
 * (2x/3x), since a tone field's partials are expected to sit at fixed
 * ratios above its own fundamental, not independent scale notes.
 *
 * When `reading.octave`/`reading.compoundFifth` are absent (detector found
 * no clear peak — see fft-peak-picking.ts), the corresponding deviation is
 * `null`, not a fabricated zero — `deviationToGuidance` turns that into a
 * `null` axis guidance rather than a false "in tune" reading.
 *
 * This file is the one place allowed to depend on both tone-field-detection
 * and tone-field-visualization's domain surfaces — the two capabilities'
 * domains themselves stay decoupled from each other (see plan's capability
 * boundaries).
 */
export function buildGuidance(
  reading: ToneFieldReading,
  targetHz: number,
  hammerMode: HammerMode = 'outside',
): ToneFieldGuidance {
  const fundamentalDeviation = centsBetween(reading.fundamental.frequency, createFrequency(targetHz))

  const octaveDeviation = reading.octave
    ? centsBetween(reading.octave.frequency, createFrequency(targetHz * expectedPartialRatio('octave')))
    : null

  const compoundFifthDeviation = reading.compoundFifth
    ? centsBetween(
        reading.compoundFifth.frequency,
        createFrequency(targetHz * expectedPartialRatio('compoundFifth')),
      )
    : null

  return deviationToGuidance(fundamentalDeviation, octaveDeviation, compoundFifthDeviation, hammerMode)
}
