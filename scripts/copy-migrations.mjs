import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const source = join(process.cwd(), 'src', 'main', 'db', 'migrations')
const destination = join(process.cwd(), 'out', 'main', 'migrations')

if (!existsSync(source)) {
  throw new Error(`Migration source does not exist: ${source}`)
}

mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })
