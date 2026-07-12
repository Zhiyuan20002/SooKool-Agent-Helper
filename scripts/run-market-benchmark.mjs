import { build } from 'esbuild'
import { rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const output = join(tmpdir(), `sookool-market-benchmark-${process.pid}.cjs`)
try {
  await build({
    entryPoints: ['scripts/benchmark-market-performance.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile: output,
    external: ['electron'],
    logLevel: 'silent'
  })
  await import(pathToFileURL(output).href)
} finally {
  await rm(output, { force: true })
}
