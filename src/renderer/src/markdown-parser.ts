export type MarkdownAlignment = 'left' | 'center' | 'right'

export type MarkdownBlock =
  | { type: 'frontmatter' | 'code' | 'paragraph' | 'quote'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; alignments: MarkdownAlignment[]; rows: string[][] }
  | { type: 'rule' }

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, lineIndex) => lineIndex > 0 && line.trim() === '---')
    if (end > 0) {
      blocks.push({ type: 'frontmatter', content: lines.slice(0, end + 1).join('\n') })
      index = end + 1
    }
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) { index += 1; continue }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] })
      index += 1
      continue
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index])
      const delimiters = splitTableRow(lines[index + 1])
      const alignments = delimiters.map(parseAlignment)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].trim() && hasUnescapedPipe(lines[index])) {
        const cells = splitTableRow(lines[index])
        rows.push(headers.map((_, cellIndex) => cells[cellIndex] || ''))
        index += 1
      }
      blocks.push({ type: 'table', headers, alignments, rows })
      continue
    }

    if (isHorizontalRule(trimmed)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', content: quoteLines.join(' ') })
      continue
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].trim()
        const marker = ordered ? /^\d+\.\s+(.+)$/.exec(item) : /^[-*]\s+(.+)$/.exec(item)
        if (!marker) break
        items.push(marker[1])
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const next = lines[index].trim()
      if (
        !next || next.startsWith('```') || /^#{1,6}\s+/.test(next) ||
        /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next) || next.startsWith('>') ||
        isHorizontalRule(next) || isTableStart(lines, index)
      ) break
      paragraphLines.push(next)
      index += 1
    }
    blocks.push({ type: 'paragraph', content: paragraphLines.join(' ') })
  }
  return blocks
}

function isTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length || !hasUnescapedPipe(lines[index])) return false
  const headers = splitTableRow(lines[index])
  const delimiters = splitTableRow(lines[index + 1])
  return headers.length > 0 && headers.length === delimiters.length &&
    delimiters.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let cell = ''
  let escaped = false
  for (const character of trimmed) {
    if (escaped) { cell += character; escaped = false; continue }
    if (character === '\\') { escaped = true; cell += character; continue }
    if (character === '|') { cells.push(cell.trim()); cell = ''; continue }
    cell += character
  }
  cells.push(cell.trim())
  return cells
}

function hasUnescapedPipe(line: string): boolean {
  return /(^|[^\\])\|/.test(line)
}

function parseAlignment(delimiter: string): MarkdownAlignment {
  const value = delimiter.trim()
  if (value.startsWith(':') && value.endsWith(':')) return 'center'
  if (value.endsWith(':')) return 'right'
  return 'left'
}

function isHorizontalRule(line: string): boolean {
  return /^(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)
}
