import type { ToneFieldReading } from '../../tone-field-detection/domain/value-objects'
import { createFrequency } from '../../tone-field-detection/domain/value-objects'
import { centsBetween } from '../../tone-field-detection/domain/tuning-rules'
import { deviationToGuidance } from '../domain/deviation-to-guidance'
import type { ToneFieldGuidance } from '../domain/guidance-model'

/**
 * Composition-level use-case: resolves a struck tone field's fundamental
 * against an externally-supplied target frequency (from
 * scale-configuration's `nearestTargetFor`) and maps the resulting cent
 * deviation to hammer guidance.
 *
 * This file is the one place allowed to depend on both tone-field-detection
 * and tone-field-visualization's domain surfaces — the two capabilities'
 * domains themselves stay decoupled from each other (see plan's capability
 * boundaries).
 */
export function buildGuidance(reading: ToneFieldReading, targetHz: number): ToneFieldGuidance {
  const deviation = centsBetween(reading.fundamental.frequency, createFrequency(targetHz))
  return deviationToGuidance(deviation)
}
