import type { PartialKind } from '../../../shared-kernel/partial-kind'
import { axisForPartial } from '../../../shared-kernel/partial-kind'
import { centDeviationToSeverity } from './deviation-to-guidance'
import type {
  AxisGuidance,
  Severity,
  ToneFieldGuidance,
} from './guidance-model'

export const METER_RANGE_CENTS = 50

export type MeterState = 'noReading' | 'low' | 'high' | 'inTune'

export interface PartialMeter {
  state: MeterState
  /** clamp(cents / METER_RANGE_CENTS, -1, 1) from the raw deviation; 0 for noReading. */
  position: number
  /** True when |cents| exceeds METER_RANGE_CENTS (position is pinned to an end). */
  clamped: boolean
  severity: Severity | null
  signedText: string
  wordLabel: 'too high' | 'too low' | 'in tune' | '—'
}

/**
 * Direction depends only on the cent sign and severity — never on hammer
 * bias/mode: the meter reports how the pitch deviates, not how to hammer.
 */
export function deviationDirection(
  centDeviation: number,
  severity: Severity,
): 'low' | 'high' | 'inTune' {
  if (severity === 'inTune') return 'inTune'
  return centDeviation < 0 ? 'low' : 'high'
}

function formatSignedCents(centDeviation: number): string {
  const rounded = Math.round(centDeviation)
  if (rounded === 0) return '0 ¢'
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded)} ¢`
}

const WORD_LABELS = {
  low: 'too low',
  high: 'too high',
  inTune: 'in tune',
} as const

/** `null`/`NaN` mean "no reading" — never a fabricated in-tune meter. */
export function toPartialMeter(
  centDeviation: number | null,
  severity?: Severity,
): PartialMeter {
  if (centDeviation === null || Number.isNaN(centDeviation)) {
    return {
      state: 'noReading',
      position: 0,
      clamped: false,
      severity: null,
      signedText: '—',
      wordLabel: '—',
    }
  }
  const resolvedSeverity = severity ?? centDeviationToSeverity(centDeviation)
  const state = deviationDirection(centDeviation, resolvedSeverity)
  return {
    state,
    position: Math.max(-1, Math.min(1, centDeviation / METER_RANGE_CENTS)),
    clamped: Math.abs(centDeviation) > METER_RANGE_CENTS,
    severity: resolvedSeverity,
    signedText: formatSignedCents(centDeviation),
    wordLabel: WORD_LABELS[state],
  }
}

export interface TunerRow {
  kind: PartialKind
  title: 'Fundamental' | 'Octave (long axis)' | 'Fifth (short axis)'
  meter: PartialMeter
}

export interface TunerPanelModel {
  rows: readonly [TunerRow, TunerRow, TunerRow]
}

function axisMeter(
  guidance: ToneFieldGuidance,
  kind: 'octave' | 'compoundFifth',
): PartialMeter {
  const reading: AxisGuidance | null =
    axisForPartial(kind) === 'long' ? guidance.longAxis : guidance.shortAxis
  return reading === null
    ? toPartialMeter(null)
    : toPartialMeter(reading.centDeviation, reading.severity)
}

export function buildTunerPanel(guidance: ToneFieldGuidance): TunerPanelModel {
  return {
    rows: [
      {
        kind: 'fundamental',
        title: 'Fundamental',
        meter: toPartialMeter(
          guidance.radial.centDeviation,
          guidance.radial.severity,
        ),
      },
      {
        kind: 'octave',
        title: 'Octave (long axis)',
        meter: axisMeter(guidance, 'octave'),
      },
      {
        kind: 'compoundFifth',
        title: 'Fifth (short axis)',
        meter: axisMeter(guidance, 'compoundFifth'),
      },
    ],
  }
}
