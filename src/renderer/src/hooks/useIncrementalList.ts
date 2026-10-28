import { useEffect, useState } from 'react'

/**
 * Shows a long list a page at a time: the first `pageSize` items, then more whenever the
 * sentinel element (put it after the list) comes near the screen. A new `items` array starts
 * again from the first page. Keeps big collections and journals quick to open.
 */
export function useIncrementalList<T>(
  items: readonly T[],
  pageSize: number
): { visible: readonly T[]; hasMore: boolean; sentinel: (element: Element | null) => void } {
  const [shown, setShown] = useState({ items, count: pageSize })
  // A new list (new search or filter): back to the first page, adjusted during render.
  if (shown.items !== items) setShown({ items, count: pageSize })
  const count = shown.items === items ? shown.count : pageSize

  const [node, setNode] = useState<Element | null>(null)
  const hasMore = count < items.length

  useEffect(() => {
    if (!node || !hasMore) return
    // Recreated after every page, so a sentinel that's still on screen loads the next one too.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          setShown((current) => ({ ...current, count: current.count + pageSize }))
      },
      { rootMargin: '800px 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, hasMore, count, pageSize])

  return { visible: items.slice(0, count), hasMore, sentinel: setNode }
}
