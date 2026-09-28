/**
 * Deliberate exception to "presentation is verified manually": this view has a
 * co-located jsdom spec (tuner-panel-view.spec.ts) because its DOM structure —
 * class names, data-* attributes, `--pos`, aria — is a contract that later
 * chunks and the CSS depend on.
 */
import type {
  MeterState,
  TunerPanelModel,
  TunerRow,
} from '../domain/partial-meter'
import { METER_RANGE_CENTS } from '../domain/partial-meter'

function noReadingRow(
  kind: TunerRow['kind'],
  title: TunerRow['title'],
): TunerRow {
  return {
    kind,
    title,
    meter: {
      state: 'noReading',
      position: 0,
      clamped: false,
      severity: null,
      signedText: '—',
      wordLabel: '—',
    },
  }
}

const NO_READING_ROWS: TunerPanelModel['rows'] = [
  noReadingRow('fundamental', 'Fundamental'),
  noReadingRow('octave', 'Octave (long axis)'),
  noReadingRow('compoundFifth', 'Fifth (short axis)'),
]

interface RowElements {
  row: HTMLElement
  title: HTMLElement
  meter: HTMLElement
  needle: HTMLElement
  value: HTMLElement
  word: HTMLElement
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function buildRow(): RowElements {
  const row = el('div', 'tuner-row')
  const title = el('div', 'tuner-row__title')
  const meter = el('div', 'tuner-row__meter')
  meter.setAttribute('role', 'meter')
  meter.setAttribute('aria-valuemin', String(-METER_RANGE_CENTS))
  meter.setAttribute('aria-valuemax', String(METER_RANGE_CENTS))
  const needle = el('div', 'tuner-row__needle')
  meter.append(
    el('div', 'tuner-row__zone'),
    needle,
    el('span', 'tuner-row__end tuner-row__end--low', 'low'),
    el('span', 'tuner-row__end tuner-row__end--high', 'high'),
  )
  const value = el('div', 'tuner-row__value')
  const word = el('div', 'tuner-row__word')
  row.append(title, meter, value, word)
  return { row, title, meter, needle, value, word }
}

function ariaValueText(
  title: string,
  state: MeterState,
  signedText: string,
  word: string,
): string {
  if (state === 'noReading') return `${title}: no reading`
  return `${title}: ${signedText.replace(' ¢', '')} cents, ${word}`
}

export class TunerPanelView {
  private readonly container: HTMLElement
  private readonly rows: readonly RowElements[]

  constructor(container: HTMLElement) {
    this.container = container
    container.classList.add('tuner-panel')
    this.rows = [buildRow(), buildRow(), buildRow()]
    container.replaceChildren(...this.rows.map((r) => r.row))
    this.render(null, { stale: false })
  }

  render(model: TunerPanelModel | null, opts: { stale: boolean }): void {
    this.container.dataset.stale = String(opts.stale)
    const modelRows = model?.rows ?? NO_READING_ROWS
    modelRows.forEach((data, i) => {
      const els = this.rows[i]
      const { meter } = data
      els.row.dataset.kind = data.kind
      els.row.dataset.state = meter.state
      els.row.dataset.severity = meter.severity ?? 'none'
      els.title.textContent = data.title
      els.value.textContent = meter.signedText
      els.word.textContent = meter.wordLabel
      els.needle.style.setProperty('--pos', String(meter.position))
      els.needle.dataset.clamped = String(meter.clamped)
      if (meter.state === 'noReading') {
        els.meter.removeAttribute('aria-valuenow')
      } else {
        const cents = Math.round(meter.position * METER_RANGE_CENTS)
        els.meter.setAttribute('aria-valuenow', String(cents))
      }
      els.meter.setAttribute(
        'aria-valuetext',
        ariaValueText(
          data.title,
          meter.state,
          meter.signedText,
          meter.wordLabel,
        ),
      )
    })
  }
}
