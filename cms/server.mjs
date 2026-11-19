import http from "node:http"
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { readFile, writeFile, rename, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { collections, validateItems } from "./schema.mjs"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const sitePublic = path.join(root, "public")
const cmsPublic = path.join(sitePublic, "cms")
const contentDir = path.join(root, "content")
const accessCode = process.env.CMS_ACCESS_CODE
const port = Number(process.env.CMS_PORT || 3001)
const sessionHours = 12
const attempts = new Map()

if (!accessCode || accessCode.length < 8) {
  console.error("Set CMS_ACCESS_CODE (at least 8 characters) in .env.local before starting the CMS.")
  process.exit(1)
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("CMS_PORT must be a port between 1024 and 65535.")
  process.exit(1)
}

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
}

function respond(res, status, body, headers = {}) {
  res.writeHead(status, { ...securityHeaders, ...headers })
  res.end(body)
}

function json(res, status, value, headers = {}) {
  respond(res, status, JSON.stringify(value), { "Content-Type": "application/json; charset=utf-8", ...headers })
}

function equalString(a, b) {
  const left = createHash("sha256").update(a).digest()
  const right = createHash("sha256").update(b).digest()
  return timingSafeEqual(left, right)
}

function sign(value) {
  return createHmac("sha256", accessCode).update(value).digest("hex")
}

function issueSession() {
  const payload = String(Date.now()) + "." + randomBytes(16).toString("hex")
  return payload + "." + sign(payload)
}

function authenticated(req) {
  const match = /(?:^|;\s*)rovelle_cms=([^;]+)/.exec(req.headers.cookie || "")
  if (!match) return false
  const token = decodeURIComponent(match[1])
  const parts = token.split(".")
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false
  const age = Date.now() - Number(parts[0])
  if (age < 0 || age > sessionHours * 60 * 60 * 1000) return false
  const payload = parts[0] + "." + parts[1]
  return equalString(sign(payload), parts[2])
}

function sessionCookie(value, maxAge) {
  return "rovelle_cms=" + encodeURIComponent(value) + "; HttpOnly; SameSite=Strict; Path=/cms; Max-Age=" + maxAge
}

async function readBody(req, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error("Request is too large.")
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readCollection(id) {
  const collection = collections[id]
  if (!collection) throw new Error("Unknown collection.")
  const filename = path.join(contentDir, collection.file)
  const raw = await readFile(filename, "utf8")
  const document = JSON.parse(raw)
  const items = collection.path ? document[collection.path] : document
  if (!Array.isArray(items)) throw new Error("Collection data is invalid.")
  return { collection, filename, document, items, revision: createHash("sha256").update(raw).digest("hex") }
}

async function saveCollection(id, payload) {
  const current = await readCollection(id)
  if (payload.revision !== current.revision) {
    const error = new Error("This collection changed on disk. Reload before saving.")
    error.status = 409
    throw error
  }
  const items = validateItems(current.collection, payload.items)
  const nextDocument = current.collection.path
    ? { ...current.document, [current.collection.path]: items }
    : items
  const next = JSON.stringify(nextDocument, null, 2) + "\n"
  const temporary = current.filename + "." + randomUUID() + ".tmp"
  await writeFile(temporary, next, { flag: "wx" })
  await rename(temporary, current.filename)
  return { revision: createHash("sha256").update(next).digest("hex"), items }
}

function validImage(bytes, mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
  if (mime === "image/avif") return bytes.toString("ascii", 4, 12).includes("ftypavif")
  return false
}

async function uploadImage(req) {
  const raw = await readBody(req, 16 * 1024 * 1024)
  const form = await new Request("http://127.0.0.1/upload", {
    method: "POST",
    headers: { "Content-Type": req.headers["content-type"] || "" },
    body: raw,
  }).formData()
  const collection = String(form.get("collection") || "")
  const file = form.get("file")
  if (!collections[collection]) throw new Error("Unknown collection.")
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Choose an image to upload.")
  if (file.size === 0 || file.size > 15 * 1024 * 1024) throw new Error("Images must be under 15 MB.")
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" }
  const extension = extensions[file.type]
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!extension || !validImage(bytes, file.type)) throw new Error("Use a JPEG, PNG, WebP, GIF, or AVIF image.")
  const directory = path.join(sitePublic, "images", "cms", collection)
  await mkdir(directory, { recursive: true })
  const filename = Date.now() + "-" + randomBytes(6).toString("hex") + "." + extension
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" })
  return { src: "/images/cms/" + collection + "/" + filename, alt: file.name.replace(/\.[^.]+$/, "").slice(0, 500) }
}

