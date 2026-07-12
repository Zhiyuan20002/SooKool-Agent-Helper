import React from 'react'
import { ScrollShadow } from '@heroui/react'
import { parseMarkdownBlocks } from '@/markdown-parser'

export function MarkdownRenderer({
  content,
  className = 'markdown-preview-content',
  showFrontmatter = true
}: {
  content: string
  className?: string
  showFrontmatter?: boolean
}): React.JSX.Element {
  const blocks = parseMarkdownBlocks(content)
  return (
    <article className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'frontmatter') return showFrontmatter
          ? <ScrollShadow key={index} className="markdown-frontmatter" orientation="horizontal" size={24}><pre>{block.content}</pre></ScrollShadow>
          : null
        if (block.type === 'code') return <ScrollShadow key={index} className="markdown-code-block" orientation="horizontal" size={24}><pre><code>{block.content}</code></pre></ScrollShadow>
        if (block.type === 'heading') {
          const children = renderInlineMarkdown(block.content)
          if (block.level === 1) return <h1 key={index}>{children}</h1>
          if (block.level === 2) return <h2 key={index}>{children}</h2>
          if (block.level === 3) return <h3 key={index}>{children}</h3>
          return <h4 key={index}>{children}</h4>
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}</Tag>
        }
        if (block.type === 'quote') return <blockquote key={index}>{renderInlineMarkdown(block.content)}</blockquote>
        if (block.type === 'rule') return <hr key={index} />
        if (block.type === 'table') return (
          <ScrollShadow key={index} className="markdown-table-scroll" orientation="horizontal" size={24}>
            <table>
              <thead><tr>{block.headers.map((header, cellIndex) => <th key={cellIndex} style={{ textAlign: block.alignments[cellIndex] }}>{renderInlineMarkdown(header)}</th>)}</tr></thead>
              <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ textAlign: block.alignments[cellIndex] }}>{renderInlineMarkdown(cell)}</td>)}</tr>)}</tbody>
            </table>
          </ScrollShadow>
        )
        return <p key={index}>{renderInlineMarkdown(block.content)}</p>
      })}
    </article>
  )
}

function renderInlineMarkdown(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content))) {
    if (match.index > lastIndex) nodes.push(content.slice(lastIndex, match.index))
    const token = match[0]
    nodes.push(token.startsWith('`')
      ? <code key={`${match.index}-code`}>{token.slice(1, -1)}</code>
      : <strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>)
    lastIndex = match.index + token.length
  }
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex))
  return nodes
}
