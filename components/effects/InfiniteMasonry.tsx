"use client"

import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

// Infinite Masonry — a masonry grid of images that repeats itself as you scroll,
// with a click-to-enlarge lightbox. Columns drift at slightly different speeds for a
// subtle parallax; on phones the captions sit on the images over a soft gradient.
//
// CMS: put a Collection List (items = a card with an Image + "Title" / "Category"
// text layers) inside a top-level frame on the canvas and connect that frame to
// the "Content" slot. Images keep their own aspect ratio.

type Item = { src: string; title: string; category: string }

type ManualItem = { image?: { src?: string; alt?: string }; title?: string; category?: string }

interface InfiniteMasonryProps {
    content?: React.ReactNode
    items?: ManualItem[]
    columns?: number
    columnsTablet?: number
    columnsPhone?: number
    tabletBelow?: number
    phoneBelow?: number
    gap?: number
    cardPadding?: number
    cardBg?: string
    cardRadius?: number
    imageRadius?: number
    infinite?: boolean
    showCaption?: boolean
    captionFont?: React.CSSProperties
    captionColor?: string
    lightboxBg?: string
    lightboxColor?: string
    lightboxFont?: React.CSSProperties
    lightboxMetaFont?: React.CSSProperties
    edgeTop?: number
    edgeBottom?: number
    edgeBlur?: number
    edgeColor?: string
    parallax?: number
    overlayCaptions?: "phone" | "tablet" | "always" | "never"
    gapPhone?: number
    cardPaddingPhone?: number
    overlayFont?: React.CSSProperties
    overlayMetaFont?: React.CSSProperties
    overlayColor?: string
    overlayShade?: string
    style?: React.CSSProperties
}

const PLACEHOLDER_COLORS = ["#d9cfc0", "#c9bfae", "#e2d8ca", "#bfb4a2", "#d3c8b8", "#cbbfad"]

// ---------- reading items from the slot (CMS Collection List) ----------

function bestSrc(img: HTMLImageElement): string {
    let best = ""
    let bestW = -1
    for (const part of (img.getAttribute("srcset") || "").split(",")) {
        const [url, d] = part.trim().split(/\s+/)
        const w = parseFloat(d) || 0
        if (url && w > bestW) {
            best = url
            bestW = w
        }
    }
    return best || img.currentSrc || img.src || ""
}

function mediaOf(el: Element): string {
    const img = el.querySelector("img")
    if (img) return bestSrc(img as HTMLImageElement)
    const nodes = [el, ...Array.from(el.querySelectorAll("*"))]
    for (const node of nodes) {
        const m = /url\(["']?([^"')]+)["']?\)/.exec((node as HTMLElement).style?.backgroundImage || "")
        if (m) return m[1]
    }
    return ""
}

function findItemElements(root: HTMLElement): Element[] {
    const queue: Element[] = [root]
    while (queue.length) {
        const el = queue.shift()!
        const kids = Array.from(el.children)
        const withMedia = kids.filter((k) => mediaOf(k))
        if (withMedia.length >= 2) return withMedia
        queue.push(...kids)
    }
    const single = root.firstElementChild
    return single && mediaOf(single) ? [single] : []
}

function extractItems(root: HTMLElement): Item[] {
    return findItemElements(root).map((el) => {
        const texts = Array.from(el.querySelectorAll('[data-framer-component-type="RichTextContainer"]'))
            .map((l) => ({ name: (l.getAttribute("data-framer-name") || "").toLowerCase(), text: (l.textContent || "").trim() }))
            .filter((t) => t.text)
        const title = texts.find((t) => /title|name/.test(t.name)) || texts[0]
        const category = texts.find((t) => /category|tag|type|label/.test(t.name))
        return { src: mediaOf(el), title: title?.text || "", category: category?.text || "" }
    })
}

const pad = (x: number) => String(x).padStart(2, "0")

// Relative column speeds; multiplied by the Parallax amount.
const DRIFT = [0.35, 0.8, 0.15, 1, 0.55, 0.9, 0.25, 0.65]

/**
 * Infinite Masonry
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1000
 * @framerIntrinsicHeight 1200
 */
