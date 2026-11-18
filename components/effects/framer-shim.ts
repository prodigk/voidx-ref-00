// The effect components were first built as Framer code components. This tiny shim provides the
// few Framer helpers they import, so they run unchanged in a plain React / Next.js app.
// (Property controls are only used inside Framer's editor, so here they are simply ignored.)

export const ControlType = new Proxy({} as Record<string, string>, { get: (_, key) => String(key) })

export const RenderTarget = {
    canvas: "CANVAS",
    preview: "PREVIEW",
    current: () => "PREVIEW",
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Control = {
    hidden?: (props: any) => boolean
    control?: Control
    controls?: Record<string, Control> | string
    [key: string]: unknown
}

export function addPropertyControls(_component: unknown, _controls: Record<string, Control>) {}
