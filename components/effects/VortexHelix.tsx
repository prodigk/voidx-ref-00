"use client"

import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

// Vortex Helix — a 3D spiral of project cards that turns on wheel, drag or page scroll.
//
// CMS: put a Collection List (items = a card with an Image + Title / Category /
// Subtitle text layers) inside a top-level frame on the canvas and connect that
// frame to the "Content" slot. The component reads image URLs, texts and links
// from it. Layer names it looks for: "Title", "Category", "Subtitle" (falls back
// to the order of text layers when names don't match).
//
// Sizes are relative to the component, so the spiral grows with the viewport.
// Below "Compact Below" width the project info moves under the spiral.

type Item = {
    bg: string
    title: string
    category: string
    subtitle: string
    link: string
}

type ManualItem = {
    image?: { src?: string; srcSet?: string; alt?: string }
    title?: string
    category?: string
    subtitle?: string
    link?: string
}

interface VortexHelixProps {
    content?: React.ReactNode
    items?: ManualItem[]
    mode?: "wheel" | "page"
    wheelScope?: "window" | "component"
    sensitivity?: number
    snap?: boolean
    autoplay?: boolean
    autoplayDelay?: number
    loop?: boolean
    glide?: number
    size?: number
    maxSize?: number
    sideReserve?: number
    cardsPerTurn?: number
    cardAspect?: number
    cardGap?: number
    rowGap?: number
    cardRadius?: number
    depth?: number
    tilt?: number
    roll?: number
    offsetX?: number
    offsetY?: number
    strips?: number
    backOpacity?: number
    focus?: number
    backBlur?: number
    edgeTop?: number
    edgeBottom?: number
    edgeBlur?: number
    edgeFade?: number
    edgeSides?: number
    compactBelow?: number
    showTitles?: boolean
    uppercase?: boolean
    titleFont?: React.CSSProperties
    titleColor?: string
    metaFont?: React.CSSProperties
    metaColor?: string
    titlesWidth?: number
    lineGap?: number
    activeBg?: string
    activeRadius?: number
    activePadding?: number
    showCounter?: boolean
    counterLabel?: string
    counterFont?: React.CSSProperties
    counterColor?: string
    insetX?: number
    insetBottom?: number
    newTab?: boolean
    style?: React.CSSProperties
}

const TAU = Math.PI * 2
const mod = (a: number, n: number) => ((a % n) + n) % n
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const pad = (x: number) => String(x).padStart(2, "0")
const cssUrl = (src: string) => `url("${src.replace(/"/g, '\\"')}")`
const scaleFont = (f: React.CSSProperties | undefined, k: number): React.CSSProperties | undefined => {
    if (!f || f.fontSize === undefined || k === 1) return f
    const fs = f.fontSize
    return { ...f, fontSize: typeof fs === "number" ? fs * k : `calc(${fs} * ${k})` }
}

const PLACEHOLDER_COLORS = [
    ["#a8c7e6", "#5d8fc4"],
    ["#f2b8c6", "#d9577c"],
    ["#c9d7b8", "#6f9a5b"],
    ["#2b2b2b", "#555"],
    ["#ffcf9f", "#f0743a"],
    ["#d6d0f5", "#7a6be0"],
    ["#e8e2d6", "#b3a68a"],
    ["#9fe0d6", "#2e9c8c"],
]
const PLACEHOLDERS: Item[] = PLACEHOLDER_COLORS.map(([a, b], i) => ({
    bg: `linear-gradient(135deg, ${a}, ${b})`,
    title: `Project ${pad(i + 1)}`,
    category: "Category",
    subtitle: "Connect a Collection List to the Content slot",
    link: "",
}))

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

function textLayers(el: Element) {
    return Array.from(el.querySelectorAll('[data-framer-component-type="RichTextContainer"]'))
        .map((l) => ({
            name: (l.getAttribute("data-framer-name") || "").toLowerCase(),
            text: (l.textContent || "").trim(),
        }))
        .filter((l) => l.text)
}

function extractItems(root: HTMLElement): Item[] {
    return findItemElements(root).map((el) => {
        const texts = textLayers(el)
        const byName = (re: RegExp) => texts.find((t) => re.test(t.name))
        const title = byName(/title|name|heading/)
        const category = byName(/category|tag|type|label/)
        const subtitle = byName(/subtitle|description|desc|caption|summary/)
        const rest = texts.filter((t) => t !== title && t !== category && t !== subtitle)
        const anchor = el.tagName === "A" ? (el as HTMLAnchorElement) : el.querySelector("a")
        const src = mediaOf(el)
        return {
            bg: src ? cssUrl(src) : "#ddd",
            title: (title || rest.shift())?.text || "",
            category: category?.text || "",
            subtitle: (subtitle || rest.shift())?.text || "",
            link: anchor?.getAttribute("href") || "",
        }
    })
}

