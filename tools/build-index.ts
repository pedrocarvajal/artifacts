import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

type Metadata = {
  slug: string
  title: string
  description?: string
  updated_at: string
  expires_at?: string
  revision: number
}

export function readMetadata(directory: string): Metadata[] {
  if (!existsSync(directory)) return []
  const entries = readdirSync(directory, { withFileTypes: true })
  const metadata: Metadata[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue
    const path = join(directory, entry.name)
    const value: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (!isMetadata(value)) {
      throw new Error(`${path} is not valid artifact metadata`)
    }
    metadata.push(value)
  }

  return metadata
}

export function renderIndex(metadata: Metadata[], now = new Date()): string {
  const sorted = [...metadata].sort((left, right) => {
    const leftExpired = isExpired(left, now)
    const rightExpired = isExpired(right, now)
    if (leftExpired !== rightExpired) return leftExpired ? 1 : -1
    return right.updated_at.localeCompare(left.updated_at)
  })

  const cards = sorted.map((item) => renderCard(item, now)).join("\n")
  const count = sorted.length
  const label = count === 1 ? "artifact" : "artifacts"

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Artifacts</title>
<style>
:root { color-scheme: light dark; --fg: #111; --muted: #666; --bg: #fff; --card: #f6f6f4; --line: #e2e2de; --accent: #0b5fff; }
@media (prefers-color-scheme: dark) { :root { --fg: #f2f2ef; --muted: #a1a1a0; --bg: #111; --card: #1a1a1a; --line: #2a2a2a; --accent: #7aa7ff; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem 1.25rem 4rem; background: var(--bg); color: var(--fg); font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
main { max-width: 760px; margin: 0 auto; }
header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
h1 { font-size: 1.6rem; margin: 0; letter-spacing: -0.02em; }
.count { color: var(--muted); font-size: 0.9rem; }
input { width: 100%; padding: 0.7rem 0.9rem; margin-bottom: 1.25rem; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--fg); font: inherit; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
li { border: 1px solid var(--line); border-radius: 12px; padding: 1rem 1.1rem; background: var(--card); }
li[hidden] { display: none; }
a { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 1.05rem; }
a:hover { text-decoration: underline; }
p { margin: 0.35rem 0 0; color: var(--muted); }
.meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.6rem; color: var(--muted); font-size: 0.8rem; }
.expired { color: #b45309; font-weight: 600; }
.empty { color: var(--muted); }
</style>
</head>
<body>
<main>
<header><h1>Artifacts</h1><span class="count">${count} ${label}</span></header>
<input id="filter" type="search" placeholder="Filter by title or slug" autocomplete="off">
${count === 0 ? '<p class="empty">No artifacts yet.</p>' : `<ul id="list">\n${cards}\n</ul>`}
</main>
<script>
const input = document.getElementById("filter");
const items = [...document.querySelectorAll("#list li")];
if (input) {
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    for (const item of items) {
      item.hidden = query.length > 0 && !item.dataset.search.includes(query);
    }
  });
}
</script>
</body>
</html>
`
}

function renderCard(item: Metadata, now: Date): string {
  const expired = isExpired(item, now)
  const description =
    item.description === undefined || item.description.length === 0
      ? ""
      : `<p>${escapeHtml(item.description)}</p>`
  const badge = expired ? ' <span class="expired">expired</span>' : ""

  return `<li data-search="${escapeHtml(`${item.title} ${item.slug}`.toLowerCase())}">
<a href="./${encodeURIComponent(item.slug)}/">${escapeHtml(item.title)}</a>${badge}
${description}
<div class="meta"><span>/${escapeHtml(item.slug)}/</span><span>revision ${item.revision}</span><span>updated ${escapeHtml(item.updated_at.slice(0, 10))}</span></div>
</li>`
}

function isExpired(item: Metadata, now: Date): boolean {
  if (item.expires_at === undefined) return false
  return new Date(item.expires_at).getTime() <= now.getTime()
}

function isMetadata(value: unknown): value is Metadata {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.slug === "string" &&
    typeof record.title === "string" &&
    typeof record.updated_at === "string" &&
    typeof record.revision === "number"
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function main(): void {
  const args = process.argv.slice(2)
  const metaDirectory = option(args, "--meta") ?? "_meta"
  const output = option(args, "--out") ?? "_site/index.html"
  const metadata = readMetadata(metaDirectory)
  writeFileSync(output, renderIndex(metadata), "utf8")
  process.stdout.write(`index: ${metadata.length} artifacts -> ${output}\n`)
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
