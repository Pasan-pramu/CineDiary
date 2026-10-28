import { z } from 'zod'
import { handle } from '../logs'
import { globalSearch } from '../services/search'

export function registerSearchHandlers(): void {
  handle('search:global', (_event, text: unknown) => globalSearch(z.string().max(200).parse(text)))
}
