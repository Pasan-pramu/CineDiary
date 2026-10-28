import { CheckCircle2, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { dismissToast, useToasts } from '../errors'

/**
 * The toast stack, bottom right. It's a manual popover, so it lives in the browser's top layer:
 * shown again after every new toast, it sits above any open modal dialog instead of behind its
 * backdrop.
 */
function Toasts(): React.JSX.Element {
  const toasts = useToasts()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (element.matches(':popover-open')) element.hidePopover()
    if (toasts.length) element.showPopover()
  }, [toasts])

  return (
    <div ref={ref} popover="manual" className="toast-stack">
      <ul className="flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <li
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="flex w-80 items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)] p-4 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-raised)]"
          >
            {toast.tone === 'error' ? (
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
            ) : (
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-[var(--color-positive-icon)]"
              />
            )}
            <p className="flex-1 leading-5">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              className="btn btn-ghost btn-icon btn-sm -my-2 -mr-2"
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Toasts
