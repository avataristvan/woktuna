import { describe, expect, it } from 'vitest'
import type { TunerPanelModel } from '../domain/partial-meter'
import { toPartialMeter } from '../domain/partial-meter'
import { TunerPanelView } from './tuner-panel-view'

function model(
  fundamental: number | null,
  octave: number | null,
  fifth: number | null,
): TunerPanelModel {
  return {
    rows: [
      {
        kind: 'fundamental',
        title: 'Fundamental',
        meter: toPartialMeter(fundamental),
      },
      {
        kind: 'octave',
        title: 'Octave (long axis)',
        meter: toPartialMeter(octave),
      },
      {
        kind: 'compoundFifth',
        title: 'Fifth (short axis)',
        meter: toPartialMeter(fifth),
      },
    ],
  }
}

function setup() {
  const container = document.createElement('div')
  const view = new TunerPanelView(container)
  const rows = () => [...container.querySelectorAll<HTMLElement>('.tuner-row')]
  return { container, view, rows }
}

const text = (row: HTMLElement, sel: string) =>
  row.querySelector(sel)?.textContent

describe('TunerPanelView', () => {
  it('renders three noReading rows for a null model', () => {
    const { container, rows } = setup()
    expect(container.classList.contains('tuner-panel')).toBe(true)
    expect(container.dataset.stale).toBe('false')
    expect(rows().map((r) => r.dataset.kind)).toEqual([
      'fundamental',
      'octave',
      'compoundFifth',
    ])
    expect(rows().map((r) => text(r, '.tuner-row__title'))).toEqual([
      'Fundamental',
      'Octave (long axis)',
      'Fifth (short axis)',
    ])
    for (const r of rows()) {
      expect(r.dataset.state).toBe('noReading')
      expect(r.dataset.severity).toBe('none')
      expect(text(r, '.tuner-row__value')).toBe('—')
      expect(text(r, '.tuner-row__word')).toBe('—')
      const needle = r.querySelector<HTMLElement>('.tuner-row__needle')!
      expect(needle.style.getPropertyValue('--pos')).toBe('0')
      expect(
        r.querySelector('.tuner-row__meter')!.hasAttribute('aria-valuenow'),
      ).toBe(false)
    }
  })

  it('renders low, high and inTune rows with matching attributes and texts', () => {
    const { view, rows } = setup()
    view.render(model(-30, 12, 1), { stale: false })
    const [low, high, inTune] = rows()

    expect(low.dataset.state).toBe('low')
    expect(low.dataset.severity).not.toBe('none')
    expect(text(low, '.tuner-row__value')).toBe('-30 ¢')
    expect(text(low, '.tuner-row__word')).toBe('too low')
    expect(
      low
        .querySelector<HTMLElement>('.tuner-row__needle')!
        .style.getPropertyValue('--pos'),
    ).toBe('-0.6')

    expect(high.dataset.state).toBe('high')
    expect(text(high, '.tuner-row__value')).toBe('+12 ¢')
    expect(text(high, '.tuner-row__word')).toBe('too high')
    const highMeter = high.querySelector('.tuner-row__meter')!
    expect(highMeter.getAttribute('role')).toBe('meter')
    expect(highMeter.getAttribute('aria-valuemin')).toBe('-50')
    expect(highMeter.getAttribute('aria-valuemax')).toBe('50')
    expect(highMeter.getAttribute('aria-valuenow')).toBe('12')
    expect(highMeter.getAttribute('aria-valuetext')).toBe(
      'Octave (long axis): +12 cents, too high',
    )

    expect(inTune.dataset.state).toBe('inTune')
    expect(inTune.dataset.severity).toBe('inTune')
    expect(text(inTune, '.tuner-row__word')).toBe('in tune')

    expect(low.querySelector('.tuner-row__zone')).not.toBeNull()
    expect(text(low, '.tuner-row__end--low')).toBe('low')
    expect(text(low, '.tuner-row__end--high')).toBe('high')
  })

  it('clamps aria-valuenow and flags the needle for out-of-range deviations', () => {
    const { view, rows } = setup()
    view.render(model(80, null, null), { stale: false })
    const [first] = rows()
    expect(
      first.querySelector('.tuner-row__meter')!.getAttribute('aria-valuenow'),
    ).toBe('50')
    const needle = first.querySelector<HTMLElement>('.tuner-row__needle')!
    expect(needle.dataset.clamped).toBe('true')
    expect(needle.style.getPropertyValue('--pos')).toBe('1')
  })

  it('shows a dash and no aria-valuenow for a null axis', () => {
    const { view, rows } = setup()
    view.render(model(5, null, 20), { stale: false })
    const octave = rows()[1]
    expect(octave.dataset.state).toBe('noReading')
    expect(text(octave, '.tuner-row__value')).toBe('—')
    const meter = octave.querySelector('.tuner-row__meter')!
    expect(meter.hasAttribute('aria-valuenow')).toBe(false)
    expect(meter.getAttribute('aria-valuetext')).toBe(
      'Octave (long axis): no reading',
    )
  })

  it('toggles data-stale', () => {
    const { container, view } = setup()
    view.render(model(0, 0, 0), { stale: true })
    expect(container.dataset.stale).toBe('true')
    view.render(model(0, 0, 0), { stale: false })
    expect(container.dataset.stale).toBe('false')
  })

  it('reuses the same DOM nodes across renders', () => {
    const { view, rows } = setup()
    const before = rows()
    const needleBefore = before[0].querySelector('.tuner-row__needle')
    view.render(model(-20, 10, 30), { stale: false })
    view.render(null, { stale: true })
    const after = rows()
    expect(after).toHaveLength(3)
    after.forEach((r, i) => expect(r).toBe(before[i]))
    expect(after[0].querySelector('.tuner-row__needle')).toBe(needleBefore)
  })
})
