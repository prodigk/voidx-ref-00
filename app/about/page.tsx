import type { Metadata } from "next"
import Link from "next/link"
import Nav from "@/components/Nav"
import FooterBar from "@/components/FooterBar"
import Ticker from "@/components/Ticker"
import { FaqItem, ServiceItem } from "@/components/Accordion"
import { about as defaultAbout, site, workHref } from "@/content"
import { readPublishedContent } from "@/lib/online-content"

export const metadata: Metadata = { title: "About", description: defaultAbout.principles.statement }
export const dynamic = "force-dynamic"

const Row = ({ label, note, children, large, extra }: { label: string; note?: string; children: React.ReactNode; large?: boolean; extra?: React.ReactNode }) => (
    <section className={`section-row${large ? " section-row--lg" : ""}`}>
        <div className="section-row__label">
            <p className="t-meta">{label}</p>
            {note && <p className="t-value">{note}</p>}
            {extra}
        </div>
        <div className="section-row__content">{children}</div>
    </section>
)

export default async function About() {
    const { about, projects } = await readPublishedContent()
    const featured = projects.find(p => p.slug === about.featuredProject) ?? projects[0]
    return (
        <>
            <Nav mode="solid" />
            <main>
                <header className="about-hero">
                    <div className="about-hero__meta">
                        <p className="t-meta">{about.metaLeft}</p>
                        <p className="t-meta">{about.metaRight}</p>
                    </div>
                    <h1 className="about-hero__headline">
                        <span className="t-statement">{about.headline.sans}</span>
                        <span className="t-statement-serif">{about.headline.serif}</span>
                    </h1>
                    <div className="frame about-hero__image">
                        <img className="img-cover" src={about.studioImage.src} alt={about.studioImage.alt} />
                    </div>
                </header>

                <Row label="(01) — Our principles">
                    <p className="t-about-statement">{about.principles.statement}</p>
                    <div className="two-col">
                        {about.principles.paragraphs.map((t) => (
                            <p key={t} className="t-paragraph">
                                {t}
                            </p>
                        ))}
                    </div>
                </Row>

                <Row label="(02) — In numbers">
                    <div className="stats">
                        {about.stats.map((s) => (
                            <div key={s.label} className="stats__item">
                                <p className="t-meta">{s.label}</p>
                                <p className="t-stat">{s.value}</p>
                            </div>
                        ))}
                    </div>
                </Row>

                <section className="clients">
                    <p className="clients__label t-meta">(03) — Selected clients</p>
                    <Ticker className="clients__ticker" duration={70} gap={48}>
                        {projects.map((p) => (
                            <span key={p.slug} style={{ display: "flex", alignItems: "center", gap: 48 }}>
                                <span className="t-row-title" style={{ whiteSpace: "nowrap" }}>
                                    {p.title}
                                </span>
                                <span className="t-lead-serif clients__mark">✳</span>
                            </span>
                        ))}
                    </Ticker>
                </section>

                <Row label="(04) — Services" note={about.servicesNote}>
                    <div className="rows">
                        {about.services.map((s) => (
                            <ServiceItem key={s.title} {...s} />
                        ))}
                    </div>
                </Row>

                <Row label="(05) — Recognition" note={about.awardsNote} large>
                    <h2 className="t-project-title">Our awards</h2>
                    <div className="rows">
                        {about.awards.map((a) => (
                            <div key={a.award} className="award-row">
                                <span className="t-nav-link">{a.award}</span>
                                <span className="t-value">{a.category}</span>
                                <span className="t-nav-link">{a.count}</span>
                            </div>
                        ))}
                    </div>
                </Row>

                <Row label="(06) — The team" note={about.teamNote} large>
                    <div className="team-grid">
                        {about.team.map((m) => (
                            <div key={m.name} className="team-card">
                                <div className="frame">
                                    <img className="img-cover" src={m.image.src} alt={m.image.alt} loading="lazy" />
                                </div>
                                <p className="t-meta">{m.role}</p>
                                <p className="t-member">{m.name}</p>
                                <p className="t-meta team-card__social">{m.social}</p>
                            </div>
                        ))}
                    </div>
                </Row>

                <Row
                    label="(07) — Pricing"
                    note={about.pricingNote}
                    large
                    extra={
                        <Link href="/contact/" className="t-nav-link link-quiet">
                            Let’s talk ↗
                        </Link>
                    }
                >
                    <h2 className="t-project-title">Pricing</h2>
                    <div className="rows">
                        {about.plans.map((plan) => (
                            <div key={plan.name} className="plan-row">
                                <div className="plan-row__details">
                                    <h3 className="t-heading2">{plan.name}</h3>
                                    <div className="plan-row__features">
                                        {plan.features.map((f) => (
                                            <p key={f} className="t-value">
                                                + {f}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                                <div className="plan-row__price">
                                    <p className="t-value" style={{ textWrap: "pretty" }}>
                                        {plan.description}
                                    </p>
                                    <p className="t-plan-price">{plan.price}</p>
                                    <p className="t-meta">/ month</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Row>

                {featured && <Row label="(08) — Featured project" large>
                    <Link href={workHref(featured.slug)} className="featured" data-transition-label={featured.title}>
                        <div className="frame">
                            <img className="img-cover" src={featured.cover.src} alt={featured.cover.alt} loading="lazy" />
                        </div>
                        <div className="featured__text">
                            <p className="t-meta">(Work) — {featured.category}</p>
                            <h3 className="t-case-title">{featured.title}</h3>
                            <p className="t-case-lead">{featured.subtitle}</p>
                            <span className="t-nav-link">View project ↗</span>
                        </div>
                    </Link>
                </Row>}

                <Row label="(09) — Questions, answered" large>
                    <div className="rows">
                        {about.faq.map((f) => (
                            <FaqItem key={f.question} {...f} />
                        ))}
                    </div>
                </Row>

                <footer className="about-footer">
                    <div className="about-footer__wordmark">
                        <img src="/brand/rovelle.svg" alt={site.name} width={1025} height={223} />
                    </div>
                    <FooterBar middle={{ label: "← All work", href: "/" }} stackOnPhone />
                </footer>
            </main>
        </>
    )
}
