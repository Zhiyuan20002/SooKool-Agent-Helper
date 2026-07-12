export interface MarketHighlightSegment {
  text: string
  matched: boolean
}

export function splitMarketHighlight(text: string, query: string): MarketHighlightSegment[] {
  const terms = [...new Set(query.trim().split(/\s+/).map((term) => term.toLocaleLowerCase()).filter(Boolean))]
    .sort((left, right) => right.length - left.length)
  if (!terms.length || !text) return [{ text, matched: false }]

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const matcher = new RegExp(`(${escaped.join('|')})`, 'giu')
  const termSet = new Set(terms)
  return text
    .split(matcher)
    .filter(Boolean)
    .map((part) => ({ text: part, matched: termSet.has(part.toLocaleLowerCase()) }))
}
