import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Every dialog in the app is the browser's native modal <dialog>: the page behind becomes inert
// (Tab stays inside), Esc closes it, and focus goes back to the button that opened it.
// It fades and lifts in and out in ~200ms (instantly with reduced motion).

interface DialogProps {
  onClose: () => void
  /** id of the dialog's title element (its accessible name). */
  labelledBy: string
  /** Panel width and anything else, e.g. "max-w-2xl". */
  className?: string
  /** Close when clicking outside the panel (only for dialogs with little to lose). */
  closeOnBackdrop?: boolean
  /** "top" keeps the panel near the top, for content that grows downwards (search results). */
  position?: 'center' | 'top'
  /** While true, Esc and the backdrop don't close it (e.g. while your data is being moved). */
  locked?: boolean
  /** Gets `close`, which plays the closing animation and then calls onClose. */
  children: (close: () => void) => React.ReactNode
}

const CLOSE_MS = 150

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Dialog({
  onClose,
  labelledBy,
  className = '',
  closeOnBackdrop = false,
  position = 'center',
  locked = false,
  children
}: DialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  // open → closing (animation) → closed (onClose is called once, from the effect below).
  const [phase, setPhase] = useState<'open' | 'closing' | 'closed'>('open')
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // A layout effect, so on unmount (e.g. after a save) it closes while still in the page:
  // only then does the browser hand focus back to the button that opened it.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // Start in the first field, so you can type right away (the browser would pick Close).
    if (!dialog.querySelector('[autofocus]'))
      dialog
        .querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled), select, textarea')
        ?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    if (phase === 'closed') {
      if (ref.current?.open) ref.current.close()
      onCloseRef.current()
    }
    if (phase !== 'closing') return
    // Fallback in case no animationend arrives.
    const timer = window.setTimeout(() => setPhase('closed'), CLOSE_MS + 50)
    return () => window.clearTimeout(timer)
  }, [phase])

  const close = (): void =>
    setPhase((current) =>
      current !== 'open' ? current : prefersReducedMotion() ? 'closed' : 'closing'
    )

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-modal="true"
      data-closing={phase === 'closing' ? '' : undefined}
      data-position={position}
      // Esc: animate out instead of the instant native close.
      onCancel={(event) => {
        event.preventDefault()
        if (!locked) close()
      }}
      // If the browser closes it anyway (it may refuse to cancel a second Esc in a row).
      // A late close event from a dialog that has been reopened (StrictMode) is ignored.
      onClose={(event) => {
        if (event.currentTarget.open) return
        // A locked dialog the browser closed anyway (repeated Esc) opens again.
        if (locked) event.currentTarget.showModal()
        else setPhase('closed')
      }}
      onAnimationEnd={(event) => {
        if (phase === 'closing' && event.target === event.currentTarget) setPhase('closed')
      }}
      onMouseDown={(event) => {
        // A click on the backdrop lands on the <dialog> itself, outside the panel's box.
        if (locked || !closeOnBackdrop || event.target !== event.currentTarget) return
        const box = event.currentTarget.getBoundingClientRect()
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom
        if (!inside) close()
      }}
      className={`app-dialog ${className}`}
    >
      {children(close)}
    </dialog>
  )
}

export default Dialog
