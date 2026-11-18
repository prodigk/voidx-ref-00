"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { site } from "@/content"

type Props = {
    /** "overlay" floats over a full-screen page (Home, Contact); "solid" is a fixed cream bar for scrolling pages. */
    mode?: "overlay" | "solid"
}

const normalise = (p: string) => (p.endsWith("/") ? p : p + "/")

export default function Nav({ mode = "overlay" }: Props) {
    const pathname = normalise(usePathname() || "/")
    const [open, setOpen] = useState(false)

    // Close the drawer whenever the route changes.
    useEffect(() => setOpen(false), [pathname])

    const isCurrent = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/work/") : pathname.startsWith(normalise(href)))

    return (
        <nav className={`nav nav--${mode}${open ? " nav--open" : ""}`} aria-label="Main">
            <div className="nav__bar">
                <Link href="/" className="nav__logo" aria-label={`${site.name} — home`}>
                    <img src="/brand/rovelle.svg" alt={site.name} width={110} height={24} />
                </Link>
                <div className="nav__actions">
                    <div className="nav__links">
                        {site.nav.map((item) => (
                            <Link key={item.href} href={item.href} className="nav__link t-nav-link" aria-current={isCurrent(item.href) ? "page" : undefined}>
                                {item.label}
                            </Link>
                        ))}
                    </div>
                    <Link href={site.cta.href} className="btn t-button">
                        {site.cta.label}
                    </Link>
                    <button className="nav__burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                        <span />
                        <span />
                    </button>
                </div>
            </div>
            <div className="nav__drawer" aria-hidden={!open}>
                <div className="nav__drawer-inner">
                    <div className="nav__drawer-content">
                        <div className="nav__menu">
                            {site.nav.map((item) => (
                                <Link key={item.href} href={item.href} className="t-menu-link link-quiet" tabIndex={open ? 0 : -1}>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                        <div className="nav__drawer-foot">
                            <a href={`mailto:${site.contact.email}`} className="t-meta link-quiet" style={{ color: "var(--ink)" }} tabIndex={open ? 0 : -1}>
                                {site.contact.email}
                            </a>
                            <span className="t-meta">{site.location}</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}
