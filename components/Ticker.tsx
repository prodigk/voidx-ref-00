import type { CSSProperties, ReactNode } from "react"

type Props = {
    children: ReactNode
    /** Seconds for one full loop — larger is slower. */
    duration?: number
    gap?: number
    fade?: boolean
    className?: string
}

/** An endless, non-interactive marquee. The content is rendered twice and shifted by half its width. */
export default function Ticker({ children, duration = 60, gap = 12, fade = false, className = "" }: Props) {
    const style = { "--ticker-duration": `${duration}s`, "--ticker-gap": `${gap}px` } as CSSProperties
    return (
        <div className={`ticker${fade ? " ticker--fade" : ""} ${className}`} style={style} aria-hidden>
            <div className="ticker__track">
                <div className="ticker__group">{children}</div>
                <div className="ticker__group">{children}</div>
            </div>
        </div>
    )
}
