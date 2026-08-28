import type { Severity } from './guidance-model'

/**
 * Which side of the shell the player is hammering from.
 * `'outside'` — the playing side (standard technique). `'inside'` — through
 * the Gu (sound hole), typically used for fine-tuning corrections.
 */
export type HammerMode = 'outside' | 'inside'

/**
 * Resolves whether a strike should be biased toward the tone field's center
 * or edge, given the fundamental's cent deviation and which side of the
 * shell is being hammered from.
 *
 * Per research doc §2.2: hammering the center from the OUTSIDE raises
 * pitch, hammering the edge lowers it — so a flat (too-low) fundamental
 * needs a center-biased hit, a sharp one an edge-biased hit. That's the
 * `'outside'` branch, and it's the only behavior that existed before this
 * function was introduced.
 *
 * Per research doc §2.3, hammering from the INSIDE (through the Gu) is
 * claimed to reverse that relationship — center/edge bias inverted, same
 * severity/inTune handling.
 *
 * TODO/UNVERIFIED: the inside-hammering inversion is inferred from a single
 * secondary source (handpan.ca/making-your-own-hanpan, quoted via
 * yishama.com — see research doc §2.3's source list) and is not
 * cross-confirmed by any other source. Treat the `'inside'` branch as a
 * best guess, not settled fact, until it's validated against real tuning
 * practice. This function exists specifically so that correction can
 * happen here, isolated, without touching rendering or use-case code.
 */
export function resolveHammerBias(
  centDeviation: number,
  severity: Severity,
  mode: HammerMode,
): 'center' | 'edge' | 'inTune' {
  if (severity === 'inTune') return 'inTune'

  const outsideBias = centDeviation < 0 ? 'center' : 'edge'
  if (mode === 'outside') return outsideBias
  return outsideBias === 'center' ? 'edge' : 'center'
}
