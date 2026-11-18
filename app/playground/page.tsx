import type { Metadata } from "next"
import Nav from "@/components/Nav"
import PlaygroundGrid from "@/components/PlaygroundGrid"
import { site } from "@/content"

export const metadata: Metadata = { title: "Playground", description: site.playground.description }

export default function Playground() {
    return (
        <>
            <Nav mode="solid" />
            <main className="playground">
                <aside className="playground__side">
                    <div className="playground__count">
                        <p className="t-count">{site.playground.count}</p>
                        <p className="t-meta">{site.playground.caption}</p>
                    </div>
                    <div className="playground__bottom">
                        <p className="playground__desc t-value" style={{ textWrap: "pretty" }}>
                            {site.playground.description}
                        </p>
                        <p className="playground__copyright t-meta">
                            © {site.year} {site.legalName} — {site.location}
                        </p>
                    </div>
                </aside>
                <div className="playground__grid">
                    <PlaygroundGrid />
                </div>
            </main>
        </>
    )
}
