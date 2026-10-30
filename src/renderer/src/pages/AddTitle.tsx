import { useEffect, useState } from 'react'
import { ArrowRight, Check, Heart, History, ImagePlus, Link2, Play, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageTitle from '../components/PageTitle'
import PosterCard from '../components/PosterCard'
import PosterPlaceholder from '../components/PosterPlaceholder'
import RatingStars from '../components/RatingStars'
import SectionPanel from '../components/SectionPanel'
import LinkTmdbDialog from '../components/LinkTmdbDialog'
import TmdbSearch from '../components/TmdbSearch'
import WatchedQuestion from '../components/WatchedQuestion'
import WatchEntryDialog from '../components/WatchEntryDialog'
import {
  FIRST_WATCH_INTRO,
  STATUS_LABELS,
  WATCHED_ANSWERS,
  answerToTitle,
  type WatchedAnswer
} from '../../../shared/constants'
import type {
  PreparedPoster,
  Title,
  TitleStatus,
  TitleType,
  TmdbPick,
  WatchEntry
} from '../../../shared/types'
import { createTitleSchema } from '../../../shared/validation'
import { failed, logError } from '../errors'

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

/** The watch form shown over the saved title: on the watch saved with it, or a new one. */
interface FollowUp {
  mode: 'start' | 'past'
  /** The watch saved with the title ("Watching now" / "Already watched"); the form edits it. */
  entry?: WatchEntry
}

/** What the success screen says about the watches saved so far. */
const SAVED_DESCRIPTION: Record<WatchedAnswer, string> = {
  not_yet: 'It’s on your watchlist. Starting it now, or watched it before? Log it here.',
  watching: 'Saved as watching. Add how you feel any time on its page.',
  watched: 'Saved as watched. Add how it felt any time on its page.',
  dropped: 'Saved as dropped.'
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
  // "More details…" in Quick Add carries what was typed: /add?title=…&type=series&watched=…
  const [params] = useSearchParams()
  const [values, setValues] = useState<FormValues>(() => {
    if (isEdit) return initialValues
    return {
      ...initialValues,
      title: params.get('title') ?? '',
      type: params.get('type') === 'series' ? 'series' : 'movie'
    }
  })
  // Adding asks "Have you watched it?"; editing keeps the Status field.
  const [answer, setAnswer] = useState<WatchedAnswer>(() => {
    const watched = params.get('watched')
    return watched === 'dropped' || WATCHED_ANSWERS.some((option) => option.value === watched)
      ? (watched as WatchedAnswer)
      : 'not_yet'
  })
  const [savedAnswer, setSavedAnswer] = useState<WatchedAnswer>('not_yet')
  const [followUp, setFollowUp] = useState<FollowUp | null>(null)
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
      .catch(failed('Couldn’t load your genres.'))
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
      .catch((error: unknown) => {
        logError('renderer', error)
        setFormError('The title could not be loaded.')
      })
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
      status: isEdit ? values.status : answerToTitle(answer).status,
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
        const { firstWatch } = answerToTitle(answer)
        const saved = await window.api.titles.create({ ...parsed.data, firstWatch })
        setSavedTitle(saved)
        setSavedAnswer(answer)
        if (firstWatch) {
          // The watch saved with the title: the form that opens adds your feelings to it.
          const [entry] = await window.api.watchEntries.list(saved.id)
          if (entry) setFollowUp({ mode: firstWatch === 'watching' ? 'start' : 'past', entry })
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The title could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  /** A fresh, empty form (after "Add another" or "Save & add another past movie"). */
  const startOver = (nextAnswer: WatchedAnswer): void => {
    setSavedTitle(null)
    setFollowUp(null)
    setValues(initialValues)
    setPoster(null)
    setTmdbLink(null)
    setErrors({})
    setAnswer(nextAnswer)
  }

  if (savedTitle) {
    // A watch in progress can't get another Start watching (one open run per title).
    const watching = savedAnswer === 'watching'
    return (
      <div className="page-reading">
        <PageTitle description="A new story has been added to your personal cinema.">
          Title saved
        </PageTitle>
        <EmptyState
          icon={Check}
          title={`${savedTitle.title} is in your collection`}
          description={SAVED_DESCRIPTION[savedAnswer]}
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-3">
                {watching ? null : (
                  <button
                    type="button"
                    onClick={() => setFollowUp({ mode: 'start' })}
                    className="btn btn-primary"
                  >
                    <Play size={15} /> Start watching
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFollowUp({ mode: 'past' })}
                  className={watching ? 'btn btn-primary' : 'btn btn-secondary'}
                >
                  <History size={15} /> Log a past watch
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => startOver('not_yet')}
                  className="btn btn-secondary"
                >
                  Add another
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/collection')}
                  className="btn btn-secondary"
                >
                  Go to My Collection
                </button>
              </div>
            </div>
          }
        />
        <div className="mt-8 flex justify-center">
          <div className="w-44">
            <PosterCard title={savedTitle} onClick={() => navigate(`/title/${savedTitle.id}`)} />
          </div>
        </div>
        {followUp ? (
          <WatchEntryDialog
            mode={followUp.mode}
            titleId={savedTitle.id}
            entry={followUp.entry}
            totalEpisodes={savedTitle.totalEpisodes}
            initialRating={savedTitle.rating}
            intro={
              followUp.entry
                ? FIRST_WATCH_INTRO[followUp.mode === 'start' ? 'watching' : 'watched']
                : undefined
            }
            cancelLabel={followUp.entry ? 'Skip' : 'Cancel'}
            onSaveAndAddAnother={
              followUp.entry && followUp.mode === 'past' ? () => startOver('watched') : undefined
            }
            onClose={() => setFollowUp(null)}
            onSaved={() => {
              if (followUp.mode === 'start') setSavedAnswer('watching')
              else if (savedAnswer !== 'watching') setSavedAnswer('watched')
              setFollowUp(null)
              // The rating may have changed in the form.
              void window.api.titles
                .get(savedTitle.id)
                .then((title) => title && setSavedTitle(title))
                .catch(failed('Couldn’t reload this title.'))
            }}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="page-reading">
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
            className="btn btn-secondary ml-auto"
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
              className="ml-auto text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
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
        <div className="segmented mb-8" role="group" aria-label="Type">
          {(['movie', 'series'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={values.type === type}
              onClick={() => {
                update('type', type)
                // A TMDB id only belongs to one type, so switching type drops the link.
                if (tmdbLink && tmdbLink.type !== type) setTmdbLink(null)
              }}
              className="segment"
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
            {isEdit ? (
              <Field label="Status" error={errors.status}>
                <select
                  value={values.status}
                  onChange={(event) => update('status', event.target.value as TitleStatus)}
                >
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="sm:col-span-2">
                <WatchedQuestion value={answer} onChange={setAnswer} />
              </div>
            )}
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
            {/* Not a <label>: a click anywhere in it would press the first star. */}
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                Personal rating (optional)
              </p>
              <div className="flex min-h-11 items-center">
                <RatingStars
                  value={values.rating ? Number(values.rating) : null}
                  onChange={(rating) => update('rating', rating === null ? '' : String(rating))}
                />
              </div>
              {errors.rating ? (
                <span className="mt-1 block text-xs text-[var(--color-danger)]">
                  {errors.rating}
                </span>
              ) : null}
            </div>
            <label className="flex items-center gap-3 self-end pb-3 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={values.isFavorite}
                onChange={(event) => update('isFavorite', event.target.checked)}
                className="accent-[var(--color-favorite)]"
              />
              <Heart
                size={16}
                className={values.isFavorite ? 'text-[var(--color-favorite-icon)]' : ''}
                fill={values.isFavorite ? 'currentColor' : 'none'}
              />
              Add to favorites
            </label>
          </div>
        </div>
        {formError ? (
          <p className="mt-5 rounded-lg bg-[var(--color-danger-surface)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {formError}
          </p>
        ) : null}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={isSaving || Boolean(tmdbLink?.existingTitleId)}
            onClick={() => void submit()}
            className="btn btn-primary"
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
      <div className="field-group">{children}</div>
      {error ? (
        <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>
      ) : null}
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
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-2 focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_var(--color-accent-muted)]">
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
          aria-label="Add a genre"
          className="min-w-40 flex-1 bg-transparent px-1 text-sm text-[var(--color-text-primary)] focus-visible:outline-none"
        />
      </div>
      {input && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)] p-1 shadow-xl">
          {suggestions.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => onAdd(genre)}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-text-primary)]"
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

        className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-image-scrim)] px-3 py-2 text-xs font-semibold text-[var(--color-on-image)] backdrop-blur transition hover:bg-[var(--color-accent)]"
      >
        <ImagePlus size={15} /> {poster ? 'Change poster' : 'Choose poster'}
      </button>
      {existingPoster && !poster ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-3 top-3 rounded-full bg-[var(--color-image-scrim)] px-2 py-1 text-xs text-[var(--color-on-image)]"
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

export default AddTitle
