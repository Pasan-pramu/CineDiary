import type {
  ChapterAnalysis,
  CollectionTypeFilter,
  DistributionItem,
  LanguageBreakdown,
  MoodGroup,
  ReasonMoodGroup
} from '../../../shared/types'

// Turns mood numbers into sentences for the Insights page. Default reasons get hand-written
// phrases; custom reasons (and anything unknown) use "When you watched for '<label>'".

const PAST_SITUATIONS: Record<string, string> = {
  happy: 'When you were already happy',
  sad: 'When you were sad',
  lonely: 'When you felt lonely',
  stressed: 'When you were stressed',
  demotivated: 'When you felt demotivated',
  needed_motivation: 'When you needed motivation',
  needed_relaxation: 'When you needed to relax',
  wanted_to_laugh: 'When you wanted to laugh',
  wanted_adrenaline: 'When you wanted adrenaline',
  needed_an_escape: 'When you needed an escape',
  wanted_something_meaningful: 'When you wanted something meaningful',
  wanted_inspiration: 'When you wanted inspiration',
  wanted_adventure: 'When you wanted adventure',
  curious: 'When you were curious',
  recommended_by_someone: 'When someone recommended it',
  rewatch: 'When you went back for a rewatch',
  other: 'When you watched for another reason'
}

const PRESENT_SITUATIONS: Record<string, string> = {
  stressed: "When you're stressed",
  sad: "When you're sad",
  lonely: 'When you feel lonely',
  needed_motivation: 'When you need motivation',
  needed_relaxation: 'When you need to relax',
  happy: "When you're already happy",
  wanted_adrenaline: 'When you want adrenaline'
}

export function formatChange(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded > 0) return `+${rounded.toFixed(1)}`
  if (rounded < 0) return `−${Math.abs(rounded).toFixed(1)}`
  return '0.0'
}

export function watchCount(n: number): string {
  return `${n} ${n === 1 ? 'watch' : 'watches'}`
}

function customSituation(label: string): string {
  return `When you watched for ‘${label}’`
}

/** "When you were stressed, your mood went up by +2.4 (based on 5 watches)." */
export function reasonChangeSentence(group: ReasonMoodGroup): string {
  const situation =
    (!group.isCustom && PAST_SITUATIONS[group.reasonKey]) || customSituation(group.label)
  const rounded = Math.round(group.averageChange * 10) / 10
  const change =
    rounded > 0
      ? `your mood went up by ${formatChange(rounded)}`
      : rounded < 0
        ? `your mood went down by ${Math.abs(rounded).toFixed(1)}`
        : 'your mood stayed about the same'
  return `${situation}, ${change} (based on ${watchCount(group.n)}).`
}

/** "When you're stressed" — heading for the "Most effective for" cards. */
export function presentSituation(reasonKey: string, label: string): string {
  return PRESENT_SITUATIONS[reasonKey] ?? customSituation(label)
}

/** "When you're stressed, Comedy lifts your mood by +3.2 on average." */
export function bestGenreSentence(reasonKey: string, label: string, genre: MoodGroup): string {
  const situation = presentSituation(reasonKey, label)
  if (Math.round(genre.averageChange * 10) <= 0) {
    return `${situation}, no genre has lifted your mood yet.`
  }
  return `${situation}, ${genre.label} lifts your mood by ${formatChange(genre.averageChange)} on average.`
}

/** Green when mood went up, rose when it went down. */
export function changeColor(change: number): string {
  if (change > 0) return 'var(--color-positive)'
  if (change < 0) return 'var(--color-favorite)'
  return 'var(--color-text-muted)'
}

// Feelings & life chapters (M10c).

/** "because you felt lonely": what follows "because" for each default reason. */
const BECAUSE: Record<string, string> = {
  happy: 'you were happy',
  sad: 'you felt sad',
  lonely: 'you felt lonely',
  stressed: 'you were stressed',
  demotivated: 'you felt demotivated',
  needed_motivation: 'you needed motivation',
  needed_relaxation: 'you needed to relax',
  wanted_to_laugh: 'you wanted to laugh',
  wanted_adrenaline: 'you wanted adrenaline',
  needed_an_escape: 'you needed an escape',
  wanted_something_meaningful: 'you wanted something meaningful',
  wanted_inspiration: 'you wanted inspiration',
  wanted_adventure: 'you wanted adventure',
  curious: 'you were curious',
  recommended_by_someone: 'someone recommended it',
  rewatch: 'you wanted to see it again',
  other: 'of another reason'
}

