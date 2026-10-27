import { useEffect, useState } from 'react'
import { ArrowRight, Check, Heart, ImagePlus, Link2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageTitle from '../components/PageTitle'
import PosterCard from '../components/PosterCard'
import PosterPlaceholder from '../components/PosterPlaceholder'
import SectionPanel from '../components/SectionPanel'
import LinkTmdbDialog from '../components/LinkTmdbDialog'
import TmdbSearch from '../components/TmdbSearch'
import type { PreparedPoster, Title, TitleStatus, TitleType, TmdbPick } from '../../../shared/types'
import { createTitleSchema } from '../../../shared/validation'

interface FormValues {
  type: TitleType
  title: string
  originalTitle: string
  year: string
  genres: string[]
  overview: string
  country: string
  language: string
  runtimeMinutes: string
  totalSeasons: string
  totalEpisodes: string
  status: TitleStatus
  rating: string
  isFavorite: boolean
}

const initialValues: FormValues = {
  type: 'movie',
  title: '',
  originalTitle: '',
  year: '',
  genres: [],
  overview: '',
  country: '',
  language: '',
  runtimeMinutes: '',
  totalSeasons: '',
  totalEpisodes: '',
  status: 'planned',
  rating: '',
  isFavorite: false
}

function titleToValues(title: Title): FormValues {
  return {
    type: title.type,
    title: title.title,
    originalTitle: title.originalTitle ?? '',
    year: title.year?.toString() ?? '',
    genres: title.genres,
    overview: title.overview ?? '',
    country: title.country ?? '',
    language: title.language ?? '',
    runtimeMinutes: title.runtimeMinutes?.toString() ?? '',
    totalSeasons: title.totalSeasons?.toString() ?? '',
    totalEpisodes: title.totalEpisodes?.toString() ?? '',
    status: title.status,
    rating: title.rating?.toString() ?? '',
    isFavorite: title.isFavorite
  }
}

const statusLabels: Record<TitleStatus, string> = {
  planned: 'Planned',
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
  rewatching: 'Rewatching'
}

/** Which TMDB title the form was filled from (cleared if you unlink or switch type). */
interface TmdbLink {
  tmdbId: number
  imdbId: string | null
  type: TitleType
  /** Set when that TMDB title is already in the collection. */
  existingTitleId: number | null
}

function AddTitle(): React.JSX.Element {
  const navigate = useNavigate()
  const { titleId } = useParams()
  const editId = titleId ? Number(titleId) : null
  const isEdit = editId !== null && Number.isInteger(editId)
  const [values, setValues] = useState(initialValues)
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')
  const [poster, setPoster] = useState<PreparedPoster | null>(null)
  const [savedTitle, setSavedTitle] = useState<Title | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [existingPoster, setExistingPoster] = useState<string | null>(null)
  const [tmdbLink, setTmdbLink] = useState<TmdbLink | null>(null)
  const [loadedTitle, setLoadedTitle] = useState<Title | null>(null)
  const [loadedValues, setLoadedValues] = useState<FormValues | null>(null)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    void window.api.titles
      .listGenres()
      .then(setAvailableGenres)
      .catch(() => undefined)
  }, [])

  /** Puts a saved title into the form (on load, and again after linking to TMDB). */
  const loadSaved = (title: Title): void => {
    const saved = titleToValues(title)
    setLoadedTitle(title)
    setLoadedValues(saved)
    setValues(saved)
    setPoster(null)
    // The version query makes the browser show a poster that was just replaced.
    setExistingPoster(
      title.posterFile
        ? `poster://titles/${title.id}?v=${encodeURIComponent(title.updatedAt)}`
        : null
    )
  }

  useEffect(() => {
    if (!isEdit || editId === null) return
    void window.api.titles
      .get(editId)
      .then((title) => {
        if (title) loadSaved(title)
      })
      .catch(() => setFormError('The title could not be loaded.'))
  }, [editId, isEdit])

  const hasUnsavedChanges =
    loadedValues !== null &&
    (JSON.stringify(values) !== JSON.stringify(loadedValues) ||
      poster !== null ||
      (existingPoster === null && loadedTitle?.posterFile != null))

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]): void => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const addGenre = (name: string): void => {
    const genre = name.trim()
    if (!genre || values.genres.some((item) => item.toLowerCase() === genre.toLowerCase())) return
    update('genres', [...values.genres, genre])
    if (!availableGenres.some((item) => item.toLowerCase() === genre.toLowerCase())) {
      setAvailableGenres((current) => [...current, genre].sort())
    }
    setGenreInput('')
  }

  /** Fills the form from TMDB; status, rating and favorite stay as you set them. */
  const applyTmdbPick = ({ draft, poster: tmdbPoster, existingTitleId }: TmdbPick): void => {
    setValues((current) => ({
      ...current,
      type: draft.type,
      title: draft.title,
      originalTitle: draft.originalTitle ?? '',
      year: draft.year?.toString() ?? '',
      genres: draft.genres,
      overview: draft.overview ?? '',
      country: draft.country ?? '',
      language: draft.language ?? '',
      runtimeMinutes: draft.runtimeMinutes?.toString() ?? '',
      totalSeasons: draft.totalSeasons?.toString() ?? '',
      totalEpisodes: draft.totalEpisodes?.toString() ?? ''
    }))
    setErrors({})
    setFormError('')
    if (tmdbPoster) setPoster(tmdbPoster)
    setAvailableGenres((current) =>
      [...new Set([...current, ...draft.genres])].sort((a, b) => a.localeCompare(b))
    )
    setTmdbLink({ tmdbId: draft.tmdbId, imdbId: draft.imdbId, type: draft.type, existingTitleId })
  }

  const preparePoster = async (file: File): Promise<void> => {
    try {
      setPoster(await window.api.posters.prepareDropped(file))
      setFormError('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'That poster could not be added.')
    }
  }

  const pickPoster = async (): Promise<void> => {
    try {
      const picked = await window.api.posters.pick()
      if (picked) setPoster(picked)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'That poster could not be added.')
    }
  }

  const submit = async (): Promise<void> => {
    const input = {
      type: values.type,
      title: values.title,
      originalTitle: values.originalTitle || undefined,
      tmdbId: tmdbLink?.tmdbId,
      imdbId: tmdbLink?.imdbId ?? undefined,
      year: values.year ? Number(values.year) : undefined,
      genres: values.genres,
      overview: values.overview || undefined,
      country: values.country || undefined,
      language: values.language || undefined,
      runtimeMinutes: values.runtimeMinutes ? Number(values.runtimeMinutes) : undefined,
      totalSeasons:
        values.type === 'series' && values.totalSeasons ? Number(values.totalSeasons) : undefined,
      totalEpisodes:
        values.type === 'series' && values.totalEpisodes ? Number(values.totalEpisodes) : undefined,
      status: values.status,
      rating: values.rating ? Number(values.rating) : undefined,
      isFavorite: values.isFavorite,
      tempPosterFile: poster?.tempFile
    }
    const parsed = createTitleSchema.safeParse(input)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'title')
        nextErrors[field] ??= issue.message
      }
      setErrors(nextErrors)
      return
    }
    setIsSaving(true)
    setFormError('')
    try {
      if (isEdit && editId !== null) {
        await window.api.titles.update({
          ...parsed.data,
          id: editId,
          removePoster: existingPoster === null && !poster
        })
        navigate(`/title/${editId}`)
      } else {
        setSavedTitle(await window.api.titles.create(parsed.data))
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The title could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  if (savedTitle) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageTitle description="A new story has been added to your personal cinema.">
          Title saved
        </PageTitle>
        <EmptyState
          icon={Check}
          title={`${savedTitle.title} is in your collection`}
          description="You can add a watch entry and your feelings later, after you watch it."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSavedTitle(null)
                  setValues(initialValues)
                  setPoster(null)
                  setTmdbLink(null)
                }}
                className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel-elevated)] hover:text-white"
              >
                Add another
              </button>
              <button
                type="button"
                onClick={() => navigate('/collection')}
                className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-light)]"
              >
                Go to My Collection
              </button>
            </div>
          }
        />
        <div className="mt-8 flex justify-center">
          <PosterCard title={savedTitle} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        description={
          isEdit
            ? 'Update the details of this story in your personal cinema.'
            : 'Add a movie or series to your personal collection. You can add how it made you feel later.'
        }
      >
        {isEdit ? 'Edit title' : 'Add a title'}
      </PageTitle>
      {!isEdit ? <TmdbSearch onPick={applyTmdbPick} /> : null}
      {isEdit && loadedTitle && loadedTitle.tmdbId === null ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-4 text-sm text-[var(--color-text-secondary)]">
          <Link2 size={16} className="text-[var(--color-accent-light)]" />
          Added manually. Link it to TMDB to fill in details, cast and a backdrop — you choose what
          to keep.
          <button
            type="button"
            onClick={() => setLinking(true)}
            className="ml-auto rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel-elevated)] hover:text-white"
          >
            Link to TMDB
          </button>
        </div>
      ) : null}
      {linking && loadedTitle ? (
        <LinkTmdbDialog
          title={loadedTitle}
          onClose={() => setLinking(false)}
          confirmApply={() =>
            !hasUnsavedChanges ||
            window.confirm(
              'You have unsaved changes on this page. Linking saves your TMDB choices to the stored title and reloads this form, so your unsaved changes will be lost. Continue?'
            )
          }
          onLinked={(linked) => {
            setLinking(false)
            loadSaved(linked)
          }}
        />
      ) : null}
      <SectionPanel title="Title details">
        {tmdbLink ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)] px-4 py-3 text-sm">
            <Link2 size={16} className="text-[var(--color-accent-light)]" />
            <span className="text-[var(--color-text-secondary)]">
              Filled from TMDB{tmdbLink.imdbId ? ` · IMDb ${tmdbLink.imdbId}` : ''}. Change anything
              you like before saving.
            </span>
            <button
              type="button"
              onClick={() => setTmdbLink(null)}
              className="ml-auto text-xs font-semibold text-[var(--color-text-muted)] hover:text-white"
            >
              Unlink from TMDB
            </button>
          </div>
        ) : null}
        {tmdbLink?.existingTitleId ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-[var(--color-accent-muted)] px-4 py-3 text-sm text-[var(--color-accent-light)]">
            This title is already in your collection.
            <Link
              to={`/title/${tmdbLink.existingTitleId}`}
              className="flex items-center gap-1 font-semibold hover:underline"
            >
              Open it <ArrowRight size={14} />
            </Link>
          </div>
        ) : null}
        <div className="mb-8 flex gap-2 rounded-[var(--radius-control)] bg-[var(--color-background)] p-1 sm:w-fit">
          {(['movie', 'series'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                update('type', type)
                // A TMDB id only belongs to one type, so switching type drops the link.
                if (tmdbLink && tmdbLink.type !== type) setTmdbLink(null)
              }}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                values.type === type
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              {type === 'movie' ? 'Movie' : 'TV Series'}
            </button>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <div>
            <PosterUpload
              poster={poster}
              existingPoster={existingPoster}
              onRemove={() => setExistingPoster(null)}
              onPickRequest={pickPoster}
              onDrop={preparePoster}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Title" error={errors.title} className="sm:col-span-2">
              <input
                value={values.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder="Enter a title"
              />
            </Field>
            <Field label="Original title (optional)" className="sm:col-span-2">
              <input
                value={values.originalTitle}
                onChange={(event) => update('originalTitle', event.target.value)}
                placeholder="e.g. 千と千尋の神隠し"
              />
            </Field>
            <Field label="Year" error={errors.year}>
              <input
                type="number"
                value={values.year}
                onChange={(event) => update('year', event.target.value)}
                placeholder="e.g. 2024"
              />
            </Field>
            <Field label="Status" error={errors.status}>
              <select
                value={values.status}
                onChange={(event) => update('status', event.target.value as TitleStatus)}
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <GenreField
              values={values.genres}
              input={genreInput}
              available={availableGenres}
              onInput={setGenreInput}
              onAdd={addGenre}
              onRemove={(genre) =>
                update(
                  'genres',
                  values.genres.filter((item) => item !== genre)
                )
              }
            />
            <Field label="Country">
              <input
                value={values.country}
                onChange={(event) => update('country', event.target.value)}
                placeholder="e.g. United States"
              />
            </Field>
            <Field label="Language">
              <input
                value={values.language}
                onChange={(event) => update('language', event.target.value)}
                placeholder="e.g. English"
              />
            </Field>
            <Field
              label={values.type === 'series' ? 'Episode runtime (minutes)' : 'Runtime (minutes)'}
              error={errors.runtimeMinutes}
            >
              <input
                type="number"
                min="1"
                value={values.runtimeMinutes}
                onChange={(event) => update('runtimeMinutes', event.target.value)}
                placeholder="e.g. 120"
              />
            </Field>
            {values.type === 'series' ? (
              <>
                <Field label="Seasons" error={errors.totalSeasons}>
                  <input
                    type="number"
                    min="1"
                    value={values.totalSeasons}
                    onChange={(event) => update('totalSeasons', event.target.value)}
                    placeholder="e.g. 3"
                  />
                </Field>
                <Field label="Episodes" error={errors.totalEpisodes}>
                  <input
                    type="number"
                    min="1"
                    value={values.totalEpisodes}
                    onChange={(event) => update('totalEpisodes', event.target.value)}
                    placeholder="e.g. 24"
                  />
                </Field>
              </>
            ) : null}
            <Field label="Synopsis" className="sm:col-span-2">
              <textarea
                rows={5}
                value={values.overview}
                onChange={(event) => update('overview', event.target.value)}
                placeholder="What is this story about?"
              />
            </Field>
            <Field label="Personal rating (optional)" error={errors.rating}>
              <input
                type="number"
                min="1"
                max="10"
                value={values.rating}
                onChange={(event) => update('rating', event.target.value)}
                placeholder="1–10"
              />
            </Field>
            <label className="flex items-center gap-3 self-end pb-3 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={values.isFavorite}
                onChange={(event) => update('isFavorite', event.target.checked)}
                className="accent-[var(--color-favorite)]"
              />
              <Heart
                size={16}
                className={values.isFavorite ? 'text-[var(--color-favorite)]' : ''}
                fill={values.isFavorite ? 'currentColor' : 'none'}
              />
              Add to favorites
            </label>
          </div>
        </div>
        {formError ? (
          <p className="mt-5 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {formError}
          </p>
        ) : null}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={isSaving || Boolean(tmdbLink?.existingTitleId)}
            onClick={() => void submit()}
            className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-light)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save title'}
          </button>
        </div>
      </SectionPanel>
    </div>
  )
}

