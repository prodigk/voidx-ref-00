import Nav from "@/components/Nav"
import FooterBar from "@/components/FooterBar"
import HomeHelix from "@/components/HomeHelix"
import { site } from "@/content"

export default function Home() {
    return (
        <main className="home-hero">
            <Nav mode="overlay" />
            <div className="home-hero__main">
                <p className="home-hero__intro t-intro">
                    <strong style={{ fontWeight: 700 }}>{site.name}</strong> — {site.intro}
                </p>
                <div className="home-hero__statement">
                    <p className="t-year">{site.home.years}</p>
                    <h1>
                        <span className="t-statement" style={{ display: "block" }}>
                            {site.home.statementSans}
                        </span>
                        <span className="t-statement-serif" style={{ display: "block" }}>
                            {site.home.statementSerif}
                        </span>
                    </h1>
                </div>
            </div>
            <div className="home-hero__helix">
                <HomeHelix />
            </div>
            <FooterBar className="home-hero__footer" middle={{ label: site.home.hint }} hideMiddleOnPhone />
        </main>
    )
}
