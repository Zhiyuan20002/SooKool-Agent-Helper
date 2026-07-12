export interface CatalogIdentityRecord {
  sourcePath: string
}

export function mergeCatalogRecords<T extends CatalogIdentityRecord>(records: T[]): T[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const key = record.sourcePath.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
