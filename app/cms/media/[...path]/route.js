import { get } from "@vercel/blob"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request) {
  const pathname = new URL(request.url).pathname.replace(/\/$/, "")
  const match = /^\/cms\/media\/([a-z]+)\/([0-9a-f-]{36}\.(?:jpg|png|webp|gif|avif))$/.exec(pathname)
  if (!match) return new Response("Not found", { status: 404 })
  try {
    const result = await get(`cms/media/${match[1]}/${match[2]}`, { access: "private" })
    if (!result?.stream) return new Response("Not found", { status: 404 })
    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response("Media unavailable", { status: 503 })
  }
}
