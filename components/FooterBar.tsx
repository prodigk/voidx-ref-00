import Link from "next/link"
import { site } from "@/content"

type Props = {
    /** Middle slot: a link back to the work index, a hint, or opening hours. */
    middle?: { label: string; href?: string }
    stackOnPhone?: boolean
    /** Hide the middle slot on phones (keeps the bar on one line). */
    hideMiddleOnPhone?: boolean
    className?: string
}

export default function FooterBar({ middle, stackOnPhone, hideMiddleOnPhone, className = "" }: Props) {
    return (
        <footer className={`footer-bar ${className}`}>
            <div className="footer-bar__line" />
            <div className={`footer-bar__row${stackOnPhone ? " footer-bar__row--stack" : ""}`}>
                <span className="t-meta">
                    © {site.year} {site.legalName}
                </span>
                {middle &&
                    (middle.href ? (
                        <Link href={middle.href} className={`t-meta link-quiet${hideMiddleOnPhone ? " footer-bar__hide-phone" : ""}`}>
                            {middle.label}
                        </Link>
                    ) : (
                        <span className={`t-meta${hideMiddleOnPhone ? " footer-bar__hide-phone" : ""}`}>{middle.label}</span>
                    ))}
                <span className={`t-meta${stackOnPhone ? "" : " footer-bar__hide-phone"}`}>
                    {site.location} — {site.availability}
                </span>
                {!stackOnPhone && <span className="t-meta footer-bar__show-phone">{site.location}</span>}
            </div>
        </footer>
    )
}
