"use client"

import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

// Page Transition — a brush-stroke wipe between pages (Next.js version: lives in the root layout).
//
// Put one instance on every page (or in a layout template): position Fixed, full
// screen, top-most layer. It catches clicks on internal links, paints the screen
// with a few wide brush strokes, lets Framer navigate, then wipes the strokes away
// on the new page. Every transition draws new strokes — direction, wave and timing
// vary a little each time. A link can set the text shown mid-transition with a
// `data-transition-label` attribute (Vortex Helix does this with the project title).

interface PageTransitionProps {
    leadColor?: string
    mainColor?: string
    strokes?: number
    randomness?: number
    coverDuration?: number
    revealDuration?: number
    hold?: number
    showLabel?: boolean
    labelFont?: React.CSSProperties
    labelColor?: string
    preview?: boolean
    style?: React.CSSProperties
}

const KEY = "vortex-page-transition"
const EASE = "cubic-bezier(0.45, 0, 0.2, 1)"
const LABEL_EASE = "cubic-bezier(0.65, 0, 0.35, 1)"
// How far the lead colour runs ahead of the main stroke, as a share of a stroke's duration.
const LEAD = 0.16
// The lead stroke is a touch narrower, so the main stroke hides its edges completely.
const LEAD_WIDTH = 0.9
const VIEW_H = 1000

type Stored = { label: string; seed: number; t: number }

// Where a stroke stops covering new ground (cover) and starts uncovering it (reveal), as path progress.
type Span = { cover: number; reveal: number }

// Delay and duration are shares of the whole cover/reveal time.
type Stroke = { d: string; width: number; delay: number; duration: number; main: Span; lead: Span }

// Only animate the part of a stroke that is on screen, so there is no dead time while
// a brush tip travels off-screen. `half` is the band half-width the stroke must cover.
function span(visible: number, length: number, radius: number, half: number): Span {
    const inner = Math.sqrt(Math.max(0, radius * radius - half * half * 1.1))
    return {
        cover: Math.min(1, (visible + radius - inner) / length + 0.035),
        reveal: Math.max(0, (radius + inner) / length - 0.02),
    }
}

function random(seed: number): () => number {
    let t = seed >>> 0
    return () => {
        t = (t + 0x6d2b79f5) >>> 0
        let r = Math.imul(t ^ (t >>> 15), 1 | t)
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
}

// One wide, gently waving stroke per band; neighbours overlap so the screen is always
// fully covered. Strokes run along the long side of the screen (vertical on phones).
// The seed picks direction, wave and timing, so the next page can redraw exactly the
// strokes this page painted.
function makeStrokes(count: number, randomness: number, seed: number, viewW: number): Stroke[] {
    const rand = random(seed)
    const jitter = (amount: number) => (rand() * 2 - 1) * amount * randomness
    const portrait = viewW < VIEW_H
    const along = portrait ? VIEW_H : viewW
    const cross = portrait ? viewW : VIEW_H
    const bands = portrait ? Math.min(count, Math.max(2, Math.round((count * cross * 1.3) / VIEW_H))) : count
    const band = cross / bands
    const wave = Math.min(60, band * 0.16)
    // Generous overlap so neighbouring strokes always close up before the solid layer fades in.
    const width = band * 1.6 + wave * 2 * randomness
    const reach = width / 2 + 4
    const half = band / 2 + wave * randomness
    const length = along + reach * 2
    const flip = rand() < 0.5
    const reverse = rand() < 0.5
    const n = (v: number) => v.toFixed(1)
    const pt = (a: number, c: number) => (portrait ? `${n(c)} ${n(a)}` : `${n(a)} ${n(c)}`)
    const strokes: Stroke[] = []
    for (let i = 0; i < bands; i++) {
        const c = band * ((reverse ? bands - 1 - i : i) + 0.5)
        const forward = i % 2 === 0 ? !flip : flip
        const a0 = forward ? -reach : along + reach
        const da = (forward ? along + reach : -reach) - a0
        const d = `M ${pt(a0, c + jitter(wave))} C ${pt(a0 + da / 3, c + jitter(wave))} ${pt(a0 + (da * 2) / 3, c + jitter(wave))} ${pt(a0 + da, c + jitter(wave))}`
        strokes.push({
            d,
            width,
            delay: i * 0.17 * (1 + jitter(0.6)),
            duration: 1 + jitter(0.3),
            main: span(along, length, width / 2, half),
            lead: span(along, length, (width * LEAD_WIDTH) / 2, half),
        })
    }
    const total = Math.max(...strokes.map((s) => s.delay + s.duration * (1 + LEAD)))
    return strokes.map((s) => ({ ...s, delay: s.delay / total, duration: s.duration / total }))
}

function readStored(): Stored | null {
    if (typeof window === "undefined") return null
    try {
        const raw = window.sessionStorage.getItem(KEY)
        if (!raw) return null
        const data = JSON.parse(raw) as Stored
        return Date.now() - data.t < 8000 ? data : null
    } catch {
        return null
    }
}

function animateOffset(el: SVGPathElement | null, from: number, to: number, duration: number, delay = 0): Promise<void> {
    if (!el) return Promise.resolve()
    el.getAnimations().forEach((a) => a.cancel())
    el.style.strokeDashoffset = String(from)
    const a = el.animate([{ strokeDashoffset: from }, { strokeDashoffset: to }], {
        duration,
        delay,
        easing: EASE,
        fill: "forwards",
    })
    const done = () => {
        el.style.strokeDashoffset = String(to)
        a.cancel()
    }
    // Animations stall in background tabs; never let the page stay painted over.
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, duration + delay + 250))
    return Promise.race([a.finished.then(() => undefined), timeout]).then(done, done)
}

