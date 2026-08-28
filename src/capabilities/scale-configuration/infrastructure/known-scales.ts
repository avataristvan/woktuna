import type { Scale } from '../domain/scale'

/**
 * PLACEHOLDER / UNVERIFIED DATA — plan Open Item #2.
 *
 * These scale definitions are commonly-cited handpan scale *names* and note
 * sequences, typed in from general knowledge, not from a source this repo
 * has confirmed. Two things about them are unverified:
 *
 *   1. The exact octave assignments per note (which octave each scale
 *      degree belongs to on a real instrument can vary by maker/model).
 *   2. The resulting frequencies depend entirely on the reference-pitch
 *      question in plan Open Item #1 (440Hz vs 443Hz vs other) — nothing
 *      here should be read as an authoritative frequency table.
 *
 * Do not rely on this data for actual tuning without the user verifying it
 * against a source they trust.
 */
export const KNOWN_SCALES: Scale[] = [
  {
    name: 'D Kurd',
    notes: ['D3', 'A3', 'A#3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
  },
  {
    name: 'D Amara (Celtic Minor)',
    notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
  },
  {
    name: 'C Pygmy',
    notes: ['C3', 'G3', 'A#3', 'C4', 'D4', 'F4', 'G4', 'A#4'],
  },
]