async function serveFile(res, file, mime) {
  try {
    const body = await readFile(file)
    respond(res, 200, body, { "Content-Type": mime })
  } catch {
    respond(res, 404, "Not found")
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname
    if (pathname === "/" || pathname === "/cms") {
      respond(res, 302, "", { Location: "/cms/" })
      return
    }
    if (req.method === "GET" && pathname === "/cms/") {
      await serveFile(res, path.join(cmsPublic, "index.html"), "text/html; charset=utf-8")
      return
    }
    if (req.method === "GET" && pathname === "/cms/app.js") {
      await serveFile(res, path.join(cmsPublic, "app.js"), "text/javascript; charset=utf-8")
      return
    }
    if (req.method === "GET" && pathname === "/cms/styles.css") {
      await serveFile(res, path.join(cmsPublic, "styles.css"), "text/css; charset=utf-8")
      return
    }
    if (req.method === "GET" && (pathname.startsWith("/images/") || pathname.startsWith("/brand/"))) {
      const file = path.resolve(sitePublic, "." + decodeURIComponent(pathname))
      if (!file.startsWith(sitePublic + path.sep)) {
        respond(res, 403, "Forbidden")
        return
      }
      const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".svg": "image/svg+xml" }[path.extname(file)]
      if (!mime) {
        respond(res, 415, "Unsupported file")
        return
      }
      await serveFile(res, file, mime)
      return
    }
    if (!pathname.startsWith("/cms/api/")) {
      respond(res, 404, "Not found")
      return
    }
    const mutation = req.method !== "GET"
    const origin = req.headers.origin
    if (mutation && origin && origin !== "http://127.0.0.1:" + port) {
      json(res, 403, { error: "Invalid origin." })
      return
    }
    if (mutation && req.headers["x-cms-request"] !== "1") {
      json(res, 403, { error: "Invalid request." })
      return
    }
    if (pathname === "/cms/api/session" && req.method === "GET") {
      json(res, 200, { authenticated: authenticated(req) })
      return
    }
    if (pathname === "/cms/api/login" && req.method === "POST") {
      const key = req.socket.remoteAddress || "local"
      const record = attempts.get(key) || { count: 0, until: 0 }
      if (record.until > Date.now()) {
        json(res, 429, { error: "Too many attempts. Try again in 15 minutes." })
        return
      }
      const payload = JSON.parse((await readBody(req, 4096)).toString("utf8"))
      if (typeof payload.code !== "string" || !equalString(payload.code, accessCode)) {
        record.count += 1
        if (record.count >= 5) { record.count = 0; record.until = Date.now() + 15 * 60 * 1000 }
        attempts.set(key, record)
        json(res, 401, { error: "Incorrect access code." })
        return
      }
      attempts.delete(key)
      json(res, 200, { authenticated: true }, { "Set-Cookie": sessionCookie(issueSession(), sessionHours * 3600) })
      return
    }
    if (!authenticated(req)) {
      json(res, 401, { error: "Sign in to continue." })
      return
    }
    if (pathname === "/cms/api/logout" && req.method === "POST") {
      json(res, 200, { authenticated: false }, { "Set-Cookie": sessionCookie("", 0) })
      return
    }
    if (pathname === "/cms/api/collections" && req.method === "GET") {
      const entries = await Promise.all(Object.entries(collections).map(async ([id, meta]) => {
        const { items, revision } = await readCollection(id)
        return [id, { meta: { label: meta.label, description: meta.description, title: meta.title, group: meta.group, fields: meta.fields }, items, revision }]
      }))
      json(res, 200, { collections: Object.fromEntries(entries) })
      return
    }
    const match = /^\/cms\/api\/collections\/([a-z]+)$/.exec(pathname)
    if (match && req.method === "PUT") {
      if (!collections[match[1]]) { json(res, 404, { error: "Unknown collection." }); return }
      const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString("utf8"))
      json(res, 200, await saveCollection(match[1], payload))
      return
    }
    if (pathname === "/cms/api/upload" && req.method === "POST") {
      json(res, 200, await uploadImage(req))
      return
    }
    json(res, 404, { error: "Not found." })
  } catch (error) {
    json(res, error.status || 400, { error: error.message || "Request failed." })
  }
})

server.listen(port, "127.0.0.1", () => {
  console.log("Rovelle CMS: http://127.0.0.1:" + port + "/cms/")
})
server.on("error", (error) => {
  console.error("CMS server could not start: " + error.message)
  process.exitCode = 1
})