/** "you felt lonely", or "of ‘Exam week’" for a custom reason. */
export function becausePhrase(reason: DistributionItem): string {
  return (!reason.isCustom && reason.key && BECAUSE[reason.key]) || `of ‘${reason.label}’`
}

/** 31%, or "<1%" for a tiny but non-zero share. */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.005) return '<1%'
  return `${Math.round(share * 100)}%`
}

/** "312 watches, 31%" */
function countAndShare(item: DistributionItem): string {
  return `${item.watches.toLocaleString()} ${item.watches === 1 ? 'watch' : 'watches'}, ${formatShare(item.share)}`
}

/** "It lifted your mood by +2.1 on average." (empty below the 2-watch minimum) */
function moodChangeClause(item: DistributionItem, subject = 'It'): string {
  if (item.averageChange === null) return ''
  const rounded = Math.round(item.averageChange * 10) / 10
  if (rounded > 0) return ` ${subject} lifted your mood by ${formatChange(rounded)} on average.`
  if (rounded < 0) {
    return ` ${subject} brought your mood down by ${Math.abs(rounded).toFixed(1)} on average.`
  }
  return ` Your mood stayed about the same on average.`
}

/** "You most often watched because you felt lonely (312 watches, 31%). It lifted …" */
export function topReasonSentence(reason: DistributionItem): string {
  return `You most often watched because ${becausePhrase(reason)} (${countAndShare(reason)}).${moodChangeClause(reason)}`
}

/** "Before watching, you most often felt lonely (312 watches, 31%). Watching lifted …" */
export function topFeelingSentence(feeling: DistributionItem): string {
  return `Before watching, you most often felt ${feeling.label.toLowerCase()} (${countAndShare(feeling)}).${moodChangeClause(feeling, 'Watching')}`
}

/** "After watching, you most often felt calm (204 watches, 20%)." */
export function topAfterSentence(feeling: DistributionItem): string {
  return `After watching, you most often felt ${feeling.label.toLowerCase()} (${countAndShare(feeling)}).`
}

/** "During Final year at university you mostly watched because you felt lonely (38%), then …" */
export function chapterSentence(analysis: ChapterAnalysis): string {
  const name = analysis.chapter.name
  if (analysis.watches === 0) return `Nothing watched during ${name} yet.`
  const [first, second] = analysis.topReasons
  if (first) {
    const then = second
      ? `, then because ${becausePhrase(second)} (${formatShare(second.share)})`
      : ''
    return `During ${name} you mostly watched because ${becausePhrase(first)} (${formatShare(first.share)})${then}.`
  }
  const feeling = analysis.topFeelings[0]
  if (feeling) {
    return `During ${name} you most often felt ${feeling.label.toLowerCase()} before watching (${formatShare(feeling.share)}).`
  }
  return `No reasons or feelings recorded during ${name} yet.`
}

const LANGUAGE_NOUNS: Record<CollectionTypeFilter, string> = {
  all: 'movies and series',
  movie: 'movies',
  series: 'series'
}

const ONE_LANGUAGE: Record<CollectionTypeFilter, string> = {
  all: "Everything you've watched",
  movie: "Every movie you've watched",
  series: "Every series you've watched"
}

/** "You've watched movies and series in 6 languages; mostly English." ("Mostly": half or more.) */
export function languageSentence(breakdown: LanguageBreakdown, type: CollectionTypeFilter): string {
  const { languageCount, top } = breakdown
  if (!top) return 'Add a language to your titles to see which languages you watch in.'
  if (languageCount === 1) return `${ONE_LANGUAGE[type]} is in ${top.label}.`
  const lead = top.share >= 0.5 ? 'mostly' : 'most often'
  return `You've watched ${LANGUAGE_NOUNS[type]} in ${languageCount} languages; ${lead} ${top.label}.`
}
