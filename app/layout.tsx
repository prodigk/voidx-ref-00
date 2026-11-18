import type { Metadata, Viewport } from "next"
import { Geist, Instrument_Serif } from "next/font/google"
import SiteEffects from "@/components/SiteEffects"
import { site } from "@/content"
import "./globals.css"

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" })
const serif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" })

export const metadata: Metadata = {
    metadataBase: new URL(site.url),
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.legalName}` },
    description: site.description,
    icons: {
        icon: [
            { url: "/brand/favicon.png", media: "(prefers-color-scheme: light)" },
            { url: "/brand/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
        ],
        apple: "/brand/favicon.png",
    },
    openGraph: { title: site.name, description: site.description, images: ["/images/work/holla/cover.jpg"] },
}

export const viewport: Viewport = { themeColor: "#EEE5D9" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${geist.variable} ${serif.variable}`}>
            <body>
                {children}
                <SiteEffects />
            </body>
        </html>
    )
}
