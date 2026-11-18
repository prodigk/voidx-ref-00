"use client"

import { useEffect, useState } from "react"

export type Breakpoint = "desktop" | "tablet" | "phone"

const query = () => (window.innerWidth < 810 ? "phone" : window.innerWidth < 1200 ? "tablet" : "desktop")

/** Matches the CSS breakpoints: desktop ≥ 1200px, tablet 810–1199px, phone < 810px. */
export function useBreakpoint(): Breakpoint {
    const [bp, setBp] = useState<Breakpoint>("desktop")
    useEffect(() => {
        const update = () => setBp(query())
        update()
        window.addEventListener("resize", update)
        return () => window.removeEventListener("resize", update)
    }, [])
    return bp
}
