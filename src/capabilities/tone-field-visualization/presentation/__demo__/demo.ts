import { deviationToGuidance } from '../../domain/deviation-to-guidance'
import type { ToneFieldGuidance } from '../../domain/guidance-model'
import { CanvasToneFieldRenderer } from '../canvas-tone-field-renderer'

/**
 * Manual/browser-only verification page for this chunk — not part of the
 * production app (that wiring happens in a later chunk). Feeds hardcoded
 * sample data into the renderer so DPI handling, radial zone, and axis
 * markers can be visually inspected. Everything referenced here stays
 * inside `tone-field-visualization/` so it can't conflict with other
 * in-flight chunks.
 */

const samples: Array<{ label: string; guidance: ToneFieldGuidance }> = [
  { label: 'in tune (0 cents)', guidance: deviationToGuidance(0) },
  { label: 'flat, slight (-10 cents) → center bias', guidance: deviationToGuidance(-10) },
  { label: 'sharp, moderate (+20 cents) → edge bias', guidance: deviationToGuidance(20) },
  { label: 'sharp, extreme (+45 cents) → edge bias', guidance: deviationToGuidance(45) },
  {
    label: 'with axis markers (hardcoded — real detection lands later)',
    guidance: {
      ...deviationToGuidance(-8),
      longAxis: { axis: 'long', centDeviation: 12, severity: 'slight' },
      shortAxis: { axis: 'short', centDeviation: -28, severity: 'significant' },
    },
  },
]

const grid = document.querySelector<HTMLDivElement>('#grid')!

for (const { label, guidance } of samples) {
  const figure = document.createElement('figure')
  const caption = document.createElement('figcaption')
  caption.textContent = label
  const canvas = document.createElement('canvas')

  figure.append(caption, canvas)
  grid.append(figure)

  const renderer = new CanvasToneFieldRenderer(canvas)
  renderer.render(guidance)
}
