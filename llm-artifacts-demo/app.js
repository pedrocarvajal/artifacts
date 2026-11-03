const button = document.getElementById("action")
const message = document.getElementById("message")
let count = 0
button.addEventListener("click", () => {
  count += 1
  message.textContent = `Clicked ${count} time${count === 1 ? "" : "s"}.`
})