interface FieldProps {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}

function Field({ label, error, className = '', children }: FieldProps): React.JSX.Element {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-[var(--color-text-secondary)]">
        {label}
      </span>
      <div className="[&_input]:h-11 [&_input]:w-full [&_input]:rounded-[var(--radius-control)] [&_input]:border [&_input]:border-[var(--color-border)] [&_input]:bg-[var(--color-input)] [&_input]:px-3 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none [&_input]:focus:border-[var(--color-accent)] [&_select]:h-11 [&_select]:w-full [&_select]:rounded-[var(--radius-control)] [&_select]:border [&_select]:border-[var(--color-border)] [&_select]:bg-[var(--color-input)] [&_select]:px-3 [&_select]:text-sm [&_select]:text-white [&_textarea]:w-full [&_textarea]:rounded-[var(--radius-control)] [&_textarea]:border [&_textarea]:border-[var(--color-border)] [&_textarea]:bg-[var(--color-input)] [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:text-white [&_textarea]:outline-none [&_textarea]:focus:border-[var(--color-accent)]">
        {children}
      </div>
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </label>
  )
}

interface GenreFieldProps {
  values: string[]
  input: string
  available: string[]
  onInput: (value: string) => void
  onAdd: (value: string) => void
  onRemove: (value: string) => void
}

