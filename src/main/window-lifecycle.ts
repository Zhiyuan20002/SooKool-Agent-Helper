export interface FocusableWindow {
  isMinimized(): boolean
  restore(): void
  show(): void
  focus(): void
}

export function focusExistingWindow(windows: FocusableWindow[]): boolean {
  const window = windows[0]
  if (!window) return false
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  return true
}
