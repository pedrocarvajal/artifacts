const root = document.documentElement
const media = window.matchMedia("(prefers-color-scheme: dark)")
const themeButton = document.getElementById("theme")
const copyButton = document.getElementById("copy")
const status = document.getElementById("status")
const countOutput = document.getElementById("count")
const decrement = document.getElementById("decrement")
const increment = document.getElementById("increment")

let userPickedTheme = false

root.dataset.theme = media.matches ? "dark" : "light"
updateThemeLabel()

themeButton.addEventListener("click", () => {
  userPickedTheme = true
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark"
  updateThemeLabel()
})

media.addEventListener("change", (event) => {
  if (userPickedTheme) return
  root.dataset.theme = event.matches ? "dark" : "light"
  updateThemeLabel()
})

function updateThemeLabel() {
  const next = root.dataset.theme === "dark" ? "claro" : "oscuro"
  themeButton.setAttribute("aria-label", `Cambiar al tema ${next}`)
  themeButton.setAttribute("title", `Cambiar al tema ${next}`)
}

let statusTimer
copyButton.addEventListener("click", async () => {
  const url = `${window.location.origin}${window.location.pathname}`
  try {
    await navigator.clipboard.writeText(url)
    showStatus(`URL copiada: ${url}`)
  } catch {
    copyFallback(url)
  }
})

function copyFallback(text) {
  const field = document.createElement("textarea")
  field.value = text
  field.setAttribute("readonly", "")
  field.style.position = "fixed"
  field.style.opacity = "0"
  document.body.append(field)
  field.select()
  const copied = document.execCommand("copy")
  field.remove()
  showStatus(copied ? `URL copiada: ${text}` : text)
}

function showStatus(message) {
  status.textContent = message
  window.clearTimeout(statusTimer)
  statusTimer = window.setTimeout(() => {
    status.textContent = ""
  }, 4000)
}

let count = 0

function setCount(next) {
  count = Math.min(99, Math.max(0, next))
  countOutput.textContent = String(count)
}

decrement.addEventListener("click", () => setCount(count - 1))
increment.addEventListener("click", () => setCount(count + 1))

document.getElementById("year").textContent = String(new Date().getFullYear())
