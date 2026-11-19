// Typed access to the JSON content. Edit the .json files to change text, images and lists.
import siteJson from "./site.json"
import projectsJson from "./projects.json"
import playgroundJson from "./playground.json"
import carouselJson from "./carousel.json"
import aboutJson from "./about.json"

export type Img = { src: string; alt: string }
export type Project = {
    slug: string
    title: string
    category: string
    subtitle: string
    year: string
    services: string
    contentHtml: string
    cover: Img
    image2: Img
    image3: Img
    gallery: Img[]
    gallery2: Img[]
}

const visible = <T,>(items: T[]): T[] => items.filter((entry) => !(entry as { _draft?: boolean })._draft)

export const site = siteJson
export const projects = visible(projectsJson) as Project[]
export const playground = visible(playgroundJson) as { title: string; category: string; image: Img }[]
export const carousel = visible(carouselJson) as { title: string; image: Img }[]
export const about = {
    ...aboutJson,
    services: visible(aboutJson.services),
    awards: visible(aboutJson.awards),
    team: visible(aboutJson.team),
    plans: visible(aboutJson.plans),
    faq: visible(aboutJson.faq),
}

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug)
export const workHref = (slug: string) => `/work/${slug}/`
