import type { Metadata } from "next"
import Nav from "@/components/Nav"
import FooterBar from "@/components/FooterBar"
import Ticker from "@/components/Ticker"
import { carousel, site } from "@/content"

export const metadata: Metadata = { title: "Contact", description: `Email, phone and studio address — or schedule a call with ${site.legalName}.` }

export default function Contact() {
    const c = site.contact
    return (
        <main className="contact">
            <Nav mode="overlay" />
            <div className="contact__body">
                <div className="contact__top">
                    <p className="t-meta">{c.index}</p>
                    <p className="contact__availability t-meta">
                        <span className="contact__dot" aria-hidden />
                        {c.booking}
                    </p>
                </div>

                <Ticker duration={85} gap={12} fade>
                    {carousel.map((item) => (
                        <div key={item.image.src} className="contact__card">
                            <img className="img-cover" src={item.image.src} alt="" />
                        </div>
                    ))}
                </Ticker>

                <div className="contact__head">
                    <h1>
                        <span className="t-statement" style={{ display: "block" }}>
                            {c.statementSans}
                        </span>
                        <span className="t-statement-serif" style={{ display: "block" }}>
                            {c.statementSerif}
                        </span>
                    </h1>
                    <p className="contact__note t-value" style={{ textWrap: "pretty" }}>
                        {c.note}
                    </p>
                </div>

                <div className="contact__info">
                    <div className="contact__col contact__col--full">
                        <p className="t-meta">(01) Email</p>
                        <a href={`mailto:${c.email}`} className="t-contact-value link-underline">
                            {c.email}
                        </a>
                    </div>
                    <div className="contact__col">
                        <p className="t-meta">(02) Phone</p>
                        <a href={c.phoneHref} className="t-contact-value link-underline">
                            {c.phone}
                        </a>
                    </div>
                    <div className="contact__col">
                        <p className="t-meta">(03) Studio</p>
                        <p className="t-contact-value">
                            {c.addressLines[0]}
                            <br />
                            {c.addressLines[1]}
                        </p>
                    </div>
                    <div className="contact__col contact__col--full">
                        <p className="t-meta">(04) Schedule</p>
                        <div>
                            <a href={c.scheduleHref} target="_blank" rel="noreferrer" className="btn t-button">
                                {c.scheduleLabel}
                            </a>
                        </div>
                        <p className="t-meta">{c.scheduleNote}</p>
                    </div>
                </div>
            </div>
            <FooterBar className="contact__footer" middle={{ label: c.hours }} hideMiddleOnPhone />
        </main>
    )
}
