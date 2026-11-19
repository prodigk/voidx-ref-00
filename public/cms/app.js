const $ = (id) => document.getElementById(id)
const state = { collections: {}, active: "projects", selected: -1, dirty: false, busy: false, query: "", filter: "all" }
let toastTimer

async function api(path, options = {}) {
  const response = await fetch("/cms/api/" + path, {
    credentials: "same-origin",
    headers: { "X-CMS-Request": "1", ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
    ...options,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || "Request failed.")
  return result
}
function toast(message, error = false) {
  const node = $("toast")
  node.textContent = message
  node.classList.toggle("error", error)
  node.classList.add("visible")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove("visible"), 4000)
}
function current() { return state.collections[state.active] }
function item() { return current()?.items[state.selected] }
function labelFor(entry, meta) { return entry[meta.title]?.trim() || "Untitled entry" }
function modified() {
  state.dirty = true
  $("save").disabled = false
  $("discard").disabled = false
  $("save-state").innerHTML = '<span class="save-indicator"></span><span>Unsaved changes</span>'
  $("save-state").classList.add("is-dirty")
}
function cleanState() {
  state.dirty = false
  $("save").disabled = true
  $("discard").disabled = true
  $("save-state").innerHTML = '<span class="save-indicator"></span><span>All changes saved</span>'
  $("save-state").classList.remove("is-dirty")
}
function canLeave() { return !state.dirty || window.confirm("Discard unsaved changes?") }
function make(tag, className, text) {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}
function renderNav() {
  const nav = $("collection-nav")
  nav.replaceChildren()
  for (const [id, collection] of Object.entries(state.collections)) {
    const button = make("button", "nav-item" + (id === state.active ? " active" : ""))
    button.type = "button"
    button.append(make("span", "nav-icon", "▤"), make("span", "nav-item-name", collection.meta.label), make("span", "nav-item-count", String(collection.items.length)))
    button.addEventListener("click", () => {
      if (state.active === id || !canLeave()) return
      if (state.dirty) reload().then(() => selectCollection(id)).catch((error) => toast(error.message, true))
      else selectCollection(id)
    })
    nav.append(button)
  }
}
function selectCollection(id) {
  state.active = id
  state.selected = -1
  state.query = ""
  state.filter = "all"
  $("search").value = ""
  $("status-filter").value = "all"
  cleanState()
  render()
}
const tableColumns = {
  projects: ["title", "_status", "slug", "category", "subtitle", "cover", "link", "year", "services"],
  playground: ["title", "_status", "category", "image"],
  carousel: ["title", "_status", "image"],
  services: ["title", "_status", "number", "description", "image"],
  awards: ["award", "_status", "category", "count"],
  team: ["name", "_status", "role", "social", "image"],
  plans: ["name", "_status", "hours", "features", "price"],
  faq: ["question", "_status", "answer"],
}
function columns() {
  const meta = current().meta
  return (tableColumns[state.active] || [meta.title, "_status"]).map(key => ({ key, label: key === "_status" ? "Status" : meta.fields.find(field => field.key === key)?.label || key, kind: meta.fields.find(field => field.key === key)?.kind }))
}
function cellValue(entry, column) {
  const value = entry[column.key]
  if (column.key === "_status") return make("span", "status-badge " + (entry._draft ? "draft" : "live"), entry._draft ? "Draft" : "Live")
  if (column.kind === "image") {
    const src = value?.src
    if (!src) return make("span", "empty-value", "—")
    const img = make("img", "table-thumbnail")
    img.src = src; img.alt = value.alt || ""; img.loading = "lazy"
    return img
  }
  const text = column.kind === "list" ? (value || []).join(", ") : column.kind === "richtext" ? String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : String(value || "")
  return make("span", text ? "cell-text" : "empty-value", text || "—")
}
function renderList() {
  const collection = current()
  document.querySelector(".content-table").dataset.collection = state.active
  const list = $("item-list")
  list.replaceChildren()
  const head = $("table-head")
  head.replaceChildren()
  const headers = make("tr")
  headers.append(make("th", "order-column", "#"))
  const cols = columns()
  for (const column of cols) headers.append(make("th", column.key === collection.meta.title ? "title-column" : "", column.label))
  head.append(headers)
  const query = state.query.toLowerCase()
  let visible = 0
  collection.items.forEach((entry, index) => {
    const title = labelFor(entry, collection.meta)
    if (state.filter === "draft" && !entry._draft || state.filter === "published" && entry._draft) return
    if (query && ![title, ...cols.map(column => typeof entry[column.key] === "string" ? entry[column.key] : "")].join(" ").toLowerCase().includes(query)) return
    visible += 1
    const row = make("tr", "item-row" + (index === state.selected ? " selected" : ""))
    row.tabIndex = 0
    row.setAttribute("aria-label", "Edit " + title)
    row.addEventListener("click", () => { state.selected = index; renderList(); renderEditor() })
    row.addEventListener("keydown", event => { if (event.key === "Enter") { state.selected = index; renderList(); renderEditor() } })
    const order = make("div", "order-buttons")
    for (const [direction, symbol] of [[-1, "↑"], [1, "↓"]]) {
      const button = make("button", "order-button", symbol)
      button.type = "button"
      button.title = direction < 0 ? "Move up" : "Move down"
      button.setAttribute("aria-label", button.title + " " + title)
      button.disabled = index + direction < 0 || index + direction >= collection.items.length
      button.addEventListener("click", (event) => {
        event.stopPropagation()
        const target = index + direction
        ;[collection.items[index], collection.items[target]] = [collection.items[target], collection.items[index]]
        if (state.selected === index) state.selected = target
        else if (state.selected === target) state.selected = index
        modified(); renderList(); renderEditor()
      })
      order.append(button)
    }
    const orderCell = make("td", "order-cell")
    orderCell.append(order)
    row.append(orderCell)
    for (const column of cols) {
      const cell = make("td", column.key === collection.meta.title ? "item-title-cell" : "")
      cell.append(cellValue(entry, column))
      row.append(cell)
    }
    list.append(row)
  })
  if (!list.childElementCount) {
    const row = make("tr")
    const cell = make("td", "list-empty", query || state.filter !== "all" ? "No matching items." : "No items yet. Add one to begin.")
    cell.colSpan = cols.length + 1
    row.append(cell); list.append(row)
  }
  $("visible-count").textContent = visible + (visible === 1 ? " item" : " items")
}
function render() {
  const collection = current()
  if (!collection) return
  $("breadcrumb-name").textContent = collection.meta.label.toUpperCase()
  $("collection-heading").textContent = collection.meta.label
  $("collection-description").textContent = collection.meta.description
  $("item-count").textContent = String(collection.items.length)
  renderNav(); renderList(); renderEditor()
}
function slugify(text) { return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) }
function renderField(field, entry, container) {
  const wrap = make("div", "field field-" + field.kind)
  const label = make("label", "field-label", field.label + (field.required ? " *" : ""))
  wrap.append(label)
  const key = field.key
  const update = (value) => { entry[key] = value; modified(); if (key === current().meta.title || key === "category") { renderList(); renderEditorHeader() } }
  if (field.kind === "text" || field.kind === "slug" || field.kind === "textarea") {
    const input = make(field.kind === "textarea" ? "textarea" : "input", "text-control")
    if (field.kind !== "textarea") input.type = "text"
    if (field.kind === "textarea") input.rows = 4
    input.value = entry[key] || ""
    input.placeholder = field.kind === "slug" ? "your-project-slug" : "Enter " + field.label.toLowerCase()
    input.addEventListener("input", () => update(input.value))
    label.append(input)
    if (field.kind === "slug") {
      const note = make("div", "field-note", "Used in the project URL. Lowercase letters, numbers, and hyphens.")
      wrap.append(note)
    }
  } else if (field.kind === "image") {
    const img = entry[key] || { src: "", alt: "" }
    entry[key] = img
    imageField(wrap, img, () => { modified(); renderList() })
  } else if (field.kind === "gallery") {
    if (!Array.isArray(entry[key])) entry[key] = []
    const gallery = make("div", "gallery-list")
    const redraw = () => {
      gallery.replaceChildren()
      entry[key].forEach((img, index) => {
        const card = make("div", "gallery-card")
        const top = make("div", "gallery-top")
        top.append(make("span", "", "IMAGE " + String(index + 1).padStart(2, "0")))
        const remove = make("button", "icon-button", "×")
        remove.type = "button"; remove.title = "Remove image"; remove.addEventListener("click", () => { entry[key].splice(index, 1); modified(); redraw() })
        top.append(remove); card.append(top)
        imageField(card, img, modified)
        gallery.append(card)
      })
    }
    redraw()
    wrap.append(gallery)
    const add = make("button", "secondary-button", "+ Add image")
    add.type = "button"; add.addEventListener("click", () => { entry[key].push({ src: "", alt: "" }); modified(); redraw() })
    wrap.append(add)
  } else if (field.kind === "list") {
    const input = make("textarea", "text-control")
    input.rows = 5
    input.value = (entry[key] || []).join("\n")
    input.placeholder = "One feature per line"
    input.addEventListener("input", () => update(input.value.split("\n").map((line) => line.trim()).filter(Boolean)))
    label.append(input)
    wrap.append(make("div", "field-note", "One feature per line."))
  } else if (field.kind === "richtext") {
    const toolbar = make("div", "rich-toolbar")
    for (const [name, command, value] of [["H2", "formatBlock", "h2"], ["H3", "formatBlock", "h3"], ["B", "bold", null], ["I", "italic", null], ["• List", "insertUnorderedList", null]]) {
      const button = make("button", "", name)
      button.type = "button"
      button.addEventListener("click", () => { editor.focus(); document.execCommand(command, false, value); update(editor.innerHTML) })
      toolbar.append(button)
    }
    const link = make("button", "", "↗ Link")
    link.type = "button"
    link.addEventListener("click", () => { const url = window.prompt("HTTPS link URL"); if (url && /^https:\/\//.test(url)) { editor.focus(); document.execCommand("createLink", false, url); update(editor.innerHTML) } })
    toolbar.append(link)
    const editor = make("div", "rich-editor")
    editor.contentEditable = "true"
    editor.setAttribute("role", "textbox")
    editor.setAttribute("aria-label", field.label)
    editor.setAttribute("aria-multiline", "true")
    editor.innerHTML = entry[key] || ""
    editor.addEventListener("input", () => update(editor.innerHTML))
    wrap.append(toolbar, editor, make("div", "field-note", "Headings, paragraphs, lists, emphasis, and links are supported."))
  }
  container.append(wrap)
}
function imageField(parent, image, changed) {
  const preview = make("div", "image-preview")
  if (image.src) {
    const img = make("img")
    img.src = image.src
    img.alt = image.alt || "Image preview"
    img.loading = "lazy"
    preview.append(img)
  } else preview.append(make("span", "image-placeholder", "✳  No image selected"))
  parent.append(preview)
  const source = make("input", "text-control")
  source.type = "text"; source.value = image.src || ""; source.placeholder = "/images/example.webp or https://..."
  source.setAttribute("aria-label", "Image URL")
  source.addEventListener("input", () => { image.src = source.value; changed(); preview.replaceChildren(); if (image.src) { const img = make("img"); img.src = image.src; img.alt = image.alt || "Image preview"; preview.append(img) } })
  parent.append(source)
  const alt = make("input", "text-control image-alt")
  alt.type = "text"; alt.value = image.alt || ""; alt.placeholder = "Describe the image (alt text)"
  alt.setAttribute("aria-label", "Image description")
  alt.addEventListener("input", () => { image.alt = alt.value; changed() })
  parent.append(alt)
  const file = make("input", "sr-only")
  file.type = "file"; file.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif"
  const upload = make("button", "secondary-button upload-button", "↑ Upload image")
  upload.type = "button"
  upload.addEventListener("click", () => file.click())
  file.addEventListener("change", async () => {
    if (!file.files?.[0]) return
    const form = new FormData(); form.append("collection", state.active); form.append("file", file.files[0])
    upload.disabled = true; upload.textContent = "Uploading…"
    try {
      const uploaded = await api("upload", { method: "POST", body: form })
      image.src = uploaded.src; image.alt = image.alt || uploaded.alt
      source.value = image.src; alt.value = image.alt
      preview.replaceChildren(); const img = make("img"); img.src = image.src; img.alt = image.alt; preview.append(img)
      changed(); toast("Image uploaded. Save the item to keep it.")
    } catch (error) { toast(error.message, true) }
    finally { upload.disabled = false; upload.textContent = "↑ Upload image"; file.value = "" }
  })
  parent.append(file, upload)
}
function renderEditorHeader() {
  const entry = item()
  if (!entry) return
  $("editor-title").textContent = labelFor(entry, current().meta)
  $("entry-position").textContent = String(state.selected + 1).padStart(2, "0")
  $("entry-slug").textContent = entry.slug ? "/work/" + entry.slug + "/" : entry.category || entry.role || current().meta.label
}
function renderEditor() {
  const entry = item()
  $("editor-pane").hidden = !entry
  $("drawer-backdrop").hidden = !entry
  $("editor").hidden = !entry
  if (!entry) return
  renderEditorHeader()
  $("published").checked = !entry._draft
  $("visibility-caption").textContent = entry._draft ? "Draft — hidden from the site" : "Published on the site"
  const fields = $("form-fields")
  fields.replaceChildren()
  for (const field of current().meta.fields) renderField(field, entry, fields)
}
async function reload() {
  const data = await api("collections")
  state.collections = data.collections
  cleanState()
  render()
}
async function start() {
  try {
    const session = await api("session")
    $("login").hidden = session.authenticated
    $("dashboard").hidden = !session.authenticated
    if (session.authenticated) await reload()
  } catch (error) { $("login").hidden = false; toast(error.message, true) }
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault()
  const button = $("login-form").querySelector("button")
  button.disabled = true
  $("login-error").textContent = ""
  try {
    await api("login", { method: "POST", body: JSON.stringify({ code: $("access-code").value }) })
    $("access-code").value = ""
    $("login").hidden = true; $("dashboard").hidden = false
    await reload()
  } catch (error) { $("login-error").textContent = error.message }
  finally { button.disabled = false }
})
$("logout").addEventListener("click", async () => {
  if (!canLeave()) return
  try { await api("logout", { method: "POST" }); state.collections = {}; $("dashboard").hidden = true; $("login").hidden = false; cleanState() }
  catch (error) { toast(error.message, true) }
})
$("search").addEventListener("input", (event) => { state.query = event.target.value; renderList() })
$("status-filter").addEventListener("change", event => { state.filter = event.target.value; renderList() })
function closeEditor() {
  if (!canLeave()) return
  if (state.dirty) reload().then(() => { state.selected = -1; render() }).catch(error => toast(error.message, true))
  else { state.selected = -1; renderList(); renderEditor() }
}
$("editor-close").addEventListener("click", closeEditor)
$("drawer-backdrop").addEventListener("click", closeEditor)
$("view-site").href = location.hostname === "127.0.0.1" || location.hostname === "localhost" ? "http://127.0.0.1:3000/" : "/"
$("add-item").addEventListener("click", () => {
  const entry = { _draft: true }
  for (const field of current().meta.fields) entry[field.key] = field.kind === "image" ? { src: "", alt: "" } : ["gallery", "list"].includes(field.kind) ? [] : ""
  current().items.push(entry)
  state.selected = current().items.length - 1
  state.query = ""; $("search").value = ""
  modified(); render()
  $("form-fields").querySelector("input, textarea, [contenteditable]")?.focus()
})
$("duplicate-item").addEventListener("click", () => {
  const entry = structuredClone(item())
  entry._draft = true
  if (entry.slug) entry.slug = slugify(entry.slug + "-copy")
  current().items.splice(state.selected + 1, 0, entry)
  state.selected += 1
  modified(); render(); toast("Duplicate created as a draft.")
})
$("delete-item").addEventListener("click", () => {
  if (!window.confirm("Delete this entry? Save changes to make the deletion permanent.")) return
  current().items.splice(state.selected, 1)
  state.selected = Math.min(state.selected, current().items.length - 1)
  modified(); render()
})
$("published").addEventListener("change", (event) => {
  item()._draft = !event.target.checked
  $("visibility-caption").textContent = item()._draft ? "Draft — hidden from the site" : "Published on the site"
  modified(); renderList()
})
$("discard").addEventListener("click", async () => { if (!canLeave()) return; try { await reload(); toast("Changes discarded.") } catch (error) { toast(error.message, true) } })
$("save").addEventListener("click", save)
async function save() {
  if (!state.dirty || state.busy) return
  state.busy = true; $("save").disabled = true; $("save").textContent = "Saving…"
  const active = state.active, selected = state.selected
  try {
    await api("collections/" + active, { method: "PUT", body: JSON.stringify({ items: current().items, revision: current().revision }) })
    await reload(); state.active = active; state.selected = Math.min(selected, current().items.length - 1); render()
    toast("Changes saved.")
  } catch (error) { toast(error.message, true); $("save").disabled = false }
  finally { state.busy = false; $("save").textContent = "Save changes" }
}
window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = "" } })
window.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save() } })
window.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("editor-pane").hidden) closeEditor() })
start()
