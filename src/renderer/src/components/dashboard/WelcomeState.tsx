import { Clapperboard, HeartPulse, Plus, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import HeroBanner from './HeroBanner'

const STEPS = [
  {
    icon: Clapperboard,
    title: 'Add a title',
    text: 'A movie or series you love, are watching, or want to watch.'
  },
  {
    icon: HeartPulse,
    title: 'Log how you felt',
    text: 'Your mood before and after, why you pressed play, and what stayed with you.'
  },
  {
    icon: Sparkles,
    title: 'See your patterns',
    text: 'Which stories lift you up, and what to watch when you need it most.'
  }
]

interface WelcomeStateProps {
  greeting: string
  bannerFile: string | null
  hasName: boolean
}

/** The Home page on a new install: one clear first step instead of empty widgets. */
function WelcomeState({ greeting, bannerFile, hasName }: WelcomeStateProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <HeroBanner
          greeting={greeting}
          subtitle="Welcome to CineDiary, your private journal for every story you watch and how it made you feel."
          bannerFile={bannerFile}
        />
      </div>
      <section
        className="animate-fade-up rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] px-8 py-12 text-center"
        style={{ animationDelay: '60ms' }}
      >
        <h2 className="font-display text-[32px] leading-tight text-[var(--color-text-primary)]">
          Your personal cinema starts here
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
          Everything stays on this computer. Add your first title and CineDiary will grow with every
          story you log.
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 text-left md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)] p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-accent-muted)] text-[var(--color-accent-light)]">
                  <step.icon size={20} />
                </span>
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-[var(--color-text-primary)]">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{step.text}</p>
            </div>
          ))}
        </div>
        <Link
          to="/add"
          className="mt-10 inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-7 py-4 text-base font-semibold text-[var(--color-on-accent)] shadow-lg shadow-[var(--color-accent)]/25 transition hover:bg-[var(--color-accent-hover)]"
        >
          <Plus size={20} /> Add your first title
        </Link>
        {!hasName ? (
          <p className="mt-5 text-xs text-[var(--color-text-muted)]">
            Tip: add your name in{' '}
            <Link to="/settings" className="text-[var(--color-accent-light)] hover:underline">
              Settings
            </Link>{' '}
            for a personal greeting.
          </p>
        ) : null}
      </section>
    </div>
  )
}

export default WelcomeState
