import sanitizeHtml from "sanitize-html"

export const collections = {
  projects: {
    label: "Projects",
    description: "Work detail pages and the home vortex.",
    file: "projects.json",
    title: "title",
    group: "Work",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "slug", label: "URL slug", kind: "slug", required: true },
      { key: "category", label: "Category", kind: "text" },
      { key: "subtitle", label: "Subtitle", kind: "textarea" },
      { key: "cover", label: "Image", kind: "image", required: true },
      { key: "link", label: "Link", kind: "text" },
      { key: "year", label: "Year", kind: "text" },
      { key: "services", label: "Services", kind: "text" },
      { key: "contentHtml", label: "Content", kind: "richtext" },
      { key: "image2", label: "Image 2", kind: "image" },
      { key: "image3", label: "Image 3", kind: "image" },
      { key: "gallery", label: "Gallery", kind: "gallery" },
      { key: "gallery2", label: "Gallery 2", kind: "gallery" },
    ],
  },
  playground: {
    label: "Playground",
    description: "Explorations in the infinite image grid.",
    file: "playground.json",
    title: "title",
    group: "Work",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "category", label: "Category", kind: "text" },
      { key: "image", label: "Image", kind: "image", required: true },
    ],
  },
  carousel: {
    label: "Contact Carousel",
    description: "Image sequence on the contact page.",
    file: "carousel.json",
    title: "title",
    group: "Work",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "image", label: "Image", kind: "image", required: true },
    ],
  },
  services: {
    label: "Services",
    description: "Studio services shown on About.",
    file: "about.json",
    path: "services",
    title: "title",
    group: "Studio",
    fields: [
      { key: "number", label: "Number", kind: "text" },
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "image", label: "Image", kind: "image" },
    ],
  },
  awards: {
    label: "Awards",
    description: "Recognition rows shown on About.",
    file: "about.json",
    path: "awards",
    title: "award",
    group: "Studio",
    fields: [
      { key: "award", label: "Award", kind: "text", required: true },
      { key: "category", label: "Category", kind: "text" },
      { key: "count", label: "Count", kind: "text" },
    ],
  },
  team: {
    label: "Team",
    description: "People and portraits shown on About.",
    file: "about.json",
    path: "team",
    title: "name",
    group: "Studio",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "role", label: "Role", kind: "text" },
      { key: "social", label: "Social", kind: "text" },
      { key: "image", label: "Portrait", kind: "image" },
    ],
  },
  plans: {
    label: "Plans",
    description: "Pricing rows shown on About.",
    file: "about.json",
    path: "plans",
    title: "name",
    group: "Studio",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "hours", label: "Hours", kind: "text" },
      { key: "features", label: "Features", kind: "list" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "price", label: "Price", kind: "text" },
    ],
  },
  faq: {
    label: "FAQ",
    description: "Questions and answers shown on About.",
    file: "about.json",
    path: "faq",
    title: "question",
    group: "Studio",
    fields: [
      { key: "question", label: "Question", kind: "text", required: true },
      { key: "answer", label: "Answer", kind: "textarea" },
    ],
  },
}

export function blankItem(collection) {
  const item = { _draft: true }
  for (const field of collection.fields) {
    item[field.key] = field.kind === "image" ? { src: "", alt: "" }
      : field.kind === "gallery" || field.kind === "list" ? []
      : ""
  }
  return item
}

const cleanHtml = (value) => sanitizeHtml(value, {
  allowedTags: ["h2", "h3", "p", "strong", "em", "b", "i", "ul", "ol", "li", "blockquote", "a", "br"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { href: attribs.href || "#", target: "_blank", rel: "noopener noreferrer" },
    }),
  },
})

function cleanImage(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(label + " must be an image.")
  const src = String(value.src || "").trim()
  const alt = String(value.alt || "").trim()
  if (src && !src.startsWith("/images/") && !src.startsWith("/cms/media/") && !/^https:\/\//.test(src)) {
    throw new Error(label + " must use an uploaded image or HTTPS URL.")
  }
  if (src.length > 2048 || alt.length > 500) throw new Error(label + " is too long.")
  return { src, alt }
}

export function validateItems(collection, input) {
  if (!Array.isArray(input) || input.length > 200) throw new Error("The collection must contain at most 200 items.")
  const slugs = new Set()
  return input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Item " + (index + 1) + " is invalid.")
    const item = { _draft: raw._draft === true }
    for (const field of collection.fields) {
      const value = raw[field.key]
      const label = "Item " + (index + 1) + ": " + field.label
      if (field.kind === "image") {
        item[field.key] = cleanImage(value, label)
        if (!item._draft && field.required && !item[field.key].src) {
          throw new Error(label + " is required before publishing.")
        }
      } else if (field.kind === "gallery") {
        if (!Array.isArray(value) || value.length > 40) throw new Error(label + " must be a list of at most 40 images.")
        item[field.key] = value.map((image, imageIndex) => cleanImage(image, label + " " + (imageIndex + 1)))
      } else if (field.kind === "list") {
        if (!Array.isArray(value) || value.length > 12 || value.some(entry => typeof entry !== "string" || entry.length > 500)) {
          throw new Error(label + " must be a list of short text values.")
        }
        item[field.key] = value
      } else {
        if (value === undefined && !field.required) {
          item[field.key] = ""
        } else if (typeof value !== "string" || value.length > (field.kind === "richtext" ? 50000 : 10000)) {
          throw new Error(label + " must be text.")
        } else {
          item[field.key] = field.kind === "richtext" ? cleanHtml(value) : value
        }
      }
      if (!item._draft && field.required && !String(item[field.key]).trim()) {
        throw new Error(label + " is required before publishing.")
      }
    }
    if (collection === collections.projects && item.slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) throw new Error("Item " + (index + 1) + ": slug must use lowercase letters, numbers, and hyphens.")
      if (slugs.has(item.slug)) throw new Error("Project slugs must be unique.")
      slugs.add(item.slug)
    }
    return item
  })
}
