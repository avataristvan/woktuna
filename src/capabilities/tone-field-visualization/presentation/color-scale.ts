import type { Severity } from '../domain/guidance-model'

/**
 * Maps a deviation severity to a display color. Pure function, no DOM —
 * lives in `presentation/` (not `domain/`) purely because "color" is a
 * presentation concern, not because it touches the page.
 */
const SEVERITY_COLORS: Record<Severity, string> = {
  inTune: '#2ecc71',
  slight: '#f1c40f',
  moderate: '#e67e22',
  significant: '#e74c3c',
}

export function severityToColor(severity: Severity): string {
  return SEVERITY_COLORS[severity]
}
