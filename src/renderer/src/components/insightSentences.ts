import type { MoodGroup, ReasonMoodGroup } from '../../../shared/types'

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
