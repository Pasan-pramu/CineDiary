import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { isOneCharacter } from '../../../shared/validation'
import { logError, showToast, userMessage } from '../errors'
import { refreshMoods, useMoods, useReasons } from '../hooks/useMoods'
import InlineAddForm from './InlineAddForm'
import SectionPanel from './SectionPanel'

// Settings → Moods & reasons: add, rename, change emoji, reorder, hide/unhide.
// Anything a watch uses can only be hidden; unused custom ones can be deleted.

/** Runs a change, reloads the lists everywhere, and toasts if it failed. */
async function change(action: () => Promise<unknown>, what: string): Promise<void> {
  try {
    await action()
  } catch (error) {
    logError('renderer', error)
    showToast(`Couldn’t ${what}. ${userMessage(error)}`)
  }
  await refreshMoods().catch(() => undefined)
}

/** The ids in a new order, with the item at `index` moved one step up or down. */
function moved(ids: number[], index: number, step: -1 | 1): number[] {
  const next = [...ids]
  const target = index + step
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

interface Item {
  id: number
  label: string
  emoji?: string
  isCustom: boolean
  isHidden: boolean
  uses: number
}

interface RowProps {
  item: Item
  index: number
  count: number
  kind: 'mood' | 'reason'
  onSave: (input: { label: string; emoji: string }) => void
  onMove: (step: -1 | 1) => void
  onHide: (hidden: boolean) => void
  onDelete: () => void
}

function Row({
  item,
  index,
  count,
  kind,
  onSave,
  onMove,
  onHide,
  onDelete
}: RowProps): React.JSX.Element {
  // Drafts start from the saved values (the row remounts when they change).
  const [label, setLabel] = useState(item.label)
  const [emoji, setEmoji] = useState(item.emoji ?? '')
  const save = (): void => {
    const name = label.trim()
    const icon = emoji.trim()
    if (name === item.label && icon === (item.emoji ?? '')) return
    if (!name || (kind === 'mood' && !isOneCharacter(icon))) {
      showToast(kind === 'mood' ? 'A mood needs a name and one emoji.' : 'A reason needs a name.')
      setLabel(item.label)
      setEmoji(item.emoji ?? '')
      return
    }
    onSave({ label: name, emoji: icon })
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }
  const name = item.label
  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] p-2 ${
        item.isHidden ? 'bg-[var(--color-panel-elevated)]' : ''
      }`}
    >
      {kind === 'mood' ? (
        <input
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
          aria-label={`Emoji for ${name}`}
          className="field h-9 w-14 text-center text-lg"
        />
      ) : null}
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        maxLength={40}
        aria-label={`Name of ${name}`}
        className={`field h-9 min-w-40 flex-1 ${item.isHidden ? 'text-[var(--color-text-muted)]' : ''}`}
      />
      <span className="w-36 text-xs text-[var(--color-text-muted)]">
        {item.isHidden ? 'Hidden · ' : ''}
        {item.uses
          ? `${item.uses.toLocaleString()} ${item.uses === 1 ? 'watch' : 'watches'}`
          : 'Not used'}
      </span>
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label={`Move ${name} up`}
        title="Move up"
        className="btn btn-ghost btn-icon btn-sm"
      >
        <ArrowUp size={15} />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === count - 1}
        aria-label={`Move ${name} down`}
        title="Move down"
        className="btn btn-ghost btn-icon btn-sm"
      >
        <ArrowDown size={15} />
      </button>
      <button
        type="button"
        onClick={() => onHide(!item.isHidden)}
        aria-label={item.isHidden ? `Show ${name} again` : `Hide ${name}`}
        title={item.isHidden ? 'Show in pickers again' : 'Hide from pickers (old entries keep it)'}
        className="btn btn-ghost btn-icon btn-sm"
      >
        {item.isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
      {item.isCustom && item.uses === 0 ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${name}`}
          title="Delete (it isn’t used anywhere)"
          className="btn btn-ghost btn-icon btn-sm !text-[var(--color-danger)]"
        >
          <Trash2 size={15} />
        </button>
      ) : (
        // Keeps the rows aligned; used or built-in ones can only be hidden.
        <span className="w-9" aria-hidden="true" />
      )}
    </li>
  )
}

function MoodsSection(): React.JSX.Element {
  const moods = useMoods()
  const reasons = useReasons()
  const [adding, setAdding] = useState<'mood' | 'reason' | null>(null)

  return (
    <SectionPanel title="Moods & reasons">
      <p className="-mt-2 mb-5 text-sm leading-6 text-[var(--color-text-muted)]">
        What you can pick when logging a watch. Hidden ones disappear from the pickers but stay on
        old watches, in Insights, filters and exports. Anything you’ve used can only be hidden; your
        own unused ones can be deleted.
      </p>

      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Moods</h3>
      <ul className="space-y-2">
        {moods.map((mood, index) => (
          <Row
            key={`${mood.id}-${mood.label}-${mood.emoji}`}
            item={mood}
            index={index}
            count={moods.length}
            kind="mood"
            onSave={(input) =>
              void change(() => window.api.moods.update(mood.id, input), 'save the mood')
            }
            onMove={(step) =>
              void change(
                () =>
                  window.api.moods.reorder(
                    moved(
                      moods.map((item) => item.id),
                      index,
                      step
                    )
                  ),
                'reorder the moods'
              )
            }
            onHide={(hidden) =>
              void change(() => window.api.moods.setHidden(mood.id, hidden), 'change the mood')
            }
            onDelete={() => {
              if (window.confirm(`Delete the mood “${mood.label}”?`))
                void change(() => window.api.moods.delete(mood.id), 'delete the mood')
            }}
          />
        ))}
      </ul>
      {adding === 'mood' ? (
        <InlineAddForm
          kind="mood"
          onCancel={() => setAdding(null)}
          onSave={async (input) => {
            await window.api.moods.create(input)
            await refreshMoods()
            setAdding(null)
          }}
        />
      ) : (
        <button type="button" onClick={() => setAdding('mood')} className="link mt-3">
          <Plus size={15} /> New mood
        </button>
      )}

      <h3 className="mb-2 mt-8 text-sm font-semibold text-[var(--color-text-primary)]">Reasons</h3>
      <ul className="space-y-2">
        {reasons.map((reason, index) => (
          <Row
            key={`${reason.id}-${reason.label}`}
            item={reason}
            index={index}
            count={reasons.length}
            kind="reason"
            onSave={({ label }) =>
              void change(() => window.api.reasons.rename(reason.id, label), 'save the reason')
            }
            onMove={(step) =>
              void change(
                () =>
                  window.api.reasons.reorder(
                    moved(
                      reasons.map((item) => item.id),
                      index,
                      step
                    )
                  ),
                'reorder the reasons'
              )
            }
            onHide={(hidden) =>
              void change(
                () => window.api.reasons.setHidden(reason.id, hidden),
                'change the reason'
              )
            }
            onDelete={() => {
              if (window.confirm(`Delete the reason “${reason.label}”?`))
                void change(() => window.api.reasons.delete(reason.id), 'delete the reason')
            }}
          />
        ))}
      </ul>
      {adding === 'reason' ? (
        <InlineAddForm
          kind="reason"
          onCancel={() => setAdding(null)}
          onSave={async ({ label }) => {
            await window.api.reasons.create(label)
            await refreshMoods()
            setAdding(null)
          }}
        />
      ) : (
        <button type="button" onClick={() => setAdding('reason')} className="link mt-3">
          <Plus size={15} /> New reason
        </button>
      )}
    </SectionPanel>
  )
}

export default MoodsSection
