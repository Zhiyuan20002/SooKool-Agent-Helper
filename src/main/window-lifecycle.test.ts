import assert from 'node:assert/strict'
import test from 'node:test'
import { focusExistingWindow, type FocusableWindow } from './window-lifecycle.ts'

function createWindow(minimized: boolean): { window: FocusableWindow; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    window: {
      isMinimized: () => minimized,
      restore: () => calls.push('restore'),
      show: () => calls.push('show'),
      focus: () => calls.push('focus')
    }
  }
}

test('restores and focuses the existing window for a second app launch', () => {
  const { window, calls } = createWindow(true)

  assert.equal(focusExistingWindow([window]), true)
  assert.deepEqual(calls, ['restore', 'show', 'focus'])
})

test('does not create or focus a window when none exists yet', () => {
  assert.equal(focusExistingWindow([]), false)
})