// Stacked backdrop blurs, each masked a little closer to the edge, so the blur ramps up smoothly.
function BlurZone({ side, height, blur }: { side: "top" | "bottom"; height: number; blur: number }) {
    const layers = 4
    const dir = side === "top" ? "to top" : "to bottom"
    return (
        <div
            aria-hidden
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                [side]: 0,
                height: `${height}%`,
                pointerEvents: "none",
                zIndex: 1,
            }}
        >
            {Array.from({ length: layers }, (_, i) => {
                const b = blur / Math.pow(2, layers - 1 - i)
                const from = (i / layers) * 85
                const to = ((i + 1) / layers) * 85
                const mask = `linear-gradient(${dir}, transparent ${from}%, #000 ${to}%)`
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
        </div>
    )
}

/**
 * Vortex Helix
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function VortexHelix(props: VortexHelixProps) {
    const {
        content,
        items: manualItems = [],
        mode = "wheel",
        wheelScope = "window",
        sensitivity = 1,
        snap = true,
        autoplay = false,
        autoplayDelay = 4,
        loop = true,
        glide = 1.4,
        size: sizePct = 28,
        maxSize = 70,
        sideReserve = 0,
        cardsPerTurn = 6.5,
        cardAspect = 1.35,
        cardGap = 5,
        rowGap = 30,
        cardRadius = 10,
        depth = 3.6,
        tilt = -10,
        roll = 0,
        offsetX = 0,
        offsetY = 0,
        strips = 10,
        backOpacity = 0.6,
        focus = 0,
        backBlur = 3,
        edgeTop = 20,
        edgeBottom = 20,
        edgeBlur = 12,
        edgeFade = 0.9,
        edgeSides = 0,
        compactBelow = 960,
        showTitles = true,
        uppercase = true,
        titleFont,
        titleColor = "#141414",
        metaFont,
        metaColor = "#8a8072",
        titlesWidth = 280,
        lineGap = 96,
        activeBg = "rgba(0,0,0,0)",
        activeRadius = 16,
        activePadding = 16,
        showCounter = true,
        counterLabel = "Selected work",
        counterFont,
        counterColor = "#141414",
        insetX = 40,
        insetBottom = 40,
        newTab = false,
        style,
    } = props
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    const rootRef = useRef<HTMLDivElement>(null)
    const slotRef = useRef<HTMLDivElement>(null)
    const titlesRef = useRef<HTMLDivElement>(null)

    // ---- size ----
    const [size, setSize] = useState({ w: 1200, h: 800 })
    useLayoutEffect(() => {
        const el = rootRef.current
        if (!el) return
        const measure = () => {
            const w = el.clientWidth || 1200
            const h = el.clientHeight || 800
            setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    const compact = size.w < compactBelow

    // ---- items from slot ----
    const [slotItems, setSlotItems] = useState<Item[]>([])
    const anchorsRef = useRef<(HTMLAnchorElement | null)[]>([])
    useEffect(() => {
        const el = slotRef.current
        if (!el) return
        let raf = 0
        const read = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
                const next = extractItems(el)
                anchorsRef.current = findItemElements(el).map((item) =>
                    item.tagName === "A" ? (item as HTMLAnchorElement) : (item.querySelector("a") as HTMLAnchorElement | null)
                )
                setSlotItems((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
            })
        }
        read()
        const mo = new MutationObserver(read)
        mo.observe(el, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["src", "srcset", "style", "href"],
        })
        return () => {
            mo.disconnect()
            cancelAnimationFrame(raf)
        }
    }, [content])

    const items: Item[] = useMemo(() => {
        if (slotItems.length) return slotItems
        const manual = (manualItems || [])
            .filter((m) => m && m.image?.src)
            .map((m) => ({
                bg: cssUrl(m.image!.src!),
                title: m.title || "",
                category: m.category || "",
                subtitle: m.subtitle || "",
                link: m.link || "",
            }))
        return manual.length ? manual : PLACEHOLDERS
    }, [slotItems, manualItems])
    const n = items.length

    // ---- geometry (all relative to the component size) ----
    const geo = useMemo(() => {
        const S = Math.max(2, Math.round(strips))
        const turns = Math.max(2, cardsPerTurn)
        // keep the side text columns clear on wide layouts; compact layouts stack text instead
        const reserveCap = !compact && sideReserve > 0 ? size.w / 2 - sideReserve : Infinity
        const R = Math.max(60, Math.min((size.w * sizePct) / 100, (size.h * maxSize) / 100, reserveCap))
        const A = TAU / turns
        const span = A * (1 - clamp(cardGap, 0, 80) / 100)
        const dt = span / S
        const facetW = 2 * R * Math.tan(dt / 2)
        const cardW = facetW * S
        const cardH = cardW / Math.max(0.3, cardAspect)
        const pitch = cardH * (1 + rowGap / 100)
        const P = R * Math.max(1.3, depth)
        const front = P / (P - R)
        const half = clamp(Math.ceil(((size.h / 2 + cardH * front) / pitch) * turns) + 1, 2, 48)
        return { S, R, A, span, dt, facetW, cardW, cardH, pitch, P, half, pool: half * 2 + 1 }
    }, [strips, cardsPerTurn, size.w, size.h, sizePct, maxSize, sideReserve, compact, cardGap, cardAspect, rowGap, depth])
    const { S, pool } = geo

    // ---- motion state ----
    const posRef = useRef(0)
    // Velocity of the spring that carries `posRef` toward `targetRef` (cards per second).
    const velRef = useRef(0)
    const targetRef = useRef(0)
    const frontRefs = useRef<(HTMLDivElement | null)[]>([])
    const backRefs = useRef<(HTMLDivElement | null)[]>([])
    const frontInner = useRef<(HTMLDivElement | null)[]>([])
    const backInner = useRef<(HTMLDivElement | null)[]>([])
    const slotV = useRef<number[]>([])
    const sides = useRef<number[]>([])
    // Critically damped spring: settles in about `glide` seconds without overshooting.
    const omega = 5.8 / Math.max(0.2, glide)
    const live = useRef({ items, geo, backOpacity, focus, loop, n, lineGap, compact, sensitivity, snap, omega })
    live.current = { items, geo, backOpacity, focus, loop, n, lineGap, compact, sensitivity, snap, omega }
    const [activeIdx, setActiveIdx] = useState(0)
    const activeRef = useRef(0)

    const applyFrame = (pos: number, force = false) => {
        const { items, geo, backOpacity, focus, loop, n, lineGap, compact } = live.current
        const { S, R, A, span, dt, half, pool, pitch, P } = geo
        const flipAt = R / P
        // shear each strip so the card edges follow the helix slope instead of stair-stepping
        const skew = Math.atan(pitch / (TAU * R))
        const base = Math.floor(pos) - half
        for (let j = 0; j < pool; j++) {
            const v = base + mod(j - base, pool)
            const visible = loop || (v >= 0 && v < n)
            const changed = force || slotV.current[j] !== v
            slotV.current[j] = v
            const item = items[mod(v, n)]
            const centerA = (v - pos) * A
            const edge = clamp(half - Math.abs(v - pos), 0, 1)
            // dim everything except the card in focus
            const lit = edge * (1 - clamp(focus, 0, 1) * clamp(Math.abs(v - pos), 0, 1))
            for (let s = 0; s < S; s++) {
                const k = j * S + s
                const f = frontRefs.current[k]
                const b = backRefs.current[k]
                const fi = frontInner.current[k]
                const bi = backInner.current[k]
                if (!f || !b || !fi || !bi) continue
                if (changed) {
                    const bg = `${item.bg} center / cover no-repeat`
                    fi.style.background = bg
                    bi.style.background = bg
                    sides.current[k] = 0
                    if (!visible) {
                        f.style.display = "none"
                        b.style.display = "none"
                    }
                }
                if (!visible) continue
                const a = centerA + (s + 0.5) * dt - span / 2
                const back = Math.cos(a) < flipAt
                const side = back ? 1 : 2
                if (sides.current[k] !== side) {
                    sides.current[k] = side
                    f.style.display = back ? "none" : "block"
                    b.style.display = back ? "block" : "none"
                }
                const y = (pitch * a) / TAU
                const t = `translate3d(0,${y.toFixed(2)}px,0) rotateY(${a.toFixed(5)}rad) translateZ(${R.toFixed(2)}px) skewY(${skew.toFixed(5)}rad)`
                if (back) {
                    b.style.transform = `${t} rotateY(180deg)`
                    b.style.opacity = (backOpacity * lit).toFixed(3)
                } else {
                    f.style.transform = t
                    f.style.opacity = lit.toFixed(3)
                }
            }
        }
        const list = titlesRef.current
        if (list) {
            for (const child of Array.from(list.children) as HTMLElement[]) {
                const d = Number(child.dataset.v) - pos
                const ad = Math.abs(d)
                if (compact) {
                    child.style.transform = `translate3d(-50%,${(d * lineGap * 0.45).toFixed(2)}px,0)`
                    child.style.opacity = clamp(1 - ad * 1.6, 0, 1).toFixed(3)
                } else {
                    child.style.transform = `translate3d(0,${(d * lineGap).toFixed(2)}px,0) translateY(-50%) scale(${(1 - Math.min(ad, 1) * 0.28).toFixed(3)})`
                    child.style.opacity = clamp(1 - ad * 0.42, 0, 1).toFixed(3)
                }
                // the card behind the active title fades in as the item reaches the centre
                const bg = child.firstElementChild as HTMLElement | null
                if (bg && bg.dataset.bg) bg.style.opacity = clamp(1 - ad * 1.6, 0, 1).toFixed(3)
                // neighbours stay on one line (they are scaled down); only the focused title may wrap
                const title = child.querySelector("[data-title]") as HTMLElement | null
                if (title) {
                    const ws = !compact && ad > 0.5 ? "nowrap" : "normal"
                    if (title.style.whiteSpace !== ws) title.style.whiteSpace = ws
                }
                const sub = child.querySelector("[data-sub]") as HTMLElement | null
                if (sub) {
                    sub.style.opacity = compact ? "1" : clamp(1 - ad * 1.6, 0, 1).toFixed(3)
                    const disp = !compact && ad > 0.6 ? "none" : "block"
                    if (sub.style.display !== disp) sub.style.display = disp
                }
            }
        }
        const act = Math.round(pos)
        if (act !== activeRef.current) {
            activeRef.current = act
            setActiveIdx(act)
        }
    }
    const applyRef = useRef(applyFrame)
    applyRef.current = applyFrame

    // ---- input helpers ----
    const lastInput = useRef(0)
    const snapTimer = useRef<number>(0)
    const clampTarget = (t: number) => (live.current.loop ? t : clamp(t, 0, live.current.n - 1))
    const scheduleSnap = (delay = 180) => {
        window.clearTimeout(snapTimer.current)
        if (!live.current.snap) return
        snapTimer.current = window.setTimeout(() => {
            targetRef.current = clampTarget(Math.round(targetRef.current))
        }, delay)
    }
    const nudge = (delta: number) => {
        targetRef.current = clampTarget(targetRef.current + delta)
        lastInput.current = performance.now()
        scheduleSnap()
    }

    // ---- page scroll tracking (component inside a Sticky frame in a tall section) ----
    const trackRef = useRef<{ sticky: HTMLElement | null; track: HTMLElement | null }>({ sticky: null, track: null })
    const scrollInfo = () => {
        const { sticky, track } = trackRef.current
        if (sticky && track) {
            const t = track.getBoundingClientRect()
            const st = sticky.getBoundingClientRect()
            const range = t.height - st.height
            return {
                progress: range > 0 ? clamp((st.top - t.top) / range, 0, 1) : 0,
                start: t.top + window.scrollY,
                range,
            }
        }
        const range = document.documentElement.scrollHeight - window.innerHeight
        return { progress: range > 0 ? clamp(window.scrollY / range, 0, 1) : 0, start: 0, range }
    }
    useEffect(() => {
        if (isCanvas || mode !== "page") return
        let p = rootRef.current?.parentElement || null
        let sticky: HTMLElement | null = null
        while (p && p !== document.body) {
            if (getComputedStyle(p).position === "sticky") {
                sticky = p
                break
            }
            p = p.parentElement
        }
        trackRef.current = { sticky, track: sticky?.parentElement || null }
        const onScroll = () => {
            targetRef.current = scrollInfo().progress * Math.max(0, live.current.n - 1)
        }
        onScroll()
        posRef.current = targetRef.current
        velRef.current = 0
        window.addEventListener("scroll", onScroll, { passive: true })
        window.addEventListener("resize", onScroll)
        return () => {
            window.removeEventListener("scroll", onScroll)
            window.removeEventListener("resize", onScroll)
        }
    }, [mode, isCanvas, n])

    // ---- wheel + keyboard ----
    useEffect(() => {
        const el = rootRef.current
        if (!el || isCanvas || mode !== "wheel") return
        const target: Window | HTMLElement = wheelScope === "window" ? window : el
        const onWheel = (e: Event) => {
            const we = e as WheelEvent
            we.preventDefault()
            const unit = we.deltaMode === 1 ? 16 : we.deltaMode === 2 ? 400 : 1
            const d = (Math.abs(we.deltaY) >= Math.abs(we.deltaX) ? we.deltaY : we.deltaX) * unit
            nudge(d * 0.003 * live.current.sensitivity)
        }
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
            const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0
            if (!step) return
            e.preventDefault()
            targetRef.current = clampTarget(Math.round(targetRef.current) + step)
            lastInput.current = performance.now()
        }
        target.addEventListener("wheel", onWheel, { passive: false })
        if (wheelScope === "window") window.addEventListener("keydown", onKey)
        return () => {
            target.removeEventListener("wheel", onWheel)
            window.removeEventListener("keydown", onKey)
            window.clearTimeout(snapTimer.current)
        }
    }, [mode, wheelScope, isCanvas])

    // ---- drag / swipe (either axis) with a little momentum ----
    const drag = useRef({ active: false, moved: false, axis: "x", x: 0, y: 0, start: 0, lastT: 0, lastV: 0, vel: 0 })
    const onPointerDown = (e: React.PointerEvent) => {
        if (isCanvas || mode !== "wheel" || (e.pointerType === "mouse" && e.button !== 0)) return
        const now = performance.now()
        drag.current = { active: true, moved: false, axis: "x", x: e.clientX, y: e.clientY, start: targetRef.current, lastT: now, lastV: targetRef.current, vel: 0 }
        window.clearTimeout(snapTimer.current)
    }
    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d.active) return
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        if (!d.moved) {
            if (Math.hypot(dx, dy) < 6) return
            d.moved = true
            d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }
        const g = live.current.geo
        const delta = d.axis === "x" ? -dx / (g.cardW * 1.1) : -dy / (g.cardH * 2)
        const t = clampTarget(d.start + delta * live.current.sensitivity)
        const now = performance.now()
        const dtm = Math.max(1, now - d.lastT)
        d.vel = d.vel * 0.6 + ((t - d.lastV) / dtm) * 0.4
        d.lastT = now
        d.lastV = t
        targetRef.current = t
        lastInput.current = now
    }
    const onPointerUp = () => {
        const d = drag.current
        if (!d.active) return
        d.active = false
        if (!d.moved) return
        // Keep the hand's speed and let the spring carry it on to where it would naturally come to rest.
        const v = performance.now() - d.lastT < 90 ? clamp(d.vel * 1000, -24, 24) : 0
        velRef.current = v
        const rest = posRef.current + v / live.current.omega
        targetRef.current = clampTarget(live.current.snap ? Math.round(rest) : rest)
    }

    // ---- click: focus card / open link ----
    const goTo = (v: number) => {
        if (mode === "page" && !isCanvas) {
            const idx = loop ? mod(v, n) : clamp(v, 0, n - 1)
            const info = scrollInfo()
            window.scrollTo({ top: info.start + (idx / Math.max(1, n - 1)) * info.range, behavior: "smooth" })
        } else {
            targetRef.current = clampTarget(v)
            lastInput.current = performance.now()
        }
    }
    const onClick = (e: React.MouseEvent) => {
        if (drag.current.moved) {
            drag.current.moved = false
            return
        }
        const strip = (e.target as HTMLElement).closest("[data-slot]") as HTMLElement | null
        if (!strip) return
        const v = slotV.current[Number(strip.dataset.slot)]
        if (v === undefined) return
        if (Math.round(posRef.current) === v) {
            const item = items[mod(v, n)]
            if (!item.link || isCanvas) return
            if (newTab) {
                window.open(item.link, "_blank", "noopener")
                return
            }
            // click the real CMS link so Framer's router (and any page transition) handles it
            const anchor = slotItems.length ? anchorsRef.current[mod(v, n)] : null
            if (anchor) {
                anchor.dataset.transitionLabel = item.title
                anchor.click()
            } else {
                // No CMS anchors outside Framer: click a temporary link so the page transition can catch it.
                const tmp = document.createElement("a")
                tmp.href = item.link
                tmp.dataset.transitionLabel = item.title
                tmp.style.display = "none"
                document.body.appendChild(tmp)
                tmp.click()
                tmp.remove()
            }
        } else goTo(v)
    }

    // ---- autoplay ----
    useEffect(() => {
        if (isCanvas || mode !== "wheel" || !autoplay) return
        const id = window.setInterval(() => {
            if (drag.current.active || performance.now() - lastInput.current < autoplayDelay * 1000) return
            targetRef.current = clampTarget(Math.round(targetRef.current) + 1)
            if (!live.current.loop && Math.round(posRef.current) >= live.current.n - 1) targetRef.current = 0
        }, Math.max(0.5, autoplayDelay) * 1000)
        return () => window.clearInterval(id)
    }, [mode, autoplay, autoplayDelay, isCanvas])

    // ---- render loop ----
    useLayoutEffect(() => {
        applyFrame(posRef.current, true)
    })
    useEffect(() => {
        if (isCanvas) return
        let raf = 0
        let last = performance.now()
        const tick = (now: number) => {
            const dtime = Math.min(0.05, (now - last) / 1000)
            last = now
            const prev = posRef.current
            const target = targetRef.current
            // While dragging, follow the pointer closely; otherwise glide on the slow spring.
            const w = drag.current.active ? 22 : live.current.omega
            let x = prev
            let v = velRef.current
            for (let left = dtime; left > 0; left -= 1 / 120) {
                const h = Math.min(left, 1 / 120)
                v += (w * w * (target - x) - 2 * w * v) * h
                x += v * h
            }
            if (Math.abs(target - x) < 0.0005 && Math.abs(v) < 0.002) {
                x = target
                v = 0
            }
            velRef.current = v
            if (x !== prev) {
                posRef.current = x
                applyRef.current(x)
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [isCanvas])

    // ---- render ----
    const radius = Math.min(cardRadius, geo.cardH / 2)
    const stripStyle = (s: number, back: boolean): React.CSSProperties => {
        const leftEdge = back ? s === S - 1 : s === 0
        const rightEdge = back ? s === 0 : s === S - 1
        return {
            position: "absolute",
            left: -geo.facetW / 2 - 0.5,
            top: -geo.cardH / 2,
            width: geo.facetW + (rightEdge ? 0 : 1),
            height: geo.cardH,
            overflow: "hidden",
            cursor: "pointer",
            display: "none",
            willChange: "transform, opacity",
            borderTopLeftRadius: leftEdge ? radius : 0,
            borderBottomLeftRadius: leftEdge ? radius : 0,
            borderTopRightRadius: rightEdge ? radius : 0,
            borderBottomRightRadius: rightEdge ? radius : 0,
        }
    }
    const frontNodes: React.ReactNode[] = []
    const backNodes: React.ReactNode[] = []
    for (let j = 0; j < pool; j++) {
        for (let s = 0; s < S; s++) {
            const k = j * S + s
            frontNodes.push(
                <div key={k} data-slot={j} ref={(el) => { frontRefs.current[k] = el }} style={stripStyle(s, false)}>
                    <div
                        ref={(el) => { frontInner.current[k] = el }}
                        style={{ position: "absolute", top: 0, left: -s * geo.facetW, width: geo.cardW, height: geo.cardH }}
                    />
                </div>
            )
            backNodes.push(
                <div key={k} data-slot={j} ref={(el) => { backRefs.current[k] = el }} style={stripStyle(s, true)}>
                    <div
                        ref={(el) => { backInner.current[k] = el }}
                        style={{ position: "absolute", top: 0, left: -(S - 1 - s) * geo.facetW, width: geo.cardW, height: geo.cardH }}
                    />
                </div>
            )
        }
    }

    const fadeAlpha = clamp(1 - edgeFade, 0, 1)
    const vMask = `linear-gradient(to bottom, rgba(0,0,0,${fadeAlpha}) 0%, #000 ${edgeTop}%, #000 ${100 - edgeBottom}%, rgba(0,0,0,${fadeAlpha}) 100%)`
    const hMask = `linear-gradient(to right, rgba(0,0,0,0.15) 0%, #000 ${edgeSides}%, #000 ${100 - edgeSides}%, rgba(0,0,0,0.15) 100%)`
    const masks = edgeSides > 0 && !compact ? { WebkitMaskImage: `${vMask}, ${hMask}`, maskImage: `${vMask}, ${hMask}`, WebkitMaskComposite: "source-in", maskComposite: "intersect" } : { WebkitMaskImage: vMask, maskImage: vMask }
    const origin = `${50 + offsetX}% ${50 + offsetY}%`
    const sceneStyle: React.CSSProperties = {
        position: "absolute",
        left: `${50 + offsetX}%`,
        top: `${50 + offsetY}%`,
        width: 0,
        height: 0,
        transformStyle: "preserve-3d",
        transform: `rotateX(${tilt}deg) rotateZ(${roll}deg)`,
    }
    const titleRange: number[] = []
    for (let v = activeIdx - 3; v <= activeIdx + 3; v++) if (loop || (v >= 0 && v < n)) titleRange.push(v)
    const tf = scaleFont(titleFont, compact ? 0.78 : 1)
    const case_ = uppercase ? "uppercase" : "none"

    return (
        <div
            ref={rootRef}
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                touchAction: mode === "wheel" ? "none" : undefined,
                userSelect: "none",
                WebkitUserSelect: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <div
                style={{ position: "absolute", inset: 0, zIndex: 0, isolation: "isolate", ...(masks as React.CSSProperties) }}
                onClick={onClick}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        perspective: geo.P,
                        perspectiveOrigin: origin,
                        filter: backBlur > 0 ? `blur(${backBlur}px)` : undefined,
                    }}
                >
                    <div style={sceneStyle}>{backNodes}</div>
                </div>
                <div style={{ position: "absolute", inset: 0, perspective: geo.P, perspectiveOrigin: origin }}>
                    <div style={sceneStyle}>{frontNodes}</div>
                </div>
            </div>

            {edgeBlur > 0 && edgeTop > 0 && <BlurZone side="top" height={edgeTop} blur={edgeBlur} />}
            {edgeBlur > 0 && edgeBottom > 0 && <BlurZone side="bottom" height={edgeBottom} blur={edgeBlur} />}

            {showTitles && (
                <div
                    ref={titlesRef}
                    style={
                        compact
                            ? { position: "absolute", left: 0, right: 0, bottom: insetBottom, height: 0, zIndex: 2, pointerEvents: "none", isolation: "isolate" }
                            : { position: "absolute", right: insetX, top: "50%", width: titlesWidth, height: 0, zIndex: 2, pointerEvents: "none", isolation: "isolate" }
                    }
                >
                    {titleRange.map((v) => {
                        const it = items[mod(v, n)]
                        const meta = compact ? [`${pad(mod(v, n) + 1)}/${pad(n)}`, it.category].filter(Boolean).join(" — ") : it.category
                        return (
                            <div
                                key={v}
                                data-v={v}
                                style={{
                                    ...(compact
                                        ? { position: "absolute", left: "50%", bottom: 0, width: Math.min(size.w - 32, 420) }
                                        : { position: "absolute", left: 0, right: 0, top: 0, transformOrigin: "50% 50%" }),
                                    textAlign: "center",
                                    padding: activePadding,
                                    boxSizing: "border-box",
                                }}
                            >
                                <div
                                    data-bg="1"
                                    style={{ position: "absolute", inset: 0, borderRadius: activeRadius, background: activeBg, opacity: 0, zIndex: -1 }}
                                />
                                {meta && <div style={{ ...metaFont, color: metaColor, marginBottom: 8, textTransform: case_ }}>{meta}</div>}
                                <div data-title="1" style={{ ...tf, color: titleColor, textTransform: case_ }}>{it.title}</div>
                                {it.subtitle && <div data-sub="1" style={{ ...metaFont, color: metaColor, marginTop: 8 }}>{it.subtitle}</div>}
                            </div>
                        )
                    })}
                </div>
            )}

            {showCounter && !compact && (
                <div
                    style={{
                        position: "absolute",
                        left: insetX,
                        bottom: insetBottom,
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 10,
                        zIndex: 2,
                        pointerEvents: "none",
                    }}
                >
                    {counterLabel && (
                        <span style={{ ...metaFont, color: metaColor, paddingBottom: 6, textTransform: case_ }}>{counterLabel}</span>
                    )}
                    <span style={{ ...counterFont, color: counterColor, lineHeight: 0.8 }}>{pad(mod(activeIdx, n) + 1)}</span>
                    <span style={{ ...metaFont, color: metaColor }}>/{pad(n)}</span>
                </div>
            )}

            <div
                ref={slotRef}
                aria-hidden
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: 0,
                    overflow: "hidden",
                    visibility: "hidden",
                    pointerEvents: "none",
                }}
            >
                {content}
            </div>
        </div>
    )
}

addPropertyControls(VortexHelix, {
    content: {
        type: ControlType.Slot,
        title: "Content",
        description: "Connect a frame with a Collection List (CMS) or several frames with images.",
    },
    items: {
        type: ControlType.Array,
        title: "Manual",
        description: "Used when Content is empty.",
        control: {
            type: ControlType.Object,
            controls: {
                image: { type: ControlType.ResponsiveImage },
                title: { type: ControlType.String, defaultValue: "Project" },
                category: { type: ControlType.String, defaultValue: "" },
                subtitle: { type: ControlType.String, defaultValue: "" },
                link: { type: ControlType.Link },
            },
        },
        defaultValue: [{ title: "Project" }],
    },
    mode: {
        type: ControlType.Enum,
        title: "Drive",
        options: ["wheel", "page"],
        optionTitles: ["Wheel & Drag", "Page Scroll"],
        displaySegmentedControl: true,
        defaultValue: "wheel",
        description: "Page Scroll: put the component in a Sticky frame inside a tall section.",
    },
    wheelScope: {
        type: ControlType.Enum,
        title: "Wheel On",
        options: ["window", "component"],
        optionTitles: ["Whole Page", "Component"],
        displaySegmentedControl: true,
        defaultValue: "window",
        hidden: (p) => p.mode !== "wheel",
    },
    sensitivity: { type: ControlType.Number, defaultValue: 1, min: 0.1, max: 5, step: 0.1, hidden: (p) => p.mode !== "wheel" },
    snap: { type: ControlType.Boolean, defaultValue: true, hidden: (p) => p.mode !== "wheel" },
    autoplay: { type: ControlType.Boolean, defaultValue: false, hidden: (p) => p.mode !== "wheel" },
    autoplayDelay: {
        type: ControlType.Number,
        title: "Delay",
        defaultValue: 4,
        min: 0.5,
        max: 20,
        step: 0.5,
        unit: "s",
        hidden: (p) => p.mode !== "wheel" || !p.autoplay,
    },
    loop: { type: ControlType.Boolean, defaultValue: true },
    glide: {
        type: ControlType.Number,
        title: "Glide",
        defaultValue: 1.4,
        min: 0.3,
        max: 4,
        step: 0.1,
        unit: "s",
        description: "How long the spiral keeps moving and eases out after a scroll or drag.",
    },
    size: { type: ControlType.Number, title: "Size", defaultValue: 28, min: 10, max: 80, step: 1, unit: "%", description: "Radius as % of the component width." },
    maxSize: { type: ControlType.Number, title: "Max Size", defaultValue: 70, min: 10, max: 150, step: 1, unit: "%", description: "Radius cap as % of the component height." },
    sideReserve: { type: ControlType.Number, title: "Side Reserve", defaultValue: 0, min: 0, max: 800, step: 10, unit: "px", description: "Space kept free on each side for text columns (not in compact mode)." },
    cardsPerTurn: { type: ControlType.Number, title: "Cards / Turn", defaultValue: 6.5, min: 2, max: 16, step: 0.1 },
    cardAspect: { type: ControlType.Number, title: "Card Ratio", defaultValue: 1.35, min: 0.5, max: 3, step: 0.05, description: "Card width ÷ height." },
    cardGap: { type: ControlType.Number, title: "Card Gap", defaultValue: 5, min: 0, max: 50, step: 1, unit: "%" },
    rowGap: { type: ControlType.Number, title: "Row Gap", defaultValue: 30, min: 0, max: 200, step: 1, unit: "%" },
    cardRadius: { type: ControlType.Number, title: "Radius", defaultValue: 10, min: 0, max: 60, step: 1, unit: "px" },
    depth: { type: ControlType.Number, title: "Perspective", defaultValue: 3.6, min: 1.3, max: 10, step: 0.1 },
    tilt: { type: ControlType.Number, defaultValue: -10, min: -60, max: 60, step: 1, unit: "°" },
    roll: { type: ControlType.Number, defaultValue: 0, min: -45, max: 45, step: 1, unit: "°" },
    offsetX: { type: ControlType.Number, title: "Offset X", defaultValue: 0, min: -40, max: 40, step: 1, unit: "%" },
    offsetY: { type: ControlType.Number, title: "Offset Y", defaultValue: 0, min: -40, max: 40, step: 1, unit: "%" },
    strips: { type: ControlType.Number, title: "Smoothness", defaultValue: 10, min: 2, max: 30, step: 1 },
    backOpacity: { type: ControlType.Number, title: "Back Opacity", defaultValue: 0.6, min: 0, max: 1, step: 0.05 },
    focus: { type: ControlType.Number, title: "Focus", defaultValue: 0, min: 0, max: 1, step: 0.05, description: "Dims every card except the selected one." },
    backBlur: { type: ControlType.Number, title: "Back Blur", defaultValue: 3, min: 0, max: 20, step: 0.5, unit: "px" },
    edgeTop: { type: ControlType.Number, title: "Edge Top", defaultValue: 20, min: 0, max: 50, step: 1, unit: "%" },
    edgeBottom: { type: ControlType.Number, title: "Edge Bottom", defaultValue: 20, min: 0, max: 50, step: 1, unit: "%" },
    edgeBlur: { type: ControlType.Number, title: "Edge Blur", defaultValue: 12, min: 0, max: 40, step: 1, unit: "px" },
    edgeFade: { type: ControlType.Number, title: "Edge Fade", defaultValue: 0.9, min: 0, max: 1, step: 0.05 },
    edgeSides: { type: ControlType.Number, title: "Edge Sides", defaultValue: 0, min: 0, max: 40, step: 1, unit: "%", description: "Fades the spiral under side text columns (not in compact mode)." },
    compactBelow: { type: ControlType.Number, title: "Compact Below", defaultValue: 960, min: 0, max: 2000, step: 10, unit: "px", description: "Below this width the project info moves under the spiral." },
    showTitles: { type: ControlType.Boolean, title: "Titles", defaultValue: true },
    uppercase: { type: ControlType.Boolean, title: "Uppercase", defaultValue: true, hidden: (p) => !p.showTitles },
    titleFont: {
        type: ControlType.Font,
        title: "Title Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 26, variant: "Medium", letterSpacing: "-0.03em", lineHeight: "1em" },
        hidden: (p) => !p.showTitles,
    },
    titleColor: { type: ControlType.Color, title: "Title Color", defaultValue: "#141414", hidden: (p) => !p.showTitles },
    metaFont: {
        type: ControlType.Font,
        title: "Meta Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 11, variant: "Medium", lineHeight: "1.3em" },
    },
    metaColor: { type: ControlType.Color, title: "Meta Color", defaultValue: "#8a8072" },
    titlesWidth: { type: ControlType.Number, title: "Titles Width", defaultValue: 280, min: 80, max: 800, unit: "px", hidden: (p) => !p.showTitles },
    lineGap: { type: ControlType.Number, title: "Title Gap", defaultValue: 96, min: 20, max: 300, unit: "px", hidden: (p) => !p.showTitles },
    activeBg: { type: ControlType.Color, title: "Active Card", defaultValue: "rgba(0,0,0,0)", hidden: (p) => !p.showTitles },
    activeRadius: { type: ControlType.Number, title: "Card Radius", defaultValue: 16, min: 0, max: 48, unit: "px", hidden: (p) => !p.showTitles },
    activePadding: { type: ControlType.Number, title: "Card Padding", defaultValue: 16, min: 0, max: 48, unit: "px", hidden: (p) => !p.showTitles },
    showCounter: { type: ControlType.Boolean, title: "Counter", defaultValue: true },
    counterLabel: { type: ControlType.String, title: "Label", defaultValue: "Selected work", hidden: (p) => !p.showCounter },
    counterFont: {
        type: ControlType.Font,
        title: "Counter Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 64, variant: "Medium", letterSpacing: "-0.05em", lineHeight: "1em" },
        hidden: (p) => !p.showCounter,
    },
    counterColor: { type: ControlType.Color, title: "Counter Color", defaultValue: "#141414", hidden: (p) => !p.showCounter },
    insetX: { type: ControlType.Number, title: "Inset X", defaultValue: 40, min: 0, max: 400, unit: "px" },
    insetBottom: { type: ControlType.Number, title: "Inset Bottom", defaultValue: 40, min: 0, max: 400, unit: "px" },
    newTab: { type: ControlType.Boolean, title: "New Tab", defaultValue: false },
})
