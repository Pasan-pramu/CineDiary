import { HeartPulse } from 'lucide-react'
import type { DistributionItem, FeelingsAnalysis, InsightsPeriod } from '../../../../shared/types'
import SectionHeading from '../SectionHeading'
import SectionPanel from '../SectionPanel'
import TopOverTimeChart from '../charts/TopOverTimeChart'
import { topAfterSentence, topFeelingSentence, topReasonSentence } from '../insightSentences'
import DistributionList from './DistributionList'

// Insights → Feelings: how I felt before and after watching, and why I watched (M10c).

function journalLink(param: 'mood' | 'reason', value: string, period: InsightsPeriod): string {
  const params = new URLSearchParams({ [param]: value })
  if (typeof period !== 'string' && period.kind === 'chapter') {
    params.set('chapter', String(period.chapterId))
  }
  return `/journal?${params.toString()}`
}

function firstRecorded(items: DistributionItem[]): DistributionItem | undefined {
  return items.find((item) => item.key !== null)
}

function FeelingsSection({
  feelings,
  period
}: {
  feelings: FeelingsAnalysis
  period: InsightsPeriod
}): React.JSX.Element {
  const topReason = firstRecorded(feelings.reasons.items)
  const topBefore = firstRecorded(feelings.moodBefore.items)
  const topAfter = firstRecorded(feelings.moodAfter.items)
  const sentences = [
    topReason ? topReasonSentence(topReason) : null,
    topBefore ? topFeelingSentence(topBefore) : null,
    topAfter ? topAfterSentence(topAfter) : null
  ].filter((sentence): sentence is string => sentence !== null)
  const total = feelings.moodBefore.total

  return (
    <section className="space-y-6 pt-2">
      <div>
        <SectionHeading>Feelings</SectionHeading>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          How you felt before and after watching, and why you pressed play. Shares are of all{' '}
          {total.toLocaleString()} {total === 1 ? 'watch' : 'watches'} in this period, including
          ones where nothing was recorded.
        </p>
      </div>

      {sentences.length ? (
        <ul className="space-y-2 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          {sentences.map((sentence) => (
            <li
              key={sentence}
              className="flex gap-3 text-sm leading-6 text-[var(--color-text-secondary)]"
            >
              <HeartPulse size={18} className="mt-0.5 shrink-0 text-[var(--color-accent-light)]" />
              {sentence}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionPanel title="How you felt before">
          <DistributionList
            distribution={feelings.moodBefore}
            showChange
            linkFor={(item) => (item.key ? journalLink('mood', item.key, period) : null)}
            emptyText="No watches in this period."
          />
        </SectionPanel>
        <SectionPanel title="How you felt after">
          <DistributionList
            distribution={feelings.moodAfter}
            emptyText="No watches in this period."
          />
        </SectionPanel>
        <SectionPanel title="Why you watched">
          <DistributionList
            distribution={feelings.reasons}
            showChange
            linkFor={(item) =>
              item.reasonId !== null ? journalLink('reason', String(item.reasonId), period) : null
            }
            emptyText="No watches in this period."
          />
          {feelings.reasons.total > 0 ? (
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">
              A watch can have more than one reason, so these can add up to more than 100%.
            </p>
          ) : null}
        </SectionPanel>
      </div>

      <SectionPanel
        title="Over time"
        action={
          <span className="text-xs text-[var(--color-text-muted)]">
            Top 5 per {feelings.feelingsOverTime.bucket}
          </span>
        }
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Feelings before watching
            </h3>
            <TopOverTimeChart
              data={feelings.feelingsOverTime}
              tone="moodBefore"
              notRecordedLabel="watches without a recorded feeling"
            />
          </div>
          <div>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Reasons
            </h3>
            <TopOverTimeChart
              data={feelings.reasonsOverTime}
              tone="movies"
              notRecordedLabel="watches without a reason"
            />
          </div>
        </div>
      </SectionPanel>
    </section>
  )
}

export default FeelingsSection
