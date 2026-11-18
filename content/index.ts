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

export const site = siteJson
export const projects = projectsJson as Project[]
export const playground = playgroundJson as { title: string; category: string; image: Img }[]
export const carousel = carouselJson as { title: string; image: Img }[]
export const about = aboutJson

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug)
export const workHref = (slug: string) => `/work/${slug}/`
