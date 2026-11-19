import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { put } from "@vercel/blob"
import { collections, validateItems } from "../../../../cms/schema.mjs"
import { readContentDocument, writeContentDocument } from "../../../../lib/online-content.ts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const attempts = new Map()
const maxAgeSeconds = 12 * 60 * 60
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
}
const response = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } })
const hash = value => createHash("sha256").update(value).digest("hex")
const equal = (a, b) => {
  const left = Buffer.from(hash(a), "hex")
  const right = Buffer.from(hash(b), "hex")
  return timingSafeEqual(left, right)
}
const code = () => process.env.CMS_ACCESS_CODE || ""
const sign = value => createHmac("sha256", code()).update(value).digest("hex")
const cookie = request => {
  const match = /(?:^|;\s*)rovelle_cms=([^;]+)/.exec(request.headers.get("cookie") || "")
  return match ? decodeURIComponent(match[1]) : ""
}
function authenticated(request) {
  const parts = cookie(request).split(".")
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false
  const age = Date.now() - Number(parts[0])
  if (age < 0 || age > maxAgeSeconds * 1000) return false
  return equal(sign(parts[0] + "." + parts[1]), parts[2])
}
function sessionCookie(value, age, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""
  return `rovelle_cms=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/cms; Max-Age=${age}${secure}`
}
function errorResponse(error) {
  console.error("CMS request failed:", error)
  return response({ error: error?.message || "Request failed." }, error?.status || 400)
}
function currentItems(document, id) {
  const collection = collections[id]
  return collection.path ? document.about[collection.path] : document[id]
}
function setItems(document, id, items) {
  const collection = collections[id]
  if (collection.path) return { ...document, about: { ...document.about, [collection.path]: items } }
  return { ...document, [id]: items }
}
function collectionSnapshot(document) {
  const revision = hash(JSON.stringify(document))
  return Object.fromEntries(Object.entries(collections).map(([id, meta]) => [id, {
    meta: { label: meta.label, description: meta.description, title: meta.title, group: meta.group, fields: meta.fields },
    items: currentItems(document, id), revision,
  }]))
}
function validImage(bytes, mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
  if (mime === "image/avif") return bytes.toString("ascii", 4, 12).includes("ftypavif")
  return false
}
function checkRequest(request, mutation) {
  if (code().length < 8) return response({ error: "CMS access code is not configured." }, 503)
  if (!mutation) return null
  if (request.headers.get("x-cms-request") !== "1") return response({ error: "Invalid request." }, 403)
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) return response({ error: "Invalid origin." }, 403)
  return null
}
async function handle(request) {
  const path = new URL(request.url).pathname.replace(/\/$/, "")
  const mutation = request.method !== "GET"
  const invalid = checkRequest(request, mutation)
  if (invalid) return invalid
  if (path === "/cms/api/session" && request.method === "GET") return response({ authenticated: authenticated(request) })
  if (path === "/cms/api/login" && request.method === "POST") {
    const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
    const attempt = attempts.get(key) || { count: 0, until: 0 }
    if (attempt.until > Date.now()) return response({ error: "Too many attempts. Try again in 15 minutes." }, 429)
    const body = await request.text()
    if (body.length > 4096) return response({ error: "Request is too large." }, 413)
    const payload = JSON.parse(body)
    if (typeof payload.code !== "string" || !equal(payload.code, code())) {
      attempt.count += 1
      if (attempt.count >= 5) { attempt.count = 0; attempt.until = Date.now() + 15 * 60 * 1000 }
      attempts.set(key, attempt)
      return response({ error: "Incorrect access code." }, 401)
    }
    attempts.delete(key)
    const value = `${Date.now()}.${randomBytes(16).toString("hex")}`
    return response({ authenticated: true }, 200, { "Set-Cookie": sessionCookie(value + "." + sign(value), maxAgeSeconds, request) })
  }
  if (!authenticated(request)) return response({ error: "Sign in to continue." }, 401)
  if (path === "/cms/api/logout" && request.method === "POST") return response({ authenticated: false }, 200, { "Set-Cookie": sessionCookie("", 0, request) })
  if (path === "/cms/api/collections" && request.method === "GET") {
    return response({ collections: collectionSnapshot(await readContentDocument()) })
  }
  const match = /^\/cms\/api\/collections\/([a-z]+)$/.exec(path)
  if (match && request.method === "PUT") {
    const id = match[1]
    if (!collections[id]) return response({ error: "Unknown collection." }, 404)
    const body = await request.text()
    if (body.length > 2 * 1024 * 1024) return response({ error: "Request is too large." }, 413)
    const payload = JSON.parse(body)
    const current = await readContentDocument()
    if (payload.revision !== hash(JSON.stringify(current))) return response({ error: "Content changed. Reload before saving." }, 409)
    const items = validateItems(collections[id], payload.items)
    const next = setItems(current, id, items)
    await writeContentDocument(next, id)
    return response({ revision: hash(JSON.stringify(next)), items })
  }
  if (path === "/cms/api/upload" && request.method === "POST") {
    const form = await request.formData()
    const collection = String(form.get("collection") || "")
    const file = form.get("file")
    if (!collections[collection]) return response({ error: "Unknown collection." }, 400)
    if (!file || typeof file.arrayBuffer !== "function") return response({ error: "Choose an image to upload." }, 400)
    if (file.size === 0 || file.size > 4 * 1024 * 1024) return response({ error: "Images must be under 4 MB online." }, 413)
    const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" }
    const extension = extensions[file.type]
    const bytes = Buffer.from(await file.arrayBuffer())
    if (!extension || !validImage(bytes, file.type)) return response({ error: "Use a JPEG, PNG, WebP, GIF, or AVIF image." }, 400)
    const filename = `${randomUUID()}.${extension}`
    let src
    if (process.env.VERCEL === "1") {
      await put(`cms/media/${collection}/${filename}`, bytes, { access: "private", contentType: file.type })
      src = `/cms/media/${collection}/${filename}`
    } else {
      const directory = path.join(process.cwd(), "public", "images", "cms", collection)
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, filename), bytes, { flag: "wx" })
      src = `/images/cms/${collection}/${filename}`
    }
    return response({ src, alt: file.name.replace(/\.[^.]+$/, "").slice(0, 500) })
  }
  return response({ error: "Not found." }, 404)
}
export async function GET(request) { try { return await handle(request) } catch (error) { return errorResponse(error) } }
export async function POST(request) { try { return await handle(request) } catch (error) { return errorResponse(error) } }
export async function PUT(request) { try { return await handle(request) } catch (error) { return errorResponse(error) } }
