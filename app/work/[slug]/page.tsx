import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Nav from "@/components/Nav"
import FooterBar from "@/components/FooterBar"
import { projects, projectBySlug, workHref, type Img } from "@/content"

export function generateStaticParams() {
    return projects.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const p = projectBySlug((await params).slug)
    return p ? { title: p.title, description: p.subtitle, openGraph: { images: [p.cover.src] } } : {}
}

const Frame = ({ img, className = "", eager = false }: { img: Img; className?: string; eager?: boolean }) => (
    <div className={`frame ${className}`}>
        <img className="img-cover" src={img.src} alt={img.alt} loading={eager ? "eager" : "lazy"} />
    </div>
)

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const p = projectBySlug(slug)
    if (!p) notFound()
    const i = projects.indexOf(p)
    const next = projects[i + 1]
    const prev = projects[i - 1]

    return (
        <>
            <Nav mode="solid" />
            <main>
                <section className="case">
                    <aside className="case__details">
                        <p className="t-meta">(Work) — {p.category}</p>
                        <h1 className="t-case-title">{p.title}</h1>
                        <p className="t-case-lead">{p.subtitle}</p>
                        <div className="details-table">
                            <div className="details-table__row">
                                <span className="t-meta">Category</span>
                                <span className="t-value">{p.category}</span>
                            </div>
                            <div className="details-table__row">
                                <span className="t-meta">Year</span>
                                <span className="t-value">{p.year}</span>
                            </div>
                            <div className="details-table__row">
                                <span className="t-meta">Services</span>
                                <span className="t-value">{p.services}</span>
                            </div>
                            {next && (
                                <Link href={workHref(next.slug)} className="details-table__row" data-transition-label={next.title}>
                                    <span className="t-meta">Next project</span>
                                    <span className="t-value">{next.title} ↗</span>
                                </Link>
                            )}
                        </div>
                    </aside>

                    <div className="case__gallery">
                        <Frame img={p.cover} className="case__cover" eager />
                        <div className="case__story">
                            <p className="t-meta">(01) — Overview</p>
                            <div className="rich" dangerouslySetInnerHTML={{ __html: p.contentHtml }} />
                        </div>
                        <div className="case__grid">
                            {p.gallery.map((g) => (
                                <Frame key={g.src} img={g} />
                            ))}
                        </div>
                        <Frame img={p.image2} className="case__wide" />
                        <div className="case__grid">
                            {p.gallery2.map((g) => (
                                <Frame key={g.src} img={g} />
                            ))}
                        </div>
                        <Frame img={p.image3} className="case__wide" />
                    </div>
                </section>

                {(next || prev) && (
                    <section className="more">
                        <h2 className="t-case-title">More projects.</h2>
                        <div className="more__cards">
                            {[next && { p: next, label: "Next" }, prev && { p: prev, label: "Previous" }].filter(Boolean).map((c) => {
                                const card = c as { p: typeof p; label: string }
                                return (
                                    <Link key={card.p.slug} href={workHref(card.p.slug)} className="more__card" data-transition-label={card.p.title}>
                                        <Frame img={card.p.cover} />
                                        <div className="more__card-foot">
                                            <span className="t-nav-link">{card.p.title}</span>
                                            <span className="t-meta">
                                                {card.label} — {card.p.year}
                                            </span>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>
                )}
            </main>
            <FooterBar middle={{ label: "← All work", href: "/" }} />
        </>
    )
}
