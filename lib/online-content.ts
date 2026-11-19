import { get, put } from "@vercel/blob"
import { readFile, rename, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"
import projectsJson from "@/content/projects.json"
import playgroundJson from "@/content/playground.json"
import carouselJson from "@/content/carousel.json"
import aboutJson from "@/content/about.json"
import type { Img, Project } from "@/content"

export type PlaygroundItem = { title: string; category: string; image: Img; _draft?: boolean }
export type CarouselItem = { title: string; image: Img; _draft?: boolean }
export type ContentDocument = {
    projects: (Project & { _draft?: boolean; link?: string })[]
    playground: PlaygroundItem[]
    carousel: CarouselItem[]
    about: typeof aboutJson
}

const blobPath = "cms/content.json"
const defaults: ContentDocument = {
    projects: projectsJson as ContentDocument["projects"],
    playground: playgroundJson as ContentDocument["playground"],
    carousel: carouselJson as ContentDocument["carousel"],
    about: aboutJson,
}

export async function readContentDocument(): Promise<ContentDocument> {
    if (process.env.VERCEL !== "1") {
        const content = path.join(process.cwd(), "content")
        const [projects, playground, carousel, about] = await Promise.all(
            ["projects", "playground", "carousel", "about"].map(async name => JSON.parse(await readFile(path.join(content, `${name}.json`), "utf8")))
        )
        return { projects, playground, carousel, about }
    }
    const result = await get(blobPath, { access: "private", useCache: false })
    if (!result?.stream) return defaults
    const stored = await new Response(result.stream).json()
    if (!stored || !Array.isArray(stored.projects) || !Array.isArray(stored.playground) || !Array.isArray(stored.carousel) || !stored.about) {
        throw new Error("CMS content store is invalid.")
    }
    return stored as ContentDocument
}

export async function writeContentDocument(document: ContentDocument, collectionId: string): Promise<void> {
    if (process.env.VERCEL !== "1") {
        const name = ["services", "awards", "team", "plans", "faq"].includes(collectionId) ? "about" : collectionId
        if (!["about", "projects", "playground", "carousel"].includes(name)) throw new Error("Unknown collection.")
        const filename = path.join(process.cwd(), "content", `${name}.json`)
        const temporary = `${filename}.${randomUUID()}.tmp`
        await writeFile(temporary, JSON.stringify(document[name as keyof ContentDocument], null, 2) + "\n", { flag: "wx" })
        await rename(temporary, filename)
        return
    }
    await put(blobPath, JSON.stringify(document), {
        access: "private",
        allowOverwrite: true,
        contentType: "application/json",
    })
}

const visible = <T,>(items: T[]): T[] => items.filter(entry => !(entry as { _draft?: boolean })._draft)

export async function readPublishedContent() {
    const data = await readContentDocument()
    return {
        projects: visible(data.projects),
        playground: visible(data.playground),
        carousel: visible(data.carousel),
        about: {
            ...data.about,
            services: visible(data.about.services),
            awards: visible(data.about.awards),
            team: visible(data.about.team),
            plans: visible(data.about.plans),
            faq: visible(data.about.faq),
        },
    }
}