export default function InfiniteMasonry(props: InfiniteMasonryProps) {
    const {
        content,
        items: manualItems = [],
        columns = 4,
        columnsTablet = 3,
        columnsPhone = 2,
        tabletBelow = 1000,
        phoneBelow = 600,
        gap = 16,
        cardPadding = 12,
        cardBg = "#E4DACB",
        cardRadius = 10,
        imageRadius = 4,
        infinite = true,
        showCaption = false,
        captionFont,
        captionColor = "#8A8072",
        lightboxBg = "rgba(20, 20, 20, 0.94)",
        lightboxColor = "#EEE5D9",
        lightboxFont,
        lightboxMetaFont,
        edgeTop = 120,
        edgeBottom = 120,
        edgeBlur = 10,
        edgeColor = "#EEE5D9",
        parallax = 0.08,
        overlayCaptions = "phone",
        gapPhone = 10,
        cardPaddingPhone = 6,
        overlayFont,
        overlayMetaFont,
        overlayColor = "#EEE5D9",
        overlayShade = "rgba(20, 20, 20, 0.6)",
        style,
    } = props
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    const rootRef = useRef<HTMLDivElement>(null)
    const slotRef = useRef<HTMLDivElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)

    // ---- width ----
    const [width, setWidth] = useState(1000)
    useLayoutEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => setWidth((w) => (el.clientWidth && el.clientWidth !== w ? el.clientWidth : w))
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // ---- items from slot ----
    const [slotItems, setSlotItems] = useState<Item[]>([])
    useEffect(() => {
        const el = slotRef.current
        if (!el) return
        let raf = 0
        const read = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
                const next = extractItems(el).filter((i) => i.src)
                setSlotItems((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
            })
        }
        read()
        const mo = new MutationObserver(read)
        mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["src", "srcset", "style"] })
        return () => {
            mo.disconnect()
            cancelAnimationFrame(raf)
        }
    }, [content])

    const items: Item[] = useMemo(() => {
        if (slotItems.length) return slotItems
        const manual = manualItems
            .filter((m) => m?.image?.src)
            .map((m) => ({ src: m.image!.src!, title: m.title || "", category: m.category || "" }))
        if (manual.length) return manual
        return PLACEHOLDER_COLORS.map((c, i) => ({ src: "", title: `Exploration ${pad(i + 1)}`, category: c }))
    }, [slotItems, manualItems])
    const n = items.length

    // ---- image aspect ratios (height / width) ----
    const [ratios, setRatios] = useState<Record<string, number>>({})
    useEffect(() => {
        let alive = true
        for (const it of items) {
            if (!it.src || ratios[it.src]) continue
            const img = new Image()
            img.onload = () => {
                if (!alive || !img.naturalWidth) return
                const r = img.naturalHeight / img.naturalWidth
                setRatios((prev) => (prev[it.src] ? prev : { ...prev, [it.src]: r }))
            }
            img.src = it.src
        }
        return () => {
            alive = false
        }
    }, [items])
    const ratioOf = (it: Item, i: number) => (it.src ? ratios[it.src] || 0.75 : [1.25, 0.75, 1, 1.4, 0.8, 1.1][i % 6])

    // ---- how many cards to render (grows while scrolling) ----
    const batch = Math.max(12, n * 2)
    const [count, setCount] = useState(batch)
    useEffect(() => setCount(batch), [batch])
    // Load another batch whenever the end of the grid is within ~2 screens. Re-checked after every
    // batch (so a still-short grid keeps filling) and on scroll/resize; one batch per render at most.
    const pending = useRef(false)
    useEffect(() => {
        if (isCanvas || !infinite) return
        pending.current = false
        const check = () => {
            const el = sentinelRef.current
            if (!el || pending.current) return
            const root = rootRef.current
            const lead = root ? Math.max(0, -root.getBoundingClientRect().top) * motion.current.parallax : 0
            if (el.getBoundingClientRect().top - lead < window.innerHeight * 2.5) {
                pending.current = true
                setCount((c) => c + batch)
            }
        }
        const id = window.setTimeout(check, 60)
        window.addEventListener("scroll", check, { passive: true })
        window.addEventListener("resize", check)
        return () => {
            window.clearTimeout(id)
            window.removeEventListener("scroll", check)
            window.removeEventListener("resize", check)
        }
    }, [batch, infinite, isCanvas, count])
    const total = infinite ? (isCanvas ? Math.min(count, n * 2) : count) : n

    // ---- masonry: put every card into the currently shortest column ----
    const phone = width < phoneBelow
    const cols = Math.max(1, Math.round(phone ? columnsPhone : width < tabletBelow ? columnsTablet : columns))
    const g = phone ? gapPhone : gap
    const pd = phone ? cardPaddingPhone : cardPadding
    const overlay =
        overlayCaptions === "always" || (overlayCaptions === "phone" && phone) || (overlayCaptions === "tablet" && width < tabletBelow)
    const below = showCaption && !overlay
    const colW = (width - g * (cols - 1)) / cols
    const columnsList = useMemo(() => {
        const lists: number[][] = Array.from({ length: cols }, () => [])
        const heights = new Array(cols).fill(0)
        const captionH = below ? 28 : 0
        for (let i = 0; i < total; i++) {
            const it = items[i % n]
            const h = (colW - pd * 2) * ratioOf(it, i % n) + pd * 2 + captionH
            let c = 0
            for (let k = 1; k < cols; k++) if (heights[k] < heights[c] - 1) c = k
            lists[c].push(i)
            heights[c] += h + g
        }
        return lists
    }, [cols, colW, total, items, ratios, pd, g, below])

    // ---- lightbox ----
    const [open, setOpen] = useState<number | null>(null)
    const [shown, setShown] = useState(false)
    const [portalReady, setPortalReady] = useState(false)
    useEffect(() => setPortalReady(true), [])
    const openAt = (i: number) => {
        if (isCanvas || !items[i]?.src) return
        setOpen(i)
        requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    }
    const close = () => {
        setShown(false)
        window.setTimeout(() => setOpen(null), 260)
    }
    const step = (d: number) => setOpen((o) => (o === null ? o : (o + d + n) % n))
    useEffect(() => {
        if (open === null) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
            else if (e.key === "ArrowRight") step(1)
            else if (e.key === "ArrowLeft") step(-1)
        }
        const html = document.documentElement
        const prevOverflow = html.style.overflow
        html.style.overflow = "hidden"
        window.addEventListener("keydown", onKey)
        return () => {
            window.removeEventListener("keydown", onKey)
            html.style.overflow = prevOverflow
        }
    }, [open === null, n])

    // ---- motion: column parallax + viewport edge blur ----
    const colEls = useRef<(HTMLDivElement | null)[]>([])
    const topZoneRef = useRef<HTMLDivElement>(null)
    const bottomZoneRef = useRef<HTMLDivElement>(null)
    const openRef = useRef(open)
    openRef.current = open
    const motion = useRef({ parallax })
    motion.current = { parallax }

    useEffect(() => {
        if (isCanvas) return
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        let raf = 0
        let lastP = -1
        let lastCols = -1
        const tick = () => {
            const root = rootRef.current
            if (root) {
                const r = root.getBoundingClientRect()
                // keep the fixed blur zones over the grid only
                const show = r.bottom > 0 && r.top < window.innerHeight
                for (const z of [topZoneRef.current, bottomZoneRef.current]) {
                    if (!z) continue
                    z.style.left = `${r.left}px`
                    z.style.width = `${r.width}px`
                    z.style.display = show && openRef.current === null ? "block" : "none"
                }
                // each column drifts at its own speed once the grid's top has scrolled past
                const amount = reduced ? 0 : motion.current.parallax
                const p = Math.max(0, -r.top) * amount
                const els = colEls.current
                if (p !== lastP || els.length !== lastCols) {
                    lastP = p
                    lastCols = els.length
                    els.forEach((el, c) => {
                        if (el) el.style.transform = p ? `translate3d(0, ${(-p * DRIFT[c % DRIFT.length]).toFixed(2)}px, 0)` : ""
                    })
                }
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [isCanvas])

    const zone = (side: "top" | "bottom", height: number) => {
        const layers = 4
        const dir = side === "top" ? "to top" : "to bottom"
        return (
            <div
                ref={side === "top" ? topZoneRef : bottomZoneRef}
                aria-hidden
                style={{ position: "fixed", [side]: 0, left: 0, width: 0, height, pointerEvents: "none", zIndex: 3, display: "none" }}
            >
                {Array.from({ length: layers }, (_, i) => {
                    const b = edgeBlur / Math.pow(2, layers - 1 - i)
                    const mask = `linear-gradient(${dir}, transparent ${(i / layers) * 85}%, #000 ${((i + 1) / layers) * 85}%)`
                    return (
                        <div
                            key={i}
                            style={{
                                position: "absolute",
                                inset: 0,
                                backdropFilter: `blur(${b.toFixed(2)}px)`,
                                WebkitBackdropFilter: `blur(${b.toFixed(2)}px)`,
                                maskImage: mask,
                                WebkitMaskImage: mask,
                            }}
                        />
                    )
                })}
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${side === "top" ? "to bottom" : "to top"}, ${edgeColor}, transparent)` }} />
            </div>
        )
    }

    const current = open !== null ? items[open] : null
    const lightbox =
        current && portalReady
            ? createPortal(
                  <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={current.title || "Image"}
                      onClick={close}
                      style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 9999,
                          background: lightboxBg,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 20,
                          padding: "72px 24px 32px",
                          boxSizing: "border-box",
                          opacity: shown ? 1 : 0,
                          transition: "opacity 0.26s ease",
                          cursor: "zoom-out",
                      }}
                  >
                      <img
                          src={current.src}
                          alt={current.title}
                          style={{
                              maxWidth: "min(92vw, 1400px)",
                              maxHeight: "calc(100vh - 180px)",
                              objectFit: "contain",
                              borderRadius: imageRadius,
                              transform: shown ? "scale(1)" : "scale(0.94)",
                              transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
                              boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
                          }}
                      />
                      <div style={{ display: "flex", alignItems: "baseline", gap: 14, color: lightboxColor }}>
                          <span style={{ ...lightboxMetaFont, opacity: 0.6 }}>
                              {pad((open ?? 0) + 1)} / {pad(n)}
                          </span>
                          <span style={{ ...lightboxFont }}>{current.title}</span>
                          {current.category && <span style={{ ...lightboxMetaFont, opacity: 0.6 }}>{current.category}</span>}
                      </div>
                      <button
                          aria-label="Close"
                          onClick={(e) => {
                              e.stopPropagation()
                              close()
                          }}
                          style={{ position: "absolute", top: 24, right: 24, ...navButton(lightboxColor), ...lightboxMetaFont }}
                      >
                          Close ✕
                      </button>
                      {n > 1 && (
                          <>
                              <button
                                  aria-label="Previous image"
                                  onClick={(e) => {
                                      e.stopPropagation()
                                      step(-1)
                                  }}
                                  style={{ position: "absolute", left: 24, top: "50%", ...navButton(lightboxColor), ...lightboxMetaFont }}
                              >
                                  ←
                              </button>
                              <button
                                  aria-label="Next image"
                                  onClick={(e) => {
                                      e.stopPropagation()
                                      step(1)
                                  }}
                                  style={{ position: "absolute", right: 24, top: "50%", ...navButton(lightboxColor), ...lightboxMetaFont }}
                              >
                                  →
                              </button>
                          </>
                      )}
                  </div>,
                  document.body
              )
            : null

    return (
        <div ref={rootRef} style={{ ...style, position: "relative", width: "100%", overflow: "clip" }}>
            <style>{`
                .vtx-masonry-card img { transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1); }
                .vtx-masonry-card:hover img { transform: scale(1.025); }
                .vtx-masonry-card:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
            `}</style>
            <div style={{ display: "flex", gap: g, alignItems: "flex-start", width: "100%" }}>
                {columnsList.map((list, c) => (
                    <div
                        key={c}
                        ref={(el) => {
                            colEls.current[c] = el
                            colEls.current.length = columnsList.length
                        }}
                        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: g, willChange: "transform" }}
                    >
                        {list.map((i) => {
                            const it = items[i % n]
                            const r = ratioOf(it, i % n)
                            return (
                                <div
                                    key={i}
                                    className="vtx-masonry-card"
                                    role="button"
                                    tabIndex={0}
                                    aria-label={it.title ? `Enlarge ${it.title}` : "Enlarge image"}
                                    onClick={() => openAt(i % n)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            openAt(i % n)
                                        }
                                    }}
                                    style={{
                                        background: cardBg,
                                        borderRadius: cardRadius,
                                        padding: pd,
                                        cursor: it.src ? "zoom-in" : "default",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            position: "relative",
                                            borderRadius: imageRadius,
                                            overflow: "hidden",
                                            aspectRatio: `${1} / ${r}`,
                                            background: it.src ? "rgba(0,0,0,0.04)" : it.category,
                                        }}
                                    >
                                        {it.src && (
                                            <img
                                                src={it.src}
                                                alt={it.title}
                                                loading="lazy"
                                                decoding="async"
                                                draggable={false}
                                                style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                        )}
                                        {overlay && (it.title || (it.src && it.category)) && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    padding: "36px 10px 9px",
                                                    background: `linear-gradient(to top, ${overlayShade}, transparent)`,
                                                    color: overlayColor,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 3,
                                                    pointerEvents: "none",
                                                }}
                                            >
                                                {it.src && it.category && (
                                                    <span style={{ ...overlayMetaFont, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {it.category}
                                                    </span>
                                                )}
                                                <span style={{ ...overlayFont, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
                                            </div>
                                        )}
                                    </div>
                                    {below && (
                                        <div style={{ ...captionFont, color: captionColor, paddingTop: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {it.title}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
            <div ref={sentinelRef} aria-hidden style={{ height: 1, width: "100%" }} />
            <div
                ref={slotRef}
                aria-hidden
                style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 0, overflow: "hidden", visibility: "hidden", pointerEvents: "none" }}
            >
                {content}
            </div>
            {!isCanvas && edgeTop > 0 && zone("top", phone ? edgeTop * 0.6 : edgeTop)}
            {!isCanvas && edgeBottom > 0 && zone("bottom", phone ? edgeBottom * 0.6 : edgeBottom)}
            {lightbox}
        </div>
    )
}

function navButton(color: string): React.CSSProperties {
    return {
        transform: "translateY(-50%)",
        background: "transparent",
        border: `1px solid ${color}40`,
        color,
        borderRadius: 100,
        padding: "10px 16px",
        cursor: "pointer",
        lineHeight: 1,
    }
}

addPropertyControls(InfiniteMasonry, {
    content: {
        type: ControlType.Slot,
        title: "Content",
        description: "Connect a frame with a Collection List (CMS) of images.",
    },
    items: {
        type: ControlType.Array,
        title: "Manual",
        description: "Used when Content is empty.",
        control: {
            type: ControlType.Object,
            controls: {
                image: { type: ControlType.ResponsiveImage },
                title: { type: ControlType.String, defaultValue: "Exploration" },
                category: { type: ControlType.String, defaultValue: "" },
            },
        },
        defaultValue: [{ title: "Exploration" }],
    },
    columns: { type: ControlType.Number, title: "Columns", defaultValue: 4, min: 1, max: 8, step: 1, displayStepper: true },
    columnsTablet: { type: ControlType.Number, title: "Tablet Cols", defaultValue: 3, min: 1, max: 6, step: 1, displayStepper: true },
    columnsPhone: { type: ControlType.Number, title: "Phone Cols", defaultValue: 2, min: 1, max: 4, step: 1, displayStepper: true },
    tabletBelow: { type: ControlType.Number, title: "Tablet Below", defaultValue: 1000, min: 0, max: 2000, step: 10, unit: "px" },
    phoneBelow: { type: ControlType.Number, title: "Phone Below", defaultValue: 600, min: 0, max: 1200, step: 10, unit: "px" },
    gap: { type: ControlType.Number, defaultValue: 16, min: 0, max: 64, unit: "px" },
    cardPadding: { type: ControlType.Number, title: "Card Padding", defaultValue: 12, min: 0, max: 48, unit: "px" },
    cardBg: { type: ControlType.Color, title: "Card Color", defaultValue: "#E4DACB" },
    cardRadius: { type: ControlType.Number, title: "Card Radius", defaultValue: 10, min: 0, max: 40, unit: "px" },
    imageRadius: { type: ControlType.Number, title: "Image Radius", defaultValue: 4, min: 0, max: 40, unit: "px" },
    infinite: { type: ControlType.Boolean, title: "Infinite", defaultValue: true },
    showCaption: { type: ControlType.Boolean, title: "Captions", defaultValue: false },
    captionFont: {
        type: ControlType.Font,
        title: "Caption Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 12, variant: "Medium", letterSpacing: "0.02em", lineHeight: "1.2em" },
        hidden: (p) => !p.showCaption,
    },
    captionColor: { type: ControlType.Color, title: "Caption Color", defaultValue: "#8A8072", hidden: (p) => !p.showCaption },
    lightboxBg: { type: ControlType.Color, title: "Lightbox Bg", defaultValue: "rgba(20, 20, 20, 0.94)" },
    lightboxColor: { type: ControlType.Color, title: "Lightbox Text", defaultValue: "#EEE5D9" },
    lightboxFont: {
        type: ControlType.Font,
        title: "Lightbox Title",
        controls: "extended",
        defaultFontType: "serif",
        defaultValue: { fontSize: 32, lineHeight: "1em", letterSpacing: "-0.01em" },
    },
    edgeTop: { type: ControlType.Number, title: "Edge Top", defaultValue: 120, min: 0, max: 400, unit: "px", description: "Blurred band at the top of the screen over the grid." },
    edgeBottom: { type: ControlType.Number, title: "Edge Bottom", defaultValue: 120, min: 0, max: 400, unit: "px" },
    edgeBlur: { type: ControlType.Number, title: "Edge Blur", defaultValue: 10, min: 0, max: 40, unit: "px" },
    edgeColor: { type: ControlType.Color, title: "Edge Color", defaultValue: "#EEE5D9", description: "Usually the page background." },
    parallax: {
        type: ControlType.Number,
        title: "Parallax",
        defaultValue: 0.08,
        min: 0,
        max: 0.3,
        step: 0.01,
        description: "How much the columns drift apart while scrolling. 0 turns it off.",
    },
    overlayCaptions: {
        type: ControlType.Enum,
        title: "On Image Text",
        options: ["phone", "tablet", "always", "never"],
        optionTitles: ["Phone", "Tablet + Phone", "Always", "Never"],
        defaultValue: "phone",
        displaySegmentedControl: true,
    },
    gapPhone: { type: ControlType.Number, title: "Phone Gap", defaultValue: 10, min: 0, max: 48, unit: "px" },
    cardPaddingPhone: { type: ControlType.Number, title: "Phone Padding", defaultValue: 6, min: 0, max: 32, unit: "px" },
    overlayFont: {
        type: ControlType.Font,
        title: "On Image Title",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 13, variant: "Medium", letterSpacing: "-0.01em", lineHeight: "1.2em" },
        hidden: (p) => p.overlayCaptions === "never",
    },
    overlayMetaFont: {
        type: ControlType.Font,
        title: "On Image Meta",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 10, variant: "Medium", letterSpacing: "0.06em", lineHeight: "1.2em" },
        hidden: (p) => p.overlayCaptions === "never",
    },
    overlayColor: { type: ControlType.Color, title: "On Image Color", defaultValue: "#EEE5D9", hidden: (p) => p.overlayCaptions === "never" },
    overlayShade: { type: ControlType.Color, title: "Gradient", defaultValue: "rgba(20, 20, 20, 0.6)", hidden: (p) => p.overlayCaptions === "never" },
    lightboxMetaFont: {
        type: ControlType.Font,
        title: "Lightbox Meta",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 12, variant: "Medium", letterSpacing: "0.04em", lineHeight: "1.2em" },
    },
})
