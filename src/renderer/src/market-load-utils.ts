export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (limit < 1) throw new Error('Concurrency limit must be at least 1.')
  let cursor = 0
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
}

export interface MarketTaskScheduler {
  schedule<T>(task: () => Promise<T>, priority?: 'high' | 'normal' | 'low'): Promise<T>
}

export interface MarketResultCollector<T> {
  add(items: T[]): void
  flush(): void
  snapshot(): T[]
}

export interface BoundedMarketCache<K, V> {
  get(key: K): V | undefined
  set(key: K, value: V): void
  delete(key: K): void
  clear(): void
  readonly size: number
}

export function createBoundedMarketCache<K, V>(limit: number): BoundedMarketCache<K, V> {
  if (limit < 1) throw new Error('Cache limit must be at least 1.')
  const entries = new Map<K, V>()
  return {
    get(key): V | undefined {
      const value = entries.get(key)
      if (value === undefined) return undefined
      entries.delete(key)
      entries.set(key, value)
      return value
    },
    set(key, value): void {
      entries.delete(key)
      entries.set(key, value)
      while (entries.size > limit) entries.delete(entries.keys().next().value as K)
    },
    delete: (key) => { entries.delete(key) },
    clear: () => entries.clear(),
    get size() { return entries.size }
  }
}

export function createMarketResultCollector<T>(
  keyOf: (item: T) => string,
  publish: (items: T[]) => void,
  scheduleFlush: (flush: () => void) => void = (flush) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush)
    else queueMicrotask(flush)
  }
): MarketResultCollector<T> {
  const items = new Map<string, T>()
  let scheduled = false
  let dirty = false

  const flush = (): void => {
    scheduled = false
    if (!dirty) return
    dirty = false
    publish([...items.values()])
  }

  return {
    add(nextItems: T[]): void {
      if (!nextItems.length) return
      for (const item of nextItems) items.set(keyOf(item), item)
      dirty = true
      if (scheduled) return
      scheduled = true
      scheduleFlush(flush)
    },
    flush,
    snapshot: () => [...items.values()]
  }
}

export function createMarketTaskScheduler(limit: number): MarketTaskScheduler {
  if (limit < 1) throw new Error('Concurrency limit must be at least 1.')
  let active = 0
  let activeLow = 0
  const queues: Record<'high' | 'normal' | 'low', Array<() => void>> = {
    high: [],
    normal: [],
    low: []
  }

  function drain(): void {
    while (active < limit) {
      const next = queues.high.shift() || queues.normal.shift() || (activeLow === 0 ? queues.low.shift() : undefined)
      if (!next) return
      next()
    }
  }

  function release(priority: 'high' | 'normal' | 'low'): void {
    active -= 1
    if (priority === 'low') activeLow -= 1
    drain()
  }

  return {
    schedule<T>(task: () => Promise<T>, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = (): void => {
          active += 1
          if (priority === 'low') activeLow += 1
          void Promise.resolve().then(task).then(resolve, reject).finally(() => release(priority))
        }
        queues[priority].push(start)
        drain()
      })
    }
  }
}
