/**
 * Pitch class + octave number, e.g. 'D3', 'A4'. Sharps only (no flat
 * spellings) — a flat note like Bb is represented as its enharmonic
 * equivalent A#. This is a naming-convention choice, not a musical one.
 */
export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'
export type NoteName = `${PitchClass}${number}`

const PITCH_CLASS_SEMITONE: Record<PitchClass, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
}

const NOTE_NAME_PATTERN = /^([A-G]#?)(-?\d+)$/

function parseNoteName(note: NoteName): { pitchClass: PitchClass; octave: number } {
  const match = NOTE_NAME_PATTERN.exec(note)
  if (!match) {
    throw new Error(`Invalid note name: ${note}`)
  }
  return { pitchClass: match[1] as PitchClass, octave: Number(match[2]) }
}

/**
 * Converts a note to its frequency in Hz using standard 12-tone equal
 * temperament, relative to A4.
 *
 * `referencePitchHz` (the frequency of A4) is a required parameter and is
 * never defaulted internally — this repo has no confirmed source for what
 * reference pitch real handpans in this project should be tuned to (some
 * makers use 443Hz instead of 440Hz). See plan Open Item #1.
 */
export function noteToFrequency(note: NoteName, referencePitchHz: number): number {
  const { pitchClass, octave } = parseNoteName(note)
  const semitonesFromA4 = (octave - 4) * 12 + (PITCH_CLASS_SEMITONE[pitchClass] - PITCH_CLASS_SEMITONE.A)
  return referencePitchHz * Math.pow(2, semitonesFromA4 / 12)
}
