"use client"

import { useState } from "react"
import type { Img } from "@/content"

export function ServiceItem({ number, title, description, image }: { number: string; title: string; description: string; image: Img }) {
    const [open, setOpen] = useState(false)
    return (
        <div className={`acc${open ? " acc--open" : ""}`}>
            <button className="acc__head acc__head--service" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <span className="acc__title">
                    <span className="t-meta">{number}</span>
                    <span className="t-row-title">{title}</span>
                </span>
                <span className="acc__toggle" aria-hidden />
            </button>
            <div className="acc__panel">
                <div className="acc__panel-inner">
                    <div className="acc__body">
                        <div className="frame">
                            <img className="img-cover" src={image.src} alt={image.alt} loading="lazy" />
                        </div>
                        <p className="t-paragraph">{description}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false)
    return (
        <div className={`acc${open ? " acc--open" : ""}`}>
            <button className="acc__head acc__head--faq" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <span className="acc__title t-member">{question}</span>
                <span className="acc__toggle" aria-hidden />
            </button>
            <div className="acc__panel">
                <div className="acc__panel-inner">
                    <div className="acc__body acc__body--faq">
                        <p className="t-paragraph">{answer}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
