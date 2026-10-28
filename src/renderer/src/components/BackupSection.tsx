import {
  Archive,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  History,
  Loader2,
  TriangleAlert
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { BackupStatus, RestorePreview } from '../../../shared/types'
import SectionPanel from './SectionPanel'
import { formatDateTime } from '../format'

const EVERY_DAYS = [1, 3, 7, 14, 30] as const

type Notice = { tone: 'good' | 'bad'; text: string } | null

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function NoticeLine({ notice }: { notice: Notice }): React.JSX.Element | null {
  if (!notice) return null
  return notice.tone === 'good' ? (
    <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--color-positive)]">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {notice.text}
    </p>
  ) : (
    <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--color-danger)]">
      <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {notice.text}
    </p>
  )
}

function SubHeading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{children}</h3>
}

/** Settings → Backup & Export: full backups, automatic backups, restore and exports. */
function BackupSection(): React.JSX.Element {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | 'export' | null>(null)
  const [backupNotice, setBackupNotice] = useState<Notice>(null)
  const [restoreNotice, setRestoreNotice] = useState<Notice>(null)
  const [exportNotice, setExportNotice] = useState<Notice>(null)
  const [folderNotice, setFolderNotice] = useState<Notice>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [understood, setUnderstood] = useState(false)

  useEffect(() => {
    void window.api.backup.status().then(setStatus)
  }, [])

  const backUp = (): void => {
    setBusy('backup')
    setBackupNotice(null)
    void window.api.backup
      .create()
      .then((result) => {
        if (result.ok) {
          const { counts } = result.data
          setBackupNotice({
            tone: 'good',
            text: `Backup saved and verified: ${result.data.file} (${count(counts.titles, 'title')}, ${count(counts.watchEntries, 'watch', 'watches')}, ${count(counts.posters, 'poster')}).`
          })
        } else if (!result.canceled) {
          setBackupNotice({ tone: 'bad', text: result.message })
        }
        return window.api.backup.status().then(setStatus)
      })
      .finally(() => setBusy(null))
  }

  const toggleAuto = (): void => {
    if (!status) return
    const next = !status.autoEnabled
    void (
      next && !status.autoFolder
        ? window.api.backup.chooseAutoFolder()
        : window.api.backup.setAuto({ enabled: next })
    ).then(setStatus)
  }

  const pickRestore = (): void => {
    setRestoreNotice(null)
    setPreview(null)
    setUnderstood(false)
    void window.api.backup.pickRestore().then((result) => {
      if (result.ok) setPreview(result.data)
      else if (!result.canceled) setRestoreNotice({ tone: 'bad', text: result.message })
    })
  }

  const cancelRestore = (): void => {
    setPreview(null)
    setUnderstood(false)
    void window.api.backup.cancelRestore()
  }

  const restore = (): void => {
    setBusy('restore')
    setRestoreNotice(null)
    // On success the app restarts, so this only comes back when something went wrong.
    void window.api.backup
      .restore()
      .then((result) => {
        if (!result.ok) {
          setRestoreNotice({ tone: 'bad', text: result.message })
          setPreview(null)
        }
      })
      .finally(() => setBusy(null))
  }

  const runExport = (kind: 'json' | 'csv'): void => {
    setBusy('export')
    setExportNotice(null)
    void (kind === 'json' ? window.api.backup.exportJson() : window.api.backup.exportCsv())
      .then((result) => {
        if (result.ok) setExportNotice({ tone: 'good', text: `Saved to ${result.data}` })
        else if (!result.canceled) setExportNotice({ tone: 'bad', text: result.message })
      })
      .finally(() => setBusy(null))
  }

  const openFolder = (which: 'data' | 'backups'): void => {
    setFolderNotice(null)
    void (
      which === 'data' ? window.api.backup.openDataFolder() : window.api.backup.openBackupsFolder()
    ).then((result) => {
      if (!result.ok) setFolderNotice({ tone: 'bad', text: result.message })
    })
  }

  return (
    <SectionPanel title="Backup & Export">
      <p className="mb-6 text-sm leading-6 text-[var(--color-text-muted)]">
        Your diary lives only on this computer. A backup is a single .zip with your database,
        posters, backdrops and banner — keep a copy somewhere safe.
      </p>

      {/* Full backup */}
      <div className="space-y-3">
        <SubHeading>Full backup</SubHeading>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={backUp}
            disabled={busy !== null}
            className="btn btn-primary"
          >
            {busy === 'backup' ? (
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Archive size={16} />
            )}
            {busy === 'backup' ? 'Backing up and verifying…' : 'Back up now'}
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            {status?.lastBackupAt
              ? `Last backup: ${formatDateTime(status.lastBackupAt)}`
              : 'No backup yet'}
          </span>
        </div>
        <NoticeLine notice={backupNotice} />
      </div>

      {/* Automatic backups */}
      <div className="mt-7 space-y-3 border-t border-[var(--color-border)] pt-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <SubHeading>Automatic backups</SubHeading>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
              When CineDiary starts and your last backup is older than the interval below, it makes
              one in your chosen folder. It keeps the last 10 automatic backups and only ever
              removes ones it made itself.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={status?.autoEnabled ?? false}
            aria-label="Automatic backups"
            onClick={toggleAuto}
            disabled={!status}
            className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
              status?.autoEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-panel-elevated)]'
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-[var(--color-on-accent)] shadow transition-all ${
                status?.autoEnabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        {status?.autoFolder ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2.5 text-[var(--color-text-secondary)]">
              {status.autoFolder}
            </span>
            <button
              type="button"
              onClick={() => void window.api.backup.chooseAutoFolder().then(setStatus)}
              className="btn btn-secondary"
            >
              Change folder
            </button>
            <label className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              Every
              <select
                value={status.autoEveryDays}
                onChange={(event) =>
                  void window.api.backup
                    .setAuto({
                      everyDays: Number(event.target.value) as (typeof EVERY_DAYS)[number]
                    })
                    .then(setStatus)
                }
                className="field"
              >
                {EVERY_DAYS.map((days) => (
                  <option key={days} value={days}>
                    {days === 1 ? '1 day' : `${days} days`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {status?.autoFolderInsideData ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-[var(--color-rating)]/10 px-4 py-3 text-sm leading-6 text-[var(--color-rating)]">
            <TriangleAlert size={16} className="mt-1 shrink-0" />
            This folder is inside CineDiary’s own data folder, so the backups would be lost together
            with your data. Choose a folder outside it, such as Documents or a synced OneDrive or
            Google Drive folder.
          </p>
        ) : null}
        {status?.lastAutoError ? (
          <NoticeLine
            notice={{ tone: 'bad', text: `Last automatic backup failed: ${status.lastAutoError}` }}
          />
        ) : null}
      </div>

      {/* Restore */}
      <div className="mt-7 space-y-3 border-t border-[var(--color-border)] pt-6">
        <SubHeading>Restore</SubHeading>
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          Replaces all your current data with a backup. A safety backup of your current data is made
          first, and if anything goes wrong your data is put back.
        </p>
        {preview ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)] p-4 text-sm">
            <p className="font-semibold text-[var(--color-text-primary)]">{preview.fileName}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[var(--color-text-secondary)]">
              <dt className="text-[var(--color-text-muted)]">Made on</dt>
              <dd>
                {formatDateTime(preview.createdAt)}
                {preview.kind !== 'manual' ? ` (${preview.kind})` : ''}
              </dd>
              <dt className="text-[var(--color-text-muted)]">App version</dt>
              <dd>{preview.appVersion}</dd>
              <dt className="text-[var(--color-text-muted)]">Contains</dt>
              <dd>
                {count(preview.counts.titles, 'title')},{' '}
                {count(preview.counts.watchEntries, 'watch', 'watches')},{' '}
                {count(preview.counts.posters, 'poster')},{' '}
                {count(preview.counts.backdrops, 'backdrop')}
              </dd>
            </dl>
            <label className="mt-4 flex items-start gap-3 text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                className="mt-1 accent-[var(--color-favorite)]"
              />
              I understand this replaces all my current data with this backup, and CineDiary will
              restart.
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={restore}
                disabled={!understood || busy !== null}
                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-favorite)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:opacity-90 disabled:opacity-50"
              >
                {busy === 'restore' ? (
                  <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <History size={16} />
                )}
                {busy === 'restore' ? 'Making a safety backup and restoring…' : 'Restore & restart'}
              </button>
              <button
                type="button"
                onClick={cancelRestore}
                disabled={busy !== null}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={pickRestore}
            disabled={busy !== null}
            className="btn btn-secondary"
          >
            <History size={16} /> Restore from backup…
          </button>
        )}
        <NoticeLine notice={restoreNotice} />
      </div>

      {/* Export */}
      <div className="mt-7 space-y-3 border-t border-[var(--color-border)] pt-6">
        <SubHeading>Export</SubHeading>
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">
          Your diary in readable formats: JSON with everything you logged, or a CSV of your watches
          for spreadsheets. Images and your TMDB token are never included.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => runExport('json')}
            disabled={busy !== null}
            className="btn btn-secondary"
          >
            <FileJson size={16} /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => runExport('csv')}
            disabled={busy !== null}
            className="btn btn-secondary"
          >
            <FileSpreadsheet size={16} /> Export watches (CSV)
          </button>
        </div>
        <NoticeLine notice={exportNotice} />
      </div>

      {/* Folders */}
      <div className="mt-7 flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-6">
        <button type="button" onClick={() => openFolder('data')} className="btn btn-secondary">
          <FolderOpen size={16} /> Open data folder
        </button>
        <button type="button" onClick={() => openFolder('backups')} className="btn btn-secondary">
          <FolderOpen size={16} /> Open backups folder
        </button>
      </div>
      <NoticeLine notice={folderNotice} />
    </SectionPanel>
  )
}

export default BackupSection
