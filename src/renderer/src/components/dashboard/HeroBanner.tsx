import { useState } from 'react'

interface HeroBannerProps {
  greeting: string
  subtitle: string
  /** Custom banner from Settings; the built-in sunset design is used when null. */
  bannerFile: string | null
  /** Buttons shown under the greeting (e.g. Quick Add). */
  children?: React.ReactNode
}

/** Layered ridges drawn on a 1200×240 canvas; the walker stands on the near peak. */
function BuiltInScene(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at 78% 92%, var(--color-hero-sun) 0%, var(--color-hero-glow) 14%, transparent 42%),
          linear-gradient(180deg, var(--color-hero-sky-top) 0%, var(--color-hero-sky-mid) 58%, var(--color-hero-glow) 100%)`
      }}
    >
      <svg
        viewBox="0 0 1200 240"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 size-full"
      >
        <path
          style={{ fill: 'var(--color-hero-ridge-far)' }}
          d="M0 170 L120 130 L230 155 L360 105 L470 140 L600 95 L720 135 L850 100 L980 140 L1100 115 L1200 135 L1200 240 L0 240 Z"
        />
        <path
          style={{ fill: 'var(--color-hero-ridge-mid)' }}
          d="M0 195 L140 160 L260 185 L400 150 L520 180 L660 145 L790 175 L900 150 L1040 185 L1200 160 L1200 240 L0 240 Z"
        />
        <path
          style={{ fill: 'var(--color-hero-ridge-near)' }}
          d="M0 225 L180 200 L330 215 L520 192 L700 212 L860 188 L950 176 L1010 190 L1200 205 L1200 240 L0 240 Z"
        />
        <g style={{ fill: 'var(--color-hero-ridge-near)' }}>
          <circle cx="950" cy="151" r="4.5" />
          <path d="M945.5 157 h9 l1.5 12 h-3 l-1 8 h-5 l-1 -8 h-3 Z" />
        </g>
      </svg>
    </div>
  )
}

function HeroBanner({
  greeting,
  subtitle,
  bannerFile,
  children
}: HeroBannerProps): React.JSX.Element {
  const [failedFile, setFailedFile] = useState<string | null>(null)
  const showImage = bannerFile !== null && failedFile !== bannerFile
  return (
    <section className="relative isolate overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)]">
      {showImage ? (
        <img
          src={`banner://current?v=${encodeURIComponent(bannerFile)}`}
          alt=""
          onError={() => setFailedFile(bannerFile)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <BuiltInScene />
      )}
      {/* Keeps the text readable: a custom image always gets a dark fade and white text; the
          built-in scene follows the theme (sunset with white text, or dawn with dark text). */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, ${showImage ? 'var(--color-hero-image-fade)' : 'var(--color-hero-fade)'}, transparent 70%)`
        }}
      />
      <div
        className="relative flex min-h-56 flex-col justify-center gap-5 px-8 py-8 sm:px-10"
        style={{ color: showImage ? 'var(--color-hero-image-text)' : 'var(--color-hero-text)' }}
      >
        <div>
          <h1 className="font-display text-[34px] leading-tight">{greeting}</h1>
          <p
            className="mt-2 max-w-xl text-sm leading-6"
            style={{
              color: showImage
                ? 'var(--color-hero-image-text-muted)'
                : 'var(--color-hero-text-muted)'
            }}
          >
            {subtitle}
          </p>
        </div>
        {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
      </div>
      <p
        className="font-display absolute right-8 top-6 hidden text-right text-lg leading-snug lg:block"
        style={{
          color: showImage ? 'var(--color-hero-image-text-muted)' : 'var(--color-hero-text-muted)'
        }}
      >
        Good stories.
        <br />
        Better days.
      </p>
    </section>
  )
}

export default HeroBanner
