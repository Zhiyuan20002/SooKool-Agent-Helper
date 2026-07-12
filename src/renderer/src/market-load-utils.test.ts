import assert from 'node:assert/strict'
import test from 'node:test'
import { createBoundedMarketCache, createMarketResultCollector, createMarketTaskScheduler, runWithConcurrency } from './market-load-utils.ts'

test('limits concurrent market loads', async () => {
  let active = 0
  let peak = 0
  const completed: number[] = []

  await runWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (item) => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    completed.push(item)
    active -= 1
  })

  assert.equal(peak, 3)
  assert.deepEqual(completed.sort((left, right) => left - right), [1, 2, 3, 4, 5, 6])
})

test('shares one concurrency ceiling across unrelated market tasks', async () => {
  const scheduler = createMarketTaskScheduler(3)
  let active = 0
  let peak = 0
  const task = async (): Promise<void> => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
  }

  await Promise.all(Array.from({ length: 9 }, () => scheduler.schedule(task)))
  assert.equal(peak, 3)
})

test('releases a scheduler slot when a task throws synchronously', async () => {
  const scheduler = createMarketTaskScheduler(1)
  const failed = scheduler.schedule(() => { throw new Error('boom') })
  const next = scheduler.schedule(async () => 'continued')

  await assert.rejects(failed, /boom/)
  assert.equal(await next, 'continued')
})

test('runs at most one low-priority preload so user work keeps spare capacity', async () => {
  const scheduler = createMarketTaskScheduler(3)
  let activeLow = 0
  let peakLow = 0
  let releaseLow: (() => void) | undefined
  const gate = new Promise<void>((resolve) => { releaseLow = resolve })

  const lowTasks = Array.from({ length: 3 }, () => scheduler.schedule(async () => {
    activeLow += 1
    peakLow = Math.max(peakLow, activeLow)
    await gate
    activeLow -= 1
  }, 'low'))

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(peakLow, 1)
  releaseLow?.()
  await Promise.all(lowTasks)
})

test('deduplicates progressive results incrementally and coalesces publication', () => {
  const scheduled: Array<() => void> = []
  const published: Array<Array<{ id: string; name: string }>> = []
  const collector = createMarketResultCollector(
    (item: { id: string; name: string }) => item.id,
    (items) => published.push(items),
    (flush) => scheduled.push(flush)
  )

  collector.add([{ id: 'a', name: 'first' }, { id: 'b', name: 'second' }])
  collector.add([{ id: 'a', name: 'duplicate' }, { id: 'c', name: 'third' }])
  assert.equal(scheduled.length, 1)
  scheduled[0]()
  assert.deepEqual(published, [[
    { id: 'a', name: 'duplicate' },
    { id: 'b', name: 'second' },
    { id: 'c', name: 'third' }
  ]])
})

test('bounds renderer catalog memory and keeps recently used entries', () => {
  const cache = createBoundedMarketCache<string, number>(2)
  cache.set('a', 1)
  cache.set('b', 2)
  assert.equal(cache.get('a'), 1)
  cache.set('c', 3)

  assert.equal(cache.size, 2)
  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.get('a'), 1)
  assert.equal(cache.get('c'), 3)
})
