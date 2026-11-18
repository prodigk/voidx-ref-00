"use client"

import VortexHelix from "./effects/VortexHelix"
import { useBreakpoint } from "./useBreakpoint"
import { projects, workHref } from "@/content"

const ink = "#141414"
const muted = "#8a8072"
const geist = "var(--font-geist), Geist, sans-serif"

// Per-breakpoint settings carried over from the Framer project.
const settings = {
    desktop: { size: 28, maxSize: 70, cardsPerTurn: 5.5, strips: 10, backBlur: 3, edgeTop: 20, edgeBottom: 20, edgeBlur: 12, lineGap: 96, insetX: 32, insetBottom: 84 },
    tablet: { size: 36, maxSize: 62, cardsPerTurn: 5.5, strips: 10, backBlur: 3, edgeTop: 22, edgeBottom: 24, edgeBlur: 12, lineGap: 80, insetX: 24, insetBottom: 18 },
    phone: { size: 40, maxSize: 62, cardsPerTurn: 5, strips: 8, backBlur: 2, edgeTop: 22, edgeBottom: 24, edgeBlur: 10, lineGap: 80, insetX: 20, insetBottom: 18 },
}

export default function HomeHelix() {
    const bp = useBreakpoint()
    const items = projects.map((p) => ({ image: { src: p.cover.src, alt: p.cover.alt }, title: p.title, category: p.category, subtitle: p.subtitle, link: workHref(p.slug) }))
    return (
        <VortexHelix
            {...settings[bp]}
            items={items}
            mode="wheel"
            wheelScope="window"
            sensitivity={1}
            snap
            loop
            glide={1.4}
            sideReserve={350}
            cardAspect={1.35}
            cardGap={2}
            rowGap={95}
            cardRadius={10}
            depth={3.6}
            tilt={-10}
            roll={0}
            offsetX={0}
            offsetY={0}
            backOpacity={0.6}
            focus={0.35}
            edgeFade={1}
            edgeSides={26}
            compactBelow={960}
            showTitles
            uppercase
            titleFont={{ fontFamily: geist, fontWeight: 500, fontSize: 26, letterSpacing: "-0.03em", lineHeight: "1em" }}
            titleColor={ink}
            metaFont={{ fontFamily: geist, fontWeight: 500, fontSize: 11, letterSpacing: "0.02em", lineHeight: "1.3em" }}
            metaColor={muted}
            titlesWidth={280}
            activeBg="#F5F0E6"
            activeRadius={16}
            activePadding={16}
            showCounter={false}
            style={{ width: "100%", height: "100%" }}
        />
    )
}
