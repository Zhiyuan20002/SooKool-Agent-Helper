import type { MarketPreviewFile } from './types/ecosystem'

export interface MarketFileTreeNode {
  name: string
  relativePath: string
  type: 'directory' | 'file'
  file?: MarketPreviewFile
  children?: MarketFileTreeNode[]
}

export function buildMarketFileTree(files: MarketPreviewFile[]): MarketFileTreeNode[] {
  const root: MarketFileTreeNode[] = []
  for (const file of files) {
    const parts = file.relativePath.split('/').filter(Boolean)
    let level = root
    parts.forEach((part, index) => {
      const relativePath = parts.slice(0, index + 1).join('/')
      if (index === parts.length - 1) {
        level.push({ name: part, relativePath, type: 'file', file })
        return
      }
      let directory = level.find((node) => node.type === 'directory' && node.name === part)
      if (!directory) {
        directory = { name: part, relativePath, type: 'directory', children: [] }
        level.push(directory)
      }
      level = directory.children!
    })
  }
  const sort = (nodes: MarketFileTreeNode[]): MarketFileTreeNode[] => nodes
    .sort((a,b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
    .map((node) => ({ ...node, children: node.children ? sort(node.children) : undefined }))
  return sort(root)
}
