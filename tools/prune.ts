import { existsSync, readdirSync, readFileSync, rmSync, unlinkSync } from "node:fs"
import { join, resolve, sep } from "node:path"

type Metadata = {
  slug: string
  expires_at?: string
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")

  if (!args.includes("--expired")) {
    process.stderr.write("usage: bun tools/prune.ts --expired [--dry-run]\n")
    process.exitCode = 2
    return
  }

  const root = process.cwd()
  const metaDirectory = join(root, "_meta")
  if (!existsSync(metaDirectory)) return

  const now = Date.now()
  let removed = 0

  for (const name of readdirSync(metaDirectory).sort()) {
    if (!name.endsWith(".json")) continue
    const metaPath = join(metaDirectory, name)
    const value: unknown = JSON.parse(readFileSync(metaPath, "utf8"))
    if (!isMetadata(value)) {
      process.stderr.write(`prune: skipping invalid metadata ${metaPath}\n`)
      continue
    }
    if (!SLUG_PATTERN.test(value.slug)) {
      process.stderr.write(`prune: skipping unsafe slug ${JSON.stringify(value.slug)}\n`)
      continue
    }
    if (value.expires_at === undefined) continue
    if (new Date(value.expires_at).getTime() > now) continue

    const directory = resolve(root, value.slug)
    if (directory !== resolve(root) && !directory.startsWith(`${resolve(root)}${sep}`)) {
      process.stderr.write(`prune: refusing to remove ${directory}\n`)
      continue
    }

    process.stdout.write(`${dryRun ? "would remove" : "removed"} ${value.slug}\n`)
    if (!dryRun) {
      rmSync(directory, { recursive: true, force: true })
      unlinkSync(metaPath)
    }
    removed += 1
  }

  process.stdout.write(`prune: ${removed} expired artifacts\n`)
}

function isMetadata(value: unknown): value is Metadata {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.slug === "string"
}

main()
