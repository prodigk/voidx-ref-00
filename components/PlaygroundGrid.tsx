"use client"

import InfiniteMasonry from "./effects/InfiniteMasonry"
import { useBreakpoint } from "./useBreakpoint"
import type { PlaygroundItem } from "@/lib/online-content"

const geist = "var(--font-geist), Geist, sans-serif"
const serif = "var(--font-serif), 'Instrument Serif', serif"

export default function PlaygroundGrid({ entries }: { entries: PlaygroundItem[] }) {
    const bp = useBreakpoint()
    const items = entries.map((p) => ({ image: { src: p.image.src, alt: p.image.alt }, title: p.title, category: p.category }))
    return (
        <InfiniteMasonry
            items={items}
            columns={4}
            columnsTablet={3}
            columnsPhone={2}
            tabletBelow={1000}
            phoneBelow={600}
            gap={16}
            gapPhone={10}
            cardPadding={12}
            cardPaddingPhone={6}
            cardBg="#E4DACB"
            cardRadius={10}
            imageRadius={4}
            infinite
            showCaption={false}
            overlayCaptions="never"
            edgeTop={bp === "desktop" ? 200 : 0}
            edgeBottom={120}
            edgeBlur={10}
            edgeColor="#EEE5D9"
            parallax={0.08}
            lightboxBg="rgba(20, 20, 20, 0.94)"
            lightboxColor="#EEE5D9"
            lightboxFont={{ fontFamily: serif, fontStyle: "italic", fontSize: 32, letterSpacing: "-0.01em", lineHeight: "1em" }}
            lightboxMetaFont={{ fontFamily: geist, fontWeight: 500, fontSize: 12, letterSpacing: "0.04em", lineHeight: "1.2em" }}
        />
    )
}
