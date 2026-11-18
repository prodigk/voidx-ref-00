"use client"

import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "./framer-shim"

// Smooth Scroll — eases mouse-wheel and trackpad scrolling for the whole page.
//
// Drop one instance anywhere on a page (it renders nothing visible). Touch scrolling,
// the scrollbar, keyboard and anchor links keep their native behaviour; the easing
// steps aside for anything that scrolls on its own (open menus, lightboxes, inner
// scroll areas) and for pages that don't scroll at all.

interface SmoothScrollProps {
    smoothness?: number
    speed?: number
    style?: React.CSSProperties
}

function canScrollInside(start: EventTarget | null, dy: number): boolean {
    let el = start instanceof Element ? start : null
    while (el && el !== document.body && el !== document.documentElement) {
        if (el instanceof HTMLElement) {
            if (el.dataset.smoothScrollPrevent !== undefined || el.dataset.lenisPrevent !== undefined) return true
            const oy = getComputedStyle(el).overflowY
            if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
                if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
            }
        }
        el = el.parentElement
    }
    return false
}

/**
 * Smooth Scroll
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 40
 * @framerIntrinsicHeight 40
 */
export default function SmoothScroll(props: SmoothScrollProps) {
    const { smoothness = 0.08, speed = 1, style } = props
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const live = useRef({ smoothness, speed })
    live.current = { smoothness, speed }

    useEffect(() => {
        if (isCanvas) return
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
        const html = document.documentElement
        const s = { target: window.scrollY, current: window.scrollY, written: window.scrollY, running: false }
        let raf = 0
        let last = 0

        const maxScroll = () => Math.max(0, html.scrollHeight - window.innerHeight)
        const locked = () => {
            const ho = getComputedStyle(html).overflowY
            const bo = getComputedStyle(document.body).overflowY
            return ho === "hidden" || ho === "clip" || bo === "hidden" || bo === "clip"
        }
        const stop = () => {
            s.running = false
            cancelAnimationFrame(raf)
        }

        const tick = (now: number) => {
            const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
            last = now
            // Something else moved the page (scrollbar, keyboard, anchor link, route change): hand over.
            if (Math.abs(window.scrollY - s.written) > 2) {
                s.target = s.current = s.written = window.scrollY
                stop()
                return
            }
            const k = 1 - Math.pow(1 - live.current.smoothness, dt * 60)
            s.current += (s.target - s.current) * k
            if (Math.abs(s.target - s.current) < 0.4) s.current = s.target
            window.scrollTo({ top: s.current, left: window.scrollX, behavior: "instant" as ScrollBehavior })
            s.written = window.scrollY
            if (s.current === s.target) {
                stop()
                return
            }
            raf = requestAnimationFrame(tick)
        }

        const onWheel = (e: WheelEvent) => {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey) return
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
            const max = maxScroll()
            if (max <= 0 || locked() || canScrollInside(e.target, e.deltaY)) return
            e.preventDefault()
            if (!s.running) {
                s.target = s.current = s.written = window.scrollY
            }
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
            s.target = Math.max(0, Math.min(max, s.target + e.deltaY * unit * live.current.speed))
            if (!s.running) {
                s.running = true
                last = 0
                raf = requestAnimationFrame(tick)
            }
        }
        const onScroll = () => {
            if (!s.running) s.target = s.current = s.written = window.scrollY
        }

        window.addEventListener("wheel", onWheel, { passive: false })
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => {
            stop()
            window.removeEventListener("wheel", onWheel)
            window.removeEventListener("scroll", onScroll)
        }
    }, [isCanvas])

    if (!isCanvas) return <div aria-hidden style={{ ...style, position: "relative", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }} />
    return (
        <div
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                border: "1px dashed rgba(20,20,20,0.35)",
                color: "rgba(20,20,20,0.6)",
                fontSize: 10,
                fontFamily: "Inter, system-ui, sans-serif",
            }}
        >
            ↕
        </div>
    )
}

addPropertyControls(SmoothScroll, {
    smoothness: {
        type: ControlType.Number,
        title: "Smoothness",
        defaultValue: 0.08,
        min: 0.02,
        max: 0.4,
        step: 0.01,
        description: "Lower is smoother and floatier.",
    },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 1, min: 0.3, max: 3, step: 0.1 },
})
