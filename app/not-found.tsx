import Link from "next/link"
import Nav from "@/components/Nav"

export default function NotFound() {
    return (
        <main className="home-hero" style={{ justifyContent: "center", alignItems: "flex-start", padding: "var(--nav-h) var(--pad) 40px" }}>
            <Nav mode="overlay" />
            <p className="t-meta">(404) — Not found</p>
            <h1 style={{ marginTop: 24 }}>
                <span className="t-statement" style={{ display: "block" }}>
                    Lost?
                </span>
                <span className="t-statement-serif" style={{ display: "block" }}>
                    Keep moving.
                </span>
            </h1>
            <Link href="/" className="btn t-button" style={{ marginTop: 40 }}>
                Back to work ↗
            </Link>
        </main>
    )
}
