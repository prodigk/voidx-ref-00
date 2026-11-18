"use client"

import PageTransition from "./effects/PageTransition"
import SmoothScroll from "./effects/SmoothScroll"

/** Site-wide motion: the brush-stroke page transition and eased wheel scrolling. */
export default function SiteEffects() {
    return (
        <>
            <SmoothScroll smoothness={0.08} speed={1} />
            <div style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
                <PageTransition
                    mainColor="#141414"
                    leadColor="#EEE5D9"
                    strokes={3}
                    randomness={0.6}
                    coverDuration={1.15}
                    hold={0.3}
                    revealDuration={1.1}
                    showLabel
                    labelColor="#EEE5D9"
                    labelFont={{ fontFamily: "var(--font-serif), 'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, fontSize: 80, letterSpacing: "-0.02em", lineHeight: "1em" }}
                />
            </div>
        </>
    )
}
