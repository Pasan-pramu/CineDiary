/* eslint-disable @typescript-eslint/explicit-function-return-type -- a plain JS dev script */
// Makes every icon and installer image from one picture: build/icon-source.png.
// To change the icon, replace that file and run `npm run icons` (build:win runs it too).
// Run with `node scripts/make-icons.mjs`: it starts itself again under Electron to use
// nativeImage, so no image library is needed. Bitmaps from nativeImage are BGRA with
// premultiplied alpha.
//
// Writes:
//   build/icon.ico, build/icon.png           exe, installer, shortcuts (electron-builder)
//   resources/icon.ico, resources/icon.png   the window and taskbar icon (also in dev)
//   build/installerSidebar.bmp  164×314      installer welcome/finish pages
//   build/installerHeader.bmp   150×57       installer inner pages (top right)
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const SOURCE = join(root, 'build', 'icon-source.png')
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
/** Pixels at or below this alpha are stray noise around the tile, not part of the logo. */
const ALPHA_THRESHOLD = 16
/** Transparent margin around the tile, as a share of its size (taskbar icons look alike). */
const PADDING = 0.04

// Brand colors (DESIGN.md): app background and the accent purple.
const NAVY = [11, 16, 32]
const DEEP_PURPLE = [42, 27, 110]
const ACCENT = [118, 86, 250]

/** The tile without its empty margin: cropped to the opaque pixels, squared, small padding. */
function trimmedMaster() {
  const source = nativeImage.createFromPath(SOURCE)
  if (source.isEmpty()) throw new Error(`Can't read ${SOURCE}`)
  const { width, height } = source.getSize()
  const pixels = source.toBitmap()

  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] <= ALPHA_THRESHOLD) {
        pixels.fill(0, i, i + 4) // clears the faint noise outside the tile
        continue
      }
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < 0) throw new Error('The icon source is fully transparent')

  const tileWidth = right - left + 1
  const tileHeight = bottom - top + 1
  const side = Math.round(Math.max(tileWidth, tileHeight) * (1 + 2 * PADDING))
  const out = Buffer.alloc(side * side * 4)
  const offsetX = Math.floor((side - tileWidth) / 2)
  const offsetY = Math.floor((side - tileHeight) / 2)
  for (let y = 0; y < tileHeight; y++) {
    const from = ((top + y) * width + left) * 4
    pixels.copy(out, ((offsetY + y) * side + offsetX) * 4, from, from + tileWidth * 4)
  }
  return nativeImage.createFromBitmap(out, { width: side, height: side })
}

/** Halves step by step before the last resize, which keeps small sizes crisp. */
function resized(image, size) {
  let current = image
  while (current.getSize().width >= size * 4) {
    const half = Math.round(current.getSize().width / 2)
    current = current.resize({ width: half, height: half, quality: 'best' })
  }
  return current.resize({ width: size, height: size, quality: 'best' })
}

/** A .ico holding PNG images (supported since Windows Vista). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // icon
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index
    header.writeUInt8(size >= 256 ? 0 : size, entry) // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4) // color planes
    header.writeUInt16LE(32, entry + 6) // bits per pixel
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((image) => image.png)])
}

const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t)

/**
 * An installer image: `background(x, y)` gives each pixel's RGB, then the logo is laid on top.
 * Saved as a 24-bit BMP (the only format NSIS takes).
 */
function installerImage(width, height, background, logo) {
  const logoImage = resized(logo.image, logo.size)
  const logoPixels = logoImage.toBitmap()
  const rowBytes = Math.ceil((width * 3) / 4) * 4
  const data = Buffer.alloc(rowBytes * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let [r, g, b] = background(x, y)
      const lx = x - logo.x
      const ly = y - logo.y
      if (lx >= 0 && ly >= 0 && lx < logo.size && ly < logo.size) {
        const i = (ly * logo.size + lx) * 4
        const keep = 1 - logoPixels[i + 3] / 255 // premultiplied: color + background × (1 − α)
        b = logoPixels[i] + b * keep
        g = logoPixels[i + 1] + g * keep
        r = logoPixels[i + 2] + r * keep
      }
      const at = (height - 1 - y) * rowBytes + x * 3 // BMP rows go bottom-up
      data[at] = Math.round(b)
      data[at + 1] = Math.round(g)
      data[at + 2] = Math.round(r)
    }
  }
  const header = Buffer.alloc(54)
  header.write('BM', 0, 'ascii')
  header.writeUInt32LE(54 + data.length, 2)
  header.writeUInt32LE(54, 10)
  header.writeUInt32LE(40, 14)
  header.writeInt32LE(width, 18)
  header.writeInt32LE(height, 22)
  header.writeUInt16LE(1, 26)
  header.writeUInt16LE(24, 28)
  header.writeUInt32LE(data.length, 34)
  header.writeInt32LE(2835, 38) // 72 dpi
  header.writeInt32LE(2835, 42)
  return Buffer.concat([header, data])
}

/** A soft accent glow around (cx, cy) on top of `base`. */
function glow(base, x, y, cx, cy, radius, strength) {
  const distance = Math.hypot(x - cx, y - cy) / radius
  return mix(base, ACCENT, strength * Math.max(0, 1 - distance) ** 2)
}

function main() {
  const master = trimmedMaster()
  const write = (path, bytes) => {
    writeFileSync(join(root, path), bytes)
    console.log(`  ${path}`)
  }

  const icon = ico(ICO_SIZES.map((size) => ({ size, png: resized(master, size).toPNG() })))
  const png512 = resized(master, 512).toPNG()
  console.log('Icons:')
  write('build/icon.ico', icon)
  write('build/icon.png', png512)
  write('resources/icon.ico', icon)
  write('resources/icon.png', png512)

  // Welcome/finish sidebar: deep purple at the top fading to the app's navy, logo in a glow.
  write(
    'build/installerSidebar.bmp',
    installerImage(
      164,
      314,
      (x, y) => glow(mix(DEEP_PURPLE, NAVY, y / 313), x, y, 82, 112, 120, 0.45),
      { image: master, size: 112, x: 26, y: 56 }
    )
  )
  // Header (top right of the inner pages): the same purple, navy towards the bottom left.
  write(
    'build/installerHeader.bmp',
    installerImage(
      150,
      57,
      (x, y) => glow(mix(NAVY, DEEP_PURPLE, (x / 149 + (56 - y) / 56) / 2), x, y, 118, 28, 70, 0.5),
      { image: master, size: 47, x: 95, y: 5 }
    )
  )
}

if (process.type !== 'browser') {
  // Plain Node (or ELECTRON_RUN_AS_NODE, which VS Code terminals set): rerun as an Electron app.
  const electron = createRequire(import.meta.url)('electron')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(electron, [import.meta.filename], { stdio: 'inherit', env })
  process.exit(result.status ?? 1)
}

const { app, nativeImage } = await import('electron')
app.setPath('userData', join(tmpdir(), 'cinediary-make-icons'))
app
  .whenReady()
  .then(() => {
    main()
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
