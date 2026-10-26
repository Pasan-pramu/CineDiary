import { ArrowLeft, Heart, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageTitle from '../components/PageTitle'
import PosterPlaceholder from '../components/PosterPlaceholder'
import type { Title } from '../../../shared/types'

function TitleDetails(): React.JSX.Element {
  const { titleId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState<Title | null>(null)
  const [loading, setLoading] = useState(true)
  const invalidId = !Number.isInteger(Number(titleId)) || Number(titleId) <= 0

  useEffect(() => {
    const id = Number(titleId)
    if (invalidId) return
    void window.api.titles
      .get(id)
      .then(setTitle)
      .finally(() => setLoading(false))
  }, [invalidId, titleId])

  if (loading && !invalidId) {
    return <p className="text-sm text-[var(--color-text-muted)]">Loading title…</p>
  }
  if (!title) {
    return (
      <EmptyState
        icon={Star}
        title="Title not found"
        description="This title could not be found in your collection."
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => navigate(`/collection?${searchParams.toString()}`)}
        className="mb-6 flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-white"
      >
        <ArrowLeft size={16} /> Back to My Collection
      </button>
      <PageTitle description="A simple preview for now. Full personal details arrive in M4.">
        Title details
      </PageTitle>
      <section className="grid gap-8 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 sm:grid-cols-[180px_1fr] sm:p-8">
        <div>
          {title.posterFile ? (
            <img
              src={`poster://${title.id}`}
              alt=""
              className="aspect-[2/3] w-full rounded-[var(--radius-card)] object-cover"
            />
          ) : (
            <PosterPlaceholder title={title.title} />
          )}
        </div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-4xl text-[var(--color-text-primary)]">
                {title.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {title.type === 'series' ? 'TV Series' : 'Movie'}
                {title.year ? ` · ${title.year}` : ''}
              </p>
            </div>
            {title.isFavorite ? (
              <Heart size={20} fill="currentColor" className="text-[var(--color-favorite)]" />
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {title.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-[var(--color-accent-muted)] px-3 py-1 text-xs text-[var(--color-accent-light)]"
              >
                {genre}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-secondary)]">
            <span className="rounded-full bg-[var(--color-panel-elevated)] px-3 py-1 capitalize">
              {title.status}
            </span>
            {title.rating ? (
              <span className="flex items-center gap-1 text-[var(--color-rating)]">
                <Star size={15} fill="currentColor" /> {title.rating}/10
              </span>
            ) : null}
          </div>
          <p className="mt-8 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">
            Details coming in M4.
          </p>
        </div>
      </section>
    </div>
  )
}

export default TitleDetails