/**
 * Page Transition
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function PageTransition(props: PageTransitionProps) {
    const {
        leadColor = "#C8B9A3",
        mainColor = "#141414",
        strokes = 3,
        randomness = 0.6,
        coverDuration = 1.15,
        revealDuration = 1.1,
        hold = 0.3,
        showLabel = true,
        labelFont,
        labelColor = "#EEE5D9",
        preview = false,
        style,
    } = props
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const count = Math.max(1, Math.round(strokes))

    const rootRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const leadRefs = useRef<(SVGPathElement | null)[]>([])
    const mainRefs = useRef<(SVGPathElement | null)[]>([])
    const labelRef = useRef<HTMLDivElement>(null)
    const fillRef = useRef<SVGRectElement>(null)
    const current = useRef<Stroke[]>([])
    const busy = useRef(false)
    const allow = useRef<HTMLAnchorElement | null>(null)
    const mounted = useRef(true)
    const router = useRouter()
    const pathname = usePathname()
    const navigate = useRef((href: string) => router.push(href))
    navigate.current = (href: string) => router.push(href)
    // Set while the screen is painted and a route change is on its way.
    const pending = useRef<{ from: string } | null>(null)
    const [label, setLabel] = useState("")
    const [active, setActive] = useState(false)
    const live = useRef({ coverDuration, revealDuration, hold, showLabel, count, randomness })
    live.current = { coverDuration, revealDuration, hold, showLabel, count, randomness }

    // What React renders; transitions swap in fresh strokes directly on the paths.
    const initial = useMemo(() => makeStrokes(count, randomness, 7, 1600), [count, randomness])

    // Draw this transition's strokes for the current screen shape.
    const prepare = (seed: number) => {
        const rect = rootRef.current?.getBoundingClientRect()
        const w = rect && rect.width ? rect.width : window.innerWidth
        const h = rect && rect.height ? rect.height : window.innerHeight
        const viewW = Math.round((VIEW_H * w) / Math.max(1, h))
        const list = makeStrokes(live.current.count, live.current.randomness, seed, viewW)
        svgRef.current?.setAttribute("viewBox", `0 0 ${viewW} ${VIEW_H}`)
        list.forEach((s, i) => {
            const lead = leadRefs.current[i]
            const main = mainRefs.current[i]
            lead?.setAttribute("d", s.d)
            lead?.setAttribute("stroke-width", String(s.width * LEAD_WIDTH))
            main?.setAttribute("d", s.d)
            main?.setAttribute("stroke-width", String(s.width))
        })
        current.current = list
    }

    const setLabelVisible = (on: boolean, duration = 260) => {
        const el = labelRef.current
        if (!el) return
        el.getAnimations().forEach((a) => a.cancel())
        el.animate([{ opacity: on ? 0 : 1, transform: `translateY(${on ? 14 : 0}px)` }, { opacity: on ? 1 : 0, transform: `translateY(${on ? 0 : -14}px)` }], {
            duration,
            easing: LABEL_EASE,
            fill: "forwards",
        })
    }

    // A solid layer under the strokes closes any hairline seams while the screen is painted.
    const setFill = (on: boolean, duration: number) => {
        const el = fillRef.current
        if (!el) return
        el.getAnimations().forEach((a) => a.cancel())
        if (!duration) {
            el.style.opacity = on ? "1" : "0"
            return
        }
        const a = el.animate([{ opacity: on ? 0 : 1 }, { opacity: on ? 1 : 0 }], { duration, easing: "ease-out", fill: "forwards" })
        const done = () => {
            el.style.opacity = on ? "1" : "0"
            a.cancel()
        }
        Promise.race([a.finished, new Promise((r) => window.setTimeout(r, duration + 100))]).then(done, done)
    }

    const cover = async () => {
        const t = live.current.coverDuration * 1000
        setActive(true)
        await Promise.all(
            current.current.flatMap((s, i) => [
                animateOffset(leadRefs.current[i], 1, 1 - s.lead.cover, s.duration * t, s.delay * t),
                animateOffset(mainRefs.current[i], 1, 1 - s.main.cover, s.duration * t, (s.delay + s.duration * LEAD) * t),
            ])
        )
        setFill(true, 160)
        if (live.current.showLabel) setLabelVisible(true)
    }

    const reveal = async () => {
        const t = live.current.revealDuration * 1000
        if (live.current.showLabel) setLabelVisible(false, 220)
        setFill(false, 140)
        await Promise.all(
            current.current.flatMap((s, i) => [
                animateOffset(mainRefs.current[i], -s.main.reveal, -1, s.duration * t, 100 + s.delay * t),
                animateOffset(leadRefs.current[i], -s.lead.reveal, -1, s.duration * t, 100 + (s.delay + s.duration * LEAD) * t),
            ])
        )
        if (!mounted.current) return
        busy.current = false
        setActive(false)
    }

    const setCovered = () => {
        current.current.forEach((_, i) => {
            for (const el of [leadRefs.current[i], mainRefs.current[i]]) {
                if (!el) continue
                el.getAnimations().forEach((a) => a.cancel())
                el.style.strokeDashoffset = "0"
            }
        })
        setFill(true, 0)
        setActive(true)
    }

    // Arriving on a page mid-transition: start fully painted, then wipe away.
    useLayoutEffect(() => {
        mounted.current = true
        if (isCanvas) return
        const stored = readStored()
        if (!stored) return
        try {
            window.sessionStorage.removeItem(KEY)
        } catch {}
        busy.current = true
        setLabel(stored.label)
        prepare(typeof stored.seed === "number" ? stored.seed : Math.floor(Math.random() * 1e9))
        setCovered()
        if (live.current.showLabel && stored.label && labelRef.current) labelRef.current.style.opacity = "1"
        const id = window.setTimeout(reveal, live.current.hold * 1000)
        return () => {
            mounted.current = false
            window.clearTimeout(id)
        }
    }, [])

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    // Intercept internal link clicks. Listen on window in the capture phase so this runs before
    // Framer's own router, which listens on document and would otherwise navigate straight away.
    useEffect(() => {
        if (isCanvas) return
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        const onClick = (e: MouseEvent) => {
            const a = (e.target as Element | null)?.closest?.("a") as HTMLAnchorElement | null
            if (!a) return
            if (allow.current === a) {
                allow.current = null
                return
            }
            if (reduced || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            const href = a.getAttribute("href")
            if (!href || href.startsWith("#") || a.hasAttribute("download")) return
            if (a.target && a.target !== "_self") return
            let url: URL
            try {
                url = new URL(a.href, window.location.href)
            } catch {
                return
            }
            if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
            e.preventDefault()
            e.stopPropagation()
            if (busy.current) return
            busy.current = true
            const text = a.dataset.transitionLabel || a.getAttribute("aria-label") || (a.textContent || "").trim()
            const nextLabel = text.length <= 40 ? text : ""
            setLabel(nextLabel)
            const seed = Math.floor(Math.random() * 1e9)
            prepare(seed)
            const from = window.location.pathname
            cover().then(() => {
                pending.current = { from }
                navigate.current(url.pathname + url.search + url.hash)
                // Safety net: if the route hasn't changed shortly after, load the page directly — the
                // stored state makes the freshly loaded page start painted and wipe itself away.
                window.setTimeout(() => {
                    if (!pending.current || window.location.pathname !== from) return
                    try {
                        window.sessionStorage.setItem(KEY, JSON.stringify({ label: nextLabel, seed, t: Date.now() }))
                    } catch {}
                    window.location.assign(url.href)
                }, 2500)
            })
        }
        window.addEventListener("click", onClick, true)
        return () => window.removeEventListener("click", onClick, true)
    }, [isCanvas])

    // The layout (and this component) survives client-side navigation: wipe away once the new route is in.
    useEffect(() => {
        const p = pending.current
        if (!p || pathname === p.from) return
        pending.current = null
        const id = window.setTimeout(() => reveal(), live.current.hold * 1000)
        return () => window.clearTimeout(id)
    }, [pathname])

    const showPreview = isCanvas && preview
    const offset = showPreview ? 0 : 1
    const strokeProps = {
        fill: "none",
        strokeLinecap: "round" as const,
        pathLength: 1,
        strokeDasharray: "1 1",
        style: { strokeDashoffset: offset },
    }

    return (
        <div
            ref={rootRef}
            aria-hidden={!active}
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                pointerEvents: active ? "auto" : "none",
                cursor: active ? "progress" : undefined,
            }}
        >
            <svg
                ref={svgRef}
                viewBox={`0 0 1600 ${VIEW_H}`}
                preserveAspectRatio="xMidYMid slice"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
            >
                <rect ref={fillRef} x="-2000" y="-500" width="8000" height="2000" fill={mainColor} style={{ opacity: showPreview ? 1 : 0 }} />
                {initial.map((s, i) => (
                    <React.Fragment key={i}>
                        <path
                            ref={(el) => {
                                leadRefs.current[i] = el
                            }}
                            d={s.d}
                            stroke={leadColor}
                            strokeWidth={s.width * LEAD_WIDTH}
                            {...strokeProps}
                        />
                        <path
                            ref={(el) => {
                                mainRefs.current[i] = el
                            }}
                            d={s.d}
                            stroke={mainColor}
                            strokeWidth={s.width}
                            {...strokeProps}
                        />
                    </React.Fragment>
                ))}
            </svg>
            {showLabel && (
                <div
                    ref={labelRef}
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                        textAlign: "center",
                        opacity: showPreview ? 1 : 0,
                        pointerEvents: "none",
                    }}
                >
                    <span style={{ ...labelFont, color: labelColor }}>{showPreview ? label || "Holla Brand Design" : label}</span>
                </div>
            )}
        </div>
    )
}

addPropertyControls(PageTransition, {
    mainColor: { type: ControlType.Color, title: "Main Color", defaultValue: "#141414" },
    leadColor: { type: ControlType.Color, title: "Lead Color", defaultValue: "#C8B9A3" },
    strokes: { type: ControlType.Number, title: "Strokes", defaultValue: 3, min: 2, max: 6, step: 1, displayStepper: true },
    randomness: {
        type: ControlType.Number,
        title: "Randomness",
        defaultValue: 0.6,
        min: 0,
        max: 1,
        step: 0.05,
        description: "How much direction, wave and timing change from one transition to the next.",
    },
    coverDuration: { type: ControlType.Number, title: "Cover", defaultValue: 1.15, min: 0.2, max: 3, step: 0.05, unit: "s" },
    hold: { type: ControlType.Number, title: "Hold", defaultValue: 0.3, min: 0, max: 2, step: 0.05, unit: "s" },
    revealDuration: { type: ControlType.Number, title: "Reveal", defaultValue: 1.1, min: 0.2, max: 3, step: 0.05, unit: "s" },
    showLabel: { type: ControlType.Boolean, title: "Label", defaultValue: true },
    labelFont: {
        type: ControlType.Font,
        title: "Label Font",
        controls: "extended",
        defaultFontType: "serif",
        defaultValue: { fontSize: 72, lineHeight: "1em", letterSpacing: "-0.02em" },
        hidden: (p) => !p.showLabel,
    },
    labelColor: { type: ControlType.Color, title: "Label Color", defaultValue: "#EEE5D9", hidden: (p) => !p.showLabel },
    preview: { type: ControlType.Boolean, title: "Preview", defaultValue: false, description: "Show the painted state on the canvas." },
})