function GenreField({
  values,
  input,
  available,
  onInput,
  onAdd,
  onRemove
}: GenreFieldProps): React.JSX.Element {
  const suggestions = available
    .filter((genre) => genre.toLowerCase().includes(input.toLowerCase()) && !values.includes(genre))
    .slice(0, 6)
  return (
    <div className="relative sm:col-span-2">
      <span className="mb-2 block text-sm font-semibold text-[var(--color-text-secondary)]">
        Genres
      </span>
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-2">
        {values.map((genre) => (
          <span
            key={genre}
            className="flex items-center gap-1 rounded-full bg-[var(--color-accent-muted)] px-3 py-1 text-xs text-[var(--color-accent-light)]"
          >
            {genre}
            <button type="button" onClick={() => onRemove(genre)} aria-label={`Remove ${genre}`}>
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAdd(input)
            }
          }}
          placeholder={values.length ? 'Add another genre' : 'Type a genre and press Enter'}
          className="min-w-40 flex-1 bg-transparent px-1 text-sm text-white outline-none"
        />
      </div>
      {input && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)] p-1 shadow-xl">
          {suggestions.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => onAdd(genre)}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-muted)] hover:text-white"
            >
              {genre}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface PosterUploadProps {
  poster: PreparedPoster | null
  existingPoster: string | null
  onRemove: () => void
  onPickRequest: () => void
  onDrop: (file: File) => void
}

function PosterUpload({
  poster,
  existingPoster,
  onRemove,
  onPickRequest,
  onDrop
}: PosterUploadProps): React.JSX.Element {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const file = event.dataTransfer.files[0]
        if (file) onDrop(file)
      }}
      className="group relative"
    >
      {poster ? (
        <img
          src={poster.previewDataUrl}
          alt="Selected poster preview"
          className="aspect-[2/3] w-full rounded-[var(--radius-card)] object-cover"
        />
      ) : existingPoster ? (
        <img
          src={existingPoster}
          alt="Current poster"
          className="aspect-[2/3] w-full rounded-[var(--radius-card)] object-cover"
          onError={onRemove}
        />
      ) : (
        <PosterPlaceholder title="Poster" />
      )}
      <button
        type="button"
        onClick={() => void onPickRequest()}

        className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-[var(--color-accent)]"
      >
        <ImagePlus size={15} /> {poster ? 'Change poster' : 'Choose poster'}
      </button>
      {existingPoster && !poster ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

export default AddTitle
